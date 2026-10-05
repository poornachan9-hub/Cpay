// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title CropLoan
 * @notice Farmer micro-loan protocol — borrow USDC against future crop sales.
 *
 * Collateral model (demo-friendly):
 *   Min collateral = amountUSDC * COLLATERAL_RATIO_BPS / 10000
 *   i.e. each USDC borrowed requires 4 kg of future harvest pledged (400%)
 *   Example: borrow 50 USDC → must pledge ≥ 200 kg tomatoes
 *
 * Lifecycle:
 *   borrow()  → LoanStatus.Active   (funds leave reserve → farmer wallet)
 *   repay()   → LoanStatus.Repaid   (farmer returns USDC within deadline)
 *   liquidate()→ LoanStatus.Liquidated (anyone calls after deadline)
 *
 * Security:
 *   - Ownable (pause guardian)
 *   - ReentrancyGuard on state-changing calls
 *   - Pausable (emergency stop)
 *   - 30-day hard cap on loan term
 */
contract CropLoan is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice 400% collateral ratio: 4 kg per USDC (demo: 1 kg ≈ $0.25)
    uint256 public constant COLLATERAL_RATIO_BPS = 40000; // 400% in basis points (×100)
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Maximum loan term: 30 days
    uint256 public constant MAX_LOAN_TERM = 30 days;

    /// @notice Platform fee taken on repayment (2%)
    uint256 public constant REPAY_FEE_BPS = 200;

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    enum LoanStatus {
        Active,
        Repaid,
        Liquidated
    }

    struct Loan {
        uint256 id;
        address farmer;
        uint256 amountUSDC;      // 6-decimal USDC units
        uint256 collateralKg;    // future harvest pledged (in kg, 18-decimal)
        uint256 repayBy;         // unix timestamp
        uint256 borrowedAt;
        LoanStatus status;
        uint256 repayAmount;     // principal + fee
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    IERC20 public immutable USDC;
    Counters.Counter private _loanIdCounter;

    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public farmerLoans;

    uint256[] public allLoanIds;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event LoanCreated(
        uint256 indexed loanId,
        address indexed farmer,
        uint256 amountUSDC,
        uint256 collateralKg,
        uint256 repayBy
    );

    event LoanRepaid(
        uint256 indexed loanId,
        address indexed farmer,
        uint256 repayAmount
    );

    event LoanLiquidated(
        uint256 indexed loanId,
        address indexed farmer,
        address indexed liquidator
    );

    event ReserveFunded(address indexed funder, uint256 amount);
    event ReserveWithdrawn(address indexed owner, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _usdc  Address of the USDC token (Mock or real on Sepolia)
     */
    constructor(address _usdc) {
        require(_usdc != address(0), "CropLoan: zero USDC address");
        USDC = IERC20(_usdc);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Borrow USDC against a pledge of future crop harvest.
     * @param amountUSDC   Amount to borrow in USDC (6-decimal units)
     * @param futureKg     Kilograms of harvest pledged as collateral (18-decimal)
     * @param termDays     Loan duration in days (1–30)
     *
     * Requirements:
     *   - amountUSDC > 0
     *   - futureKg >= amountUSDC * COLLATERAL_RATIO_BPS / BPS_DENOMINATOR / 1e6 * 1e18
     *     (simplified: futureKg >= amountUSDC * 4e12  for 6-dec USDC → 18-dec kg)
     *   - termDays in [1, 30]
     *   - Contract reserve has enough USDC
     */
    function borrow(
        uint256 amountUSDC,
        uint256 futureKg,
        uint256 termDays
    ) external nonReentrant whenNotPaused returns (uint256 loanId) {
        require(amountUSDC > 0, "CropLoan: zero amount");
        require(termDays >= 1 && termDays <= 30, "CropLoan: term must be 1-30 days");

        // Minimum collateral: 4 kg per USDC (accounting for decimals: USDC=6, kg=18)
        // minKg = amountUSDC * 4 * 1e12  (converts 6-dec USDC to 18-dec kg at 4:1)
        uint256 minKg = (amountUSDC * COLLATERAL_RATIO_BPS * 1e12) / BPS_DENOMINATOR;
        require(futureKg >= minKg, "CropLoan: insufficient collateral (need 4kg per USDC)");

        // Check reserve
        uint256 reserve = USDC.balanceOf(address(this));
        require(reserve >= amountUSDC, "CropLoan: insufficient reserve");

        // Calculate repay amount with fee
        uint256 fee = (amountUSDC * REPAY_FEE_BPS) / BPS_DENOMINATOR;
        uint256 repayAmt = amountUSDC + fee;

        // Mint loan ID
        _loanIdCounter.increment();
        loanId = _loanIdCounter.current();

        uint256 deadline = block.timestamp + (termDays * 1 days);

        loans[loanId] = Loan({
            id: loanId,
            farmer: msg.sender,
            amountUSDC: amountUSDC,
            collateralKg: futureKg,
            repayBy: deadline,
            borrowedAt: block.timestamp,
            status: LoanStatus.Active,
            repayAmount: repayAmt
        });

        farmerLoans[msg.sender].push(loanId);
        allLoanIds.push(loanId);

        // Transfer USDC from reserve to farmer
        USDC.safeTransfer(msg.sender, amountUSDC);

        emit LoanCreated(loanId, msg.sender, amountUSDC, futureKg, deadline);
        return loanId;
    }

    /**
     * @notice Repay an active loan (principal + 2% fee).
     * @param loanId  The loan to repay.
     *
     * Requirements:
     *   - Caller is the borrowing farmer
     *   - Loan is Active
     *   - Caller has approved repayAmount USDC to this contract
     */
    function repay(uint256 loanId) external nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        require(loan.farmer == msg.sender, "CropLoan: not loan owner");
        require(loan.status == LoanStatus.Active, "CropLoan: loan not active");

        uint256 repayAmt = loan.repayAmount;
        loan.status = LoanStatus.Repaid;

        // Pull repay amount back into reserve
        USDC.safeTransferFrom(msg.sender, address(this), repayAmt);

        emit LoanRepaid(loanId, msg.sender, repayAmt);
    }

    /**
     * @notice Liquidate an expired loan. Anyone may call after the deadline.
     * @param loanId  The overdue loan to liquidate.
     *
     * Requirements:
     *   - Loan is Active
     *   - block.timestamp > loan.repayBy
     */
    function liquidate(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Active, "CropLoan: loan not active");
        require(block.timestamp > loan.repayBy, "CropLoan: deadline not reached");

        loan.status = LoanStatus.Liquidated;

        emit LoanLiquidated(loanId, loan.farmer, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Reserve Management (Owner)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Owner deposits USDC into the lending reserve.
     *         Must approve this contract first.
     */
    function fundReserve(uint256 amount) external onlyOwner {
        require(amount > 0, "CropLoan: zero amount");
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveFunded(msg.sender, amount);
    }

    /**
     * @notice Owner withdraws excess USDC from reserve.
     */
    function withdrawReserve(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "CropLoan: zero amount");
        require(USDC.balanceOf(address(this)) >= amount, "CropLoan: insufficient reserve");
        USDC.safeTransfer(owner(), amount);
        emit ReserveWithdrawn(owner(), amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Emergency Controls
    // ─────────────────────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns all loan IDs for a given farmer
    function getFarmerLoans(address farmer) external view returns (uint256[] memory) {
        return farmerLoans[farmer];
    }

    /// @notice Returns all loan IDs ever created
    function getAllLoans() external view returns (uint256[] memory) {
        return allLoanIds;
    }

    /// @notice Returns current USDC reserve balance
    function getReserveBalance() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }

    /// @notice Returns minimum kg collateral required for a given USDC amount
    function getMinCollateralKg(uint256 amountUSDC) external pure returns (uint256) {
        return (amountUSDC * COLLATERAL_RATIO_BPS * 1e12) / BPS_DENOMINATOR;
    }

    /// @notice Returns repay amount (principal + 2% fee) for a given borrow amount
    function getRepayAmount(uint256 amountUSDC) external pure returns (uint256) {
        uint256 fee = (amountUSDC * REPAY_FEE_BPS) / BPS_DENOMINATOR;
        return amountUSDC + fee;
    }

    /// @notice Returns seconds remaining until a loan's deadline (0 if expired)
    function timeUntilDeadline(uint256 loanId) external view returns (uint256) {
        Loan storage loan = loans[loanId];
        if (block.timestamp >= loan.repayBy) return 0;
        return loan.repayBy - block.timestamp;
    }
}
