
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title CryptoPaymentGateway
 * @dev A comprehensive payment gateway with KYC verification, multi-token support, and analytics
 * Compatible with OpenZeppelin v4
 */
contract CryptoPaymentGateway is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    // Counters for unique IDs
    Counters.Counter private _kycIdCounter;
    Counters.Counter private _productIdCounter;
    Counters.Counter private _transactionIdCounter;

    // Supported tokens
    IERC20 public immutable USDT;
    IERC20 public immutable USDC;
    
    // Platform fee (in basis points, 100 = 1%)
    uint256 public platformFeeRate = 250; // 2.5%
    uint256 public constant MAX_FEE_RATE = 1000; // 10% maximum
    
    // Payout frequency (1 week)
    uint256 public constant PAYOUT_INTERVAL = 7 days;
    
    // KYC status enum
    enum KYCStatus {
        NotSubmitted,
        Pending,
        Approved,
        Rejected,
        Cancelled
    }
    
    // Payment token enum
    enum PaymentToken {
        ETH,
        USDT,
        USDC
    }
    
    // Product status enum
    enum ProductStatus {
        Active,
        Deactivated,
        Paused
    }

    // KYC data structure
    struct KYCData {
        uint256 id;
        address user;
        string ipfsHash; // Pinata IPFS hash for KYC documents
        KYCStatus status;
        uint256 submittedAt;
        uint256 reviewedAt;
        string rejectionReason;
        address reviewedBy;
    }

    // Product data structure
    struct Product {
        uint256 id;
        address merchant;
        string name;
        string description;
        string ipfsHash; // Pinata IPFS hash for product details
        uint256 priceETH;
        uint256 priceUSDT;
        uint256 priceUSDC;
        ProductStatus status;
        uint256 createdAt;
        uint256 totalSales;
        uint256 totalRevenue;
        bool isActive;
    }

    // Transaction data structure
    struct Transaction {
        uint256 id;
        uint256 productId;
        address buyer;
        address merchant;
        PaymentToken token;
        uint256 amount;
        uint256 platformFee;
        uint256 merchantAmount;
        uint256 timestamp;
        string ipfsHash; // Optional transaction metadata
        bool processed;
    }

    // Payout data structure
    struct PayoutRecord {
        address merchant;
        uint256 amount;
        PaymentToken token;
        uint256 timestamp;
        uint256[] transactionIds;
    }

    // Analytics data structure
    struct MerchantAnalytics {
        uint256 totalTransactions;
        uint256 totalRevenue;
        uint256 totalProducts;
        uint256 lastPayoutTime;
        mapping(PaymentToken => uint256) revenueByToken;
        mapping(uint256 => uint256) dailyRevenue; // timestamp => revenue
    }

    struct PlatformAnalytics {
        uint256 totalTransactions;
        uint256 totalRevenue;
        uint256 totalMerchants;
        uint256 totalProducts;
        mapping(PaymentToken => uint256) volumeByToken;
        mapping(uint256 => uint256) dailyVolume;
    }

    // Mappings
    mapping(address => KYCData) public kycData;
    mapping(address => bytes32) public aadhaarProofHash;
    mapping(bytes32 => bool) public usedAadhaarHashes;
    mapping(uint256 => Product) public products;
    mapping(uint256 => Transaction) public transactions;
    mapping(address => MerchantAnalytics) public merchantAnalytics;
    mapping(address => mapping(PaymentToken => uint256)) public pendingPayouts;
    mapping(address => bool) public authorizedReviewers;
    
    // Platform analytics
    PlatformAnalytics public platformAnalytics;
    
    // Arrays for enumeration
    address[] public kycUsers;
    uint256[] public allProducts;
    uint256[] public allTransactions;
    PayoutRecord[] public payoutHistory;

    // Events
    event KYCSubmitted(address indexed user, uint256 indexed kycId, string ipfsHash);
    event KYCReviewed(address indexed user, uint256 indexed kycId, KYCStatus status, address reviewer);
    event KYCCancelled(address indexed user, uint256 indexed kycId);
    event ProductCreated(uint256 indexed productId, address indexed merchant, string name);
    event ProductUpdated(uint256 indexed productId, address indexed merchant);
    event ProductStatusChanged(uint256 indexed productId, ProductStatus status);
    event PaymentReceived(uint256 indexed transactionId, uint256 indexed productId, address indexed buyer, PaymentToken token, uint256 amount);
    event PayoutProcessed(address indexed merchant, PaymentToken token, uint256 amount, uint256 timestamp);
    event ReviewerAdded(address indexed reviewer);
    event ReviewerRemoved(address indexed reviewer);
    event PlatformFeeUpdated(uint256 newFeeRate);
    event AadhaarVerified(address indexed user, bytes32 proofHash);

    // Modifiers
    modifier onlyKYCApproved() {
        require(kycData[msg.sender].status == KYCStatus.Approved, "KYC not approved");
        _;
    }

    modifier onlyAuthorizedReviewer() {
        require(authorizedReviewers[msg.sender] || msg.sender == owner(), "Not authorized reviewer");
        _;
    }

    modifier validProduct(uint256 productId) {
        require(products[productId].isActive, "Product does not exist");
        require(products[productId].status == ProductStatus.Active, "Product not active");
        _;
    }
constructor(address _usdt, address _usdc) {

        USDT = IERC20(_usdt);
        USDC = IERC20(_usdc);
        authorizedReviewers[msg.sender] = true;
        
        // Initialize platform analytics
        platformAnalytics.totalTransactions = 0;
        platformAnalytics.totalRevenue = 0;
        platformAnalytics.totalMerchants = 0;
        platformAnalytics.totalProducts = 0;
    }

    // KYC Functions
    function submitKYC(string memory _ipfsHash) external {
        _submitKYC(msg.sender, _ipfsHash);
    }

    function submitKYCForUser(address _user, string memory _ipfsHash) 
        external 
        onlyAuthorizedReviewer 
    {
        _submitKYC(_user, _ipfsHash);
    }

    function _submitKYC(address _user, string memory _ipfsHash) internal {
        require(bytes(_ipfsHash).length > 0, "IPFS hash required");
        require(kycData[_user].status == KYCStatus.NotSubmitted || 
                kycData[_user].status == KYCStatus.Rejected, "KYC already submitted or approved");

        _kycIdCounter.increment();
        uint256 newKycId = _kycIdCounter.current();

        kycData[_user] = KYCData({
            id: newKycId,
            user: _user,
            ipfsHash: _ipfsHash,
            status: KYCStatus.Pending,
            submittedAt: block.timestamp,
            reviewedAt: 0,
            rejectionReason: "",
            reviewedBy: address(0)
        });

        kycUsers.push(_user);
        emit KYCSubmitted(_user, newKycId, _ipfsHash);
    }

    function reviewKYC(address _user, bool _approved, string memory _rejectionReason) 
        external 
        onlyAuthorizedReviewer 
    {
        require(kycData[_user].status == KYCStatus.Pending, "KYC not pending review");
        
        KYCStatus newStatus = _approved ? KYCStatus.Approved : KYCStatus.Rejected;
        kycData[_user].status = newStatus;
        kycData[_user].reviewedAt = block.timestamp;
        kycData[_user].reviewedBy = msg.sender;
        
        if (!_approved) {
            kycData[_user].rejectionReason = _rejectionReason;
        } else {
            platformAnalytics.totalMerchants++;
        }

        emit KYCReviewed(_user, kycData[_user].id, newStatus, msg.sender);
    }

    function cancelKYC(address _user) external onlyOwner {
        require(kycData[_user].status != KYCStatus.NotSubmitted, "No KYC to cancel");
        
        kycData[_user].status = KYCStatus.Cancelled;
        kycData[_user].reviewedAt = block.timestamp;
        kycData[_user].reviewedBy = msg.sender;

        emit KYCCancelled(_user, kycData[_user].id);
    }

    function submitAadhaarProof(bytes32 _proofHash) external {
        require(_proofHash != bytes32(0), "Invalid proof hash");
        require(!usedAadhaarHashes[_proofHash], "Aadhaar already used");
        aadhaarProofHash[msg.sender] = _proofHash;
        usedAadhaarHashes[_proofHash] = true;
        emit AadhaarVerified(msg.sender, _proofHash);
    }

    // Product Management Functions
    function createProduct(
        string memory _name,
        string memory _description,
        string memory _ipfsHash,
        uint256 _priceETH,
        uint256 _priceUSDT,
        uint256 _priceUSDC
    ) external onlyKYCApproved returns (uint256) {
        require(bytes(_name).length > 0, "Product name required");
        require(_priceETH > 0 || _priceUSDT > 0 || _priceUSDC > 0, "At least one price must be set");

        _productIdCounter.increment();
        uint256 newProductId = _productIdCounter.current();

        products[newProductId] = Product({
            id: newProductId,
            merchant: msg.sender,
            name: _name,
            description: _description,
            ipfsHash: _ipfsHash,
            priceETH: _priceETH,
            priceUSDT: _priceUSDT,
            priceUSDC: _priceUSDC,
            status: ProductStatus.Active,
            createdAt: block.timestamp,
            totalSales: 0,
            totalRevenue: 0,
            isActive: true
        });

        allProducts.push(newProductId);
        merchantAnalytics[msg.sender].totalProducts++;
        platformAnalytics.totalProducts++;

        emit ProductCreated(newProductId, msg.sender, _name);
        return newProductId;
    }

    function updateProduct(
        uint256 _productId,
        string memory _name,
        string memory _description,
        string memory _ipfsHash,
        uint256 _priceETH,
        uint256 _priceUSDT,
        uint256 _priceUSDC
    ) external {
        require(products[_productId].merchant == msg.sender, "Not product owner");
        require(products[_productId].isActive, "Product does not exist");

        Product storage product = products[_productId];
        product.name = _name;
        product.description = _description;
        product.ipfsHash = _ipfsHash;
        product.priceETH = _priceETH;
        product.priceUSDT = _priceUSDT;
        product.priceUSDC = _priceUSDC;

        emit ProductUpdated(_productId, msg.sender);
    }

    function deactivateProduct(uint256 _productId) external onlyOwner {
        require(products[_productId].isActive, "Product does not exist");
        
        products[_productId].status = ProductStatus.Deactivated;
        emit ProductStatusChanged(_productId, ProductStatus.Deactivated);
    }

    function pauseProduct(uint256 _productId) external {
        require(products[_productId].merchant == msg.sender || msg.sender == owner(), "Not authorized");
        require(products[_productId].isActive, "Product does not exist");
        
        products[_productId].status = ProductStatus.Paused;
        emit ProductStatusChanged(_productId, ProductStatus.Paused);
    }

    function resumeProduct(uint256 _productId) external {
        require(products[_productId].merchant == msg.sender, "Not product owner");
        require(products[_productId].isActive, "Product does not exist");
        
        products[_productId].status = ProductStatus.Active;
        emit ProductStatusChanged(_productId, ProductStatus.Active);
    }

    // Payment Functions
    function payWithETH(uint256 _productId, string memory _ipfsHash) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        validProduct(_productId) 
    {
        Product storage product = products[_productId];
        require(product.priceETH > 0, "ETH payment not accepted for this product");
        require(msg.value >= product.priceETH, "Insufficient payment");

        _processPayment(_productId, PaymentToken.ETH, product.priceETH, _ipfsHash);
        
        // Refund excess payment
        if (msg.value > product.priceETH) {
            payable(msg.sender).transfer(msg.value - product.priceETH);
        }
    }

    function payWithUSDT(uint256 _productId, string memory _ipfsHash) 
        external 
        nonReentrant 
        whenNotPaused 
        validProduct(_productId) 
    {
        Product storage product = products[_productId];
        require(product.priceUSDT > 0, "USDT payment not accepted for this product");

        USDT.safeTransferFrom(msg.sender, address(this), product.priceUSDT);
        _processPayment(_productId, PaymentToken.USDT, product.priceUSDT, _ipfsHash);
    }

    function payWithUSDC(uint256 _productId, string memory _ipfsHash) 
        external 
        nonReentrant 
        whenNotPaused 
        validProduct(_productId) 
    {
        Product storage product = products[_productId];
        require(product.priceUSDC > 0, "USDC payment not accepted for this product");

        USDC.safeTransferFrom(msg.sender, address(this), product.priceUSDC);
        _processPayment(_productId, PaymentToken.USDC, product.priceUSDC, _ipfsHash);
    }

    function _processPayment(
        uint256 _productId, 
        PaymentToken _token, 
        uint256 _amount, 
        string memory _ipfsHash
    ) internal {
        Product storage product = products[_productId];
        
        // Calculate fees
        uint256 platformFee = (_amount * platformFeeRate) / 10000;
        uint256 merchantAmount = _amount - platformFee;

        // ⚡ TRANSFER FEE DIRECTLY TO OWNER ⚡
        if (platformFee > 0) {
            if (_token == PaymentToken.ETH) {
                payable(owner()).transfer(platformFee);
            } else if (_token == PaymentToken.USDT) {
                USDT.safeTransfer(owner(), platformFee);
            } else if (_token == PaymentToken.USDC) {
                USDC.safeTransfer(owner(), platformFee);
            }
        }

        // Create transaction record
        _transactionIdCounter.increment();
        uint256 transactionId = _transactionIdCounter.current();

        transactions[transactionId] = Transaction({
            id: transactionId,
            productId: _productId,
            buyer: msg.sender,
            merchant: product.merchant,
            token: _token,
            amount: _amount,
            platformFee: platformFee,
            merchantAmount: merchantAmount,
            timestamp: block.timestamp,
            ipfsHash: _ipfsHash,
            processed: false
        });

        allTransactions.push(transactionId);

        // Update product analytics
        product.totalSales++;
        product.totalRevenue += _amount;

        // Update merchant analytics
        MerchantAnalytics storage merchantStats = merchantAnalytics[product.merchant];
        merchantStats.totalTransactions++;
        merchantStats.totalRevenue += merchantAmount;
        merchantStats.revenueByToken[_token] += merchantAmount;
        
        uint256 today = block.timestamp / 1 days;
        merchantStats.dailyRevenue[today] += merchantAmount;

        // Update platform analytics
        platformAnalytics.totalTransactions++;
        platformAnalytics.totalRevenue += platformFee;
        platformAnalytics.volumeByToken[_token] += _amount;
        platformAnalytics.dailyVolume[today] += _amount;

        // Add to pending payouts (only merchant amount)
        pendingPayouts[product.merchant][_token] += merchantAmount;

        emit PaymentReceived(transactionId, _productId, msg.sender, _token, _amount);
    }

    // Payout Functions
    function processPayout(address _merchant, PaymentToken _token) external nonReentrant {
        require(_merchant != address(0), "Invalid merchant address");
        
        MerchantAnalytics storage merchantStats = merchantAnalytics[_merchant];
        require(block.timestamp >= merchantStats.lastPayoutTime + PAYOUT_INTERVAL, "Payout interval not reached");
        
        uint256 payoutAmount = pendingPayouts[_merchant][_token];
        require(payoutAmount > 0, "No pending payout");

        pendingPayouts[_merchant][_token] = 0;
        merchantStats.lastPayoutTime = block.timestamp;

        // Transfer payout
        if (_token == PaymentToken.ETH) {
            payable(_merchant).transfer(payoutAmount);
        } else if (_token == PaymentToken.USDT) {
            USDT.safeTransfer(_merchant, payoutAmount);
        } else if (_token == PaymentToken.USDC) {
            USDC.safeTransfer(_merchant, payoutAmount);
        }

        // Record payout
        PayoutRecord memory payout = PayoutRecord({
            merchant: _merchant,
            amount: payoutAmount,
            token: _token,
            timestamp: block.timestamp,
            transactionIds: new uint256[](0)
        });
        
        payoutHistory.push(payout);

        emit PayoutProcessed(_merchant, _token, payoutAmount, block.timestamp);
    }

    function batchProcessPayouts(address[] calldata _merchants, PaymentToken _token) external onlyOwner {
        for (uint256 i = 0; i < _merchants.length; i++) {
            if (pendingPayouts[_merchants[i]][_token] > 0 && 
                block.timestamp >= merchantAnalytics[_merchants[i]].lastPayoutTime + PAYOUT_INTERVAL) {
                this.processPayout(_merchants[i], _token);
            }
        }
    }

    // Analytics Functions
    function getMerchantAnalytics(address _merchant) external view returns (
        uint256 totalTransactions,
        uint256 totalRevenue,
        uint256 totalProducts,
        uint256 lastPayoutTime,
        uint256 ethRevenue,
        uint256 usdtRevenue,
        uint256 usdcRevenue
    ) {
        MerchantAnalytics storage stats = merchantAnalytics[_merchant];
        return (
            stats.totalTransactions,
            stats.totalRevenue,
            stats.totalProducts,
            stats.lastPayoutTime,
            stats.revenueByToken[PaymentToken.ETH],
            stats.revenueByToken[PaymentToken.USDT],
            stats.revenueByToken[PaymentToken.USDC]
        );
    }

    function getPlatformAnalytics() external view returns (
        uint256 totalTransactions,
        uint256 totalRevenue,
        uint256 totalMerchants,
        uint256 totalProducts,
        uint256 ethVolume,
        uint256 usdtVolume,
        uint256 usdcVolume
    ) {
        return (
            platformAnalytics.totalTransactions,
            platformAnalytics.totalRevenue,
            platformAnalytics.totalMerchants,
            platformAnalytics.totalProducts,
            platformAnalytics.volumeByToken[PaymentToken.ETH],
            platformAnalytics.volumeByToken[PaymentToken.USDT],
            platformAnalytics.volumeByToken[PaymentToken.USDC]
        );
    }

    function getDailyRevenue(address _merchant, uint256 _timestamp) external view returns (uint256) {
        uint256 day = _timestamp / 1 days;
        return merchantAnalytics[_merchant].dailyRevenue[day];
    }

    function getDailyVolume(uint256 _timestamp) external view returns (uint256) {
        uint256 day = _timestamp / 1 days;
        return platformAnalytics.dailyVolume[day];
    }

    // Administrative Functions
    function addReviewer(address _reviewer) external onlyOwner {
        authorizedReviewers[_reviewer] = true;
        emit ReviewerAdded(_reviewer);
    }

    function removeReviewer(address _reviewer) external onlyOwner {
        authorizedReviewers[_reviewer] = false;
        emit ReviewerRemoved(_reviewer);
    }

    function updatePlatformFee(uint256 _newFeeRate) external onlyOwner {
        require(_newFeeRate <= MAX_FEE_RATE, "Fee rate too high");
        platformFeeRate = _newFeeRate;
        emit PlatformFeeUpdated(_newFeeRate);
    }

    function withdrawPlatformFees(PaymentToken _token, uint256 _amount) external onlyOwner {
        if (_token == PaymentToken.ETH) {
            require(address(this).balance >= _amount, "Insufficient balance");
            payable(owner()).transfer(_amount);
        } else if (_token == PaymentToken.USDT) {
            USDT.safeTransfer(owner(), _amount);
        } else if (_token == PaymentToken.USDC) {
            USDC.safeTransfer(owner(), _amount);
        }
    }

    function emergencyPause() external onlyOwner {
        _pause();
    }

    function emergencyUnpause() external onlyOwner {
        _unpause();
    }

    // View Functions
    function getKYCUsers() external view returns (address[] memory) {
        return kycUsers;
    }

    function getAllProducts() external view returns (uint256[] memory) {
        return allProducts;
    }

    function getAllTransactions() external view returns (uint256[] memory) {
        return allTransactions;
    }

    function getMerchantProducts(address _merchant) external view returns (uint256[] memory) {
        uint256[] memory merchantProducts = new uint256[](allProducts.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < allProducts.length; i++) {
            if (products[allProducts[i]].merchant == _merchant) {
                merchantProducts[count] = allProducts[i];
                count++;
            }
        }
        
        // Resize array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = merchantProducts[i];
        }
        
        return result;
    }

    function getPendingPayouts(address _merchant) external view returns (
        uint256 ethAmount,
        uint256 usdtAmount,
        uint256 usdcAmount
    ) {
        return (
            pendingPayouts[_merchant][PaymentToken.ETH],
            pendingPayouts[_merchant][PaymentToken.USDT],
            pendingPayouts[_merchant][PaymentToken.USDC]
        );
    }

    function getPayoutHistory() external view returns (PayoutRecord[] memory) {
        return payoutHistory;
    }

    /// Fallback function to receive ETH
    receive() external payable {}
}