import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { FiActivity, FiBarChart2, FiBriefcase, FiClock, FiCpu, FiDollarSign, FiRefreshCw, FiShield, FiTrendingUp } from "react-icons/fi";
import InstallmentPredictionCard from "./InstallmentPredictionCard";
import MicroLoanForm from "./MicroLoanForm";

const SECTIONS = [
  ["overview", "Overview", FiBriefcase],
  ["markets", "Markets", FiBarChart2],
  ["borrow", "Borrow", FiDollarSign],
  ["lend", "Lend & Earn", FiTrendingUp],
  ["history", "History", FiClock],
  ["crop", "Loan position", FiActivity],
  ["model", "AI Model", FiCpu],
];

const ASSETS = [
  { symbol: "ETH", id: "ethereum", name: "Ethereum", supply: 2.1, borrow: 3.2, ltv: 60, liquidation: 80 },
  { symbol: "WBTC", id: "wrapped-bitcoin", name: "Wrapped Bitcoin", supply: 1.8, borrow: 2.9, ltv: 60, liquidation: 80 },
  { symbol: "USDC", id: "usd-coin", name: "USD Coin", supply: 4.5, borrow: 5.1, ltv: 80, liquidation: 90 },
  { symbol: "DAI", id: "dai", name: "Dai", supply: 4.2, borrow: 4.8, ltv: 75, liquidation: 85 },
  { symbol: "LINK", id: "chainlink", name: "Chainlink", supply: 1.4, borrow: 2.2, ltv: 50, liquidation: 70 },
];

const INITIAL_PRICES = { ETH: 3200, WBTC: 65000, USDC: 1, DAI: 1, LINK: 14 };
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

function Panel({ children, className = "" }) {
  return <section className={`rounded-xl border border-white/10 bg-white/[0.035] p-5 ${className}`}>{children}</section>;
}

function Metric({ label, value, detail, tone = "text-white" }) {
  return (
    <Panel>
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
    </Panel>
  );
}

function Overview({ setSection }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Loan portfolio</h2>
          <p className="mt-1 text-sm text-gray-400">Collateral, borrowing capacity, and lending estimates.</p>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">SAMPLE PORTFOLIO</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Collateral value" value="$27,200" detail="8.5 ETH · sample data" tone="text-sky-300" />
        <Metric label="Borrowed" value="$4,500" detail="USDC · sample data" tone="text-violet-300" />
        <Metric label="Available to borrow" value="$25,000" detail="Illustrative credit limit" tone="text-emerald-300" />
        <Metric label="Health factor" value="4.80" detail="Sample position · safe" tone="text-emerald-300" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h3 className="font-semibold text-white">Position health</h3>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[72%] rounded-full bg-emerald-400" /></div>
          <div className="mt-2 flex justify-between text-xs text-gray-500"><span>Liquidation 1.0</span><span>Warning 1.5</span><span>Sample: 4.8</span></div>
          <p className="mt-4 text-sm text-gray-400">This overview uses example values from the supplied loan-settings demo. Your on-chain loan position is shown in the loan section.</p>
        </Panel>
        <Panel>
          <h3 className="font-semibold text-white">Estimated yield</h3>
          <p className="mt-3 text-3xl font-bold text-emerald-300">5.2% <span className="text-sm font-medium text-gray-400">sample net APY</span></p>
          <p className="mt-2 text-sm text-gray-400">Estimated on the sample portfolio only. Rates and earnings here are not live lending offers.</p>
          <button type="button" onClick={() => setSection("lend")} className="mt-4 text-sm font-semibold text-sky-300 hover:text-sky-200">View lending estimates</button>
        </Panel>
      </div>
    </div>
  );
}

function Markets({ prices, pricesLoading, refreshPrices }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold text-white">Markets</h2><p className="mt-1 text-sm text-gray-400">Asset prices and illustrative supply and borrow rates.</p></div>
        <button type="button" onClick={refreshPrices} disabled={pricesLoading} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-50"><FiRefreshCw className={pricesLoading ? "animate-spin" : ""} />Refresh prices</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase text-gray-500"><tr>{["Asset", "Price", "Supply APY*", "Borrow APR*", "Max LTV", "Liquidation"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody>{ASSETS.map((asset) => <tr key={asset.symbol} className="border-t border-white/5 text-gray-300"><td className="px-4 py-4"><span className="font-semibold text-white">{asset.name}</span><span className="ml-2 text-xs text-gray-500">{asset.symbol}</span></td><td className="px-4 py-4">{prices[asset.symbol] ? `$${Number(prices[asset.symbol]).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "Unavailable"}</td><td className="px-4 py-4 text-emerald-300">{asset.supply.toFixed(1)}%</td><td className="px-4 py-4 text-amber-300">{asset.borrow.toFixed(1)}%</td><td className="px-4 py-4">{asset.ltv}%</td><td className="px-4 py-4">{asset.liquidation}%</td></tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">* Rate, LTV, and liquidation figures are illustrative demo values. Prices are fetched from CoinGecko when available.</p>
    </div>
  );
}

function BorrowTools({ prices, setSection }) {
  const [action, setAction] = useState("borrow");
  const [asset, setAsset] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState(6);
  const collateralValue = (Number(amount) || 0) * (prices[asset] || INITIAL_PRICES[asset]);
  const borrowLimit = collateralValue * ((ASSETS.find((item) => item.symbol === asset)?.ltv || 60) / 100);
  const monthlyPayment = (Number(amount) || 0) * (1 + 0.051 * term / 12) / term;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <div><h2 className="text-xl font-bold text-white">Borrow & manage</h2><p className="mt-1 text-sm text-gray-400">Review collateral and repayment estimates. This market preview does not submit transactions.</p></div>
        <Panel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["deposit", "Deposit"], ["withdraw", "Withdraw"], ["borrow", "Borrow"], ["repay", "Repay"]].map(([key, label]) => <button key={key} type="button" onClick={() => setAction(key)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${action === key ? "bg-sky-400/15 text-sky-200" : "bg-white/[0.04] text-gray-400 hover:text-white"}`}>{label}</button>)}</div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-gray-400">Asset<select value={asset} onChange={(event) => setAsset(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#10131c] px-3 py-3 text-white">{ASSETS.map((item) => <option key={item.symbol} value={item.symbol}>{item.name} ({item.symbol})</option>)}</select></label>
            <label className="space-y-2 text-sm text-gray-400">{action === "borrow" || action === "repay" ? "Amount (USD)" : `Amount (${asset})`}<input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-white" /></label>
          </div>
          {action === "borrow" && <label className="mt-4 block space-y-2 text-sm text-gray-400">Repayment term: {term} months<input type="range" min="1" max="12" value={term} onChange={(event) => setTerm(Number(event.target.value))} className="w-full accent-sky-400" /></label>}
          <div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Collateral value" value={`$${collateralValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} /><Metric label="Indicative borrow limit" value={`$${borrowLimit.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} /><Metric label="Est. monthly payment" value={`$${monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} /></div>
          <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3 text-sm text-amber-100">Preview only. Use the loan section below for the app’s existing on-chain loan flow.</div>
          <button type="button" onClick={() => setSection("crop")} className="mt-4 rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-300">Open loan position</button>
        </Panel>
      </div>
      <Panel className="h-fit"><h3 className="font-semibold text-white">Sample position</h3><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between text-gray-400"><span>Collateral</span><span className="text-white">$27,200</span></div><div className="flex justify-between text-gray-400"><span>Borrowed</span><span className="text-white">$4,500</span></div><div className="flex justify-between text-gray-400"><span>Health factor</span><span className="text-emerald-300">4.80 · Safe</span></div><div className="flex justify-between text-gray-400"><span>Indicative APR</span><span className="text-white">5.1%</span></div></div><p className="mt-4 border-t border-white/10 pt-4 text-xs text-gray-500">Values shown here are samples; they are not read from your wallet or a lending protocol.</p></Panel>
    </div>
  );
}

function LendEstimates() {
  const [collateral, setCollateral] = useState(27200);
  const apy = 5.2;
  const yearly = (Number(collateral) || 0) * apy / 100;
  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-bold text-white">Lend & earn</h2><p className="mt-1 text-sm text-gray-400">Review example APY breakdowns and projected yield.</p></div>
      <div className="grid gap-3 sm:grid-cols-3"><Metric label="Sample total earned" value="$245.00" detail="Example only" tone="text-emerald-300" /><Metric label="Sample claimable rewards" value="$12.00" detail="Not claimable on-chain" tone="text-sky-300" /><Metric label="Net APY" value={`${apy.toFixed(1)}%`} detail="Illustrative rate" tone="text-emerald-300" /></div>
      <Panel>
        <label className="block max-w-sm space-y-2 text-sm text-gray-400">Collateral value used for estimate (USD)<input type="number" min="0" value={collateral} onChange={(event) => setCollateral(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-white" /></label>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">{[["Daily", yearly / 365], ["Monthly", yearly / 12], ["Yearly", yearly]].map(([label, value]) => <div key={label} className="rounded-lg bg-white/[0.04] p-4"><p className="text-xs text-gray-500">{label} estimate</p><p className="mt-2 text-xl font-bold text-emerald-300">${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>)}</div>
        <p className="mt-4 text-xs text-gray-500">Estimates use a fixed 5.2% demo rate. The supplied project does not connect yield claiming to a deployed contract.</p>
      </Panel>
      <Panel><h3 className="font-semibold text-white">Example APY breakdown</h3><div className="mt-3 divide-y divide-white/5">{[["ETH collateral", "2.1%", "3.1%", "5.2%"], ["USDC stablecoin", "4.5%", "0.5%", "5.0%"], ["WBTC collateral", "1.8%", "2.1%", "3.9%"]].map(([name, base, rewards, net]) => <div key={name} className="grid grid-cols-[1fr_repeat(3,64px)] gap-2 py-3 text-right text-sm"><span className="text-left text-gray-300">{name}</span><span className="text-gray-400">{base}</span><span className="text-sky-300">{rewards}</span><span className="text-emerald-300">{net}</span></div>)}</div><p className="mt-2 text-right text-[11px] text-gray-500">Base · rewards · net</p></Panel>
    </div>
  );
}

function LoanHistory({ address }) {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/loans?borrower=${encodeURIComponent(address)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load loan history.");
        if (!cancelled) setLoans(data.loans || []);
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-white">Loan history</h2><p className="mt-1 text-sm text-gray-400">Loan records associated with your connected wallet.</p></div><Link href="/transactions" className="text-sm font-semibold text-sky-300 hover:text-sky-200">Open all transactions</Link></div>
      {!address ? <Panel className="text-sm text-gray-400">Connect your wallet to load loan records.</Panel> : loading ? <Panel className="text-sm text-gray-400">Loading loan history...</Panel> : error ? <Panel className="text-sm text-amber-200">{error}</Panel> : loans.length === 0 ? <Panel className="text-sm text-gray-400">No saved loan records found for this wallet yet.</Panel> : (
        <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-white/[0.04] text-xs uppercase text-gray-500"><tr>{["Loan", "Amount", "Collateral", "Tx hash", "Status", "Due"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{loans.map((loan) => <tr key={loan.loan_id} className="border-t border-white/5 text-gray-300"><td className="px-4 py-3 font-mono text-xs">{loan.loan_id}</td><td className="px-4 py-3">${Number(loan.amount_usdc || 0).toLocaleString()} USDC</td><td className="px-4 py-3">{Number(loan.collateral_kg || 0).toLocaleString()} units</td><td className="px-4 py-3 font-mono text-xs" title={loan.tx_hash || "No hash saved"}>{loan.tx_hash ? `${loan.tx_hash.slice(0, 10)}…${loan.tx_hash.slice(-6)}` : "—"}</td><td className="px-4 py-3 capitalize">{loan.status || "unknown"}</td><td className="px-4 py-3">{loan.repay_by ? new Date(loan.repay_by).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

function InstallmentPrediction() {
  const [features, setFeatures] = useState({ credit_limit: 20000, age: 35, latest_payment_status: 0, average_prior_payment_status: 0, average_bill_amount: 15000, average_payment_amount: 3000 });
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fields = [["credit_limit", "Credit limit (NT$)", 1000, 10000, 1000000], ["age", "Age (21 to 79)", 1, 21, 79], ["latest_payment_status", "Latest payment status (-2 to 8)", 1, -2, 8], ["average_prior_payment_status", "Average prior payment status", 0.1, -2, 8], ["average_bill_amount", "Average monthly bill (NT$)", 1000, -200000, 2000000], ["average_payment_amount", "Average monthly payment (NT$)", 1000, 0, 2000000]];
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/credit-default-risk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(Object.entries(features).map(([key, value]) => [key, Number(value)]))) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Installment prediction failed.");
      setAssessment(result);
    } catch (requestError) {
      setAssessment({ error: requestError.message || "Could not reach the prediction service." });
      setError(requestError.message || "Could not reach the prediction service.");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-white">Credit-default model</h2><p className="mt-1 text-sm text-gray-400">Research demo trained on UCI credit-card repayment data; benchmark accuracy is about 79%.</p></div><Link href="/ai-analytics" className="text-sm font-semibold text-sky-300 hover:text-sky-200">View evaluation metrics</Link></div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
        <Panel><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label, step, min, max]) => <label key={key} className="space-y-2 text-sm text-gray-400">{label}<input type="number" min={min} max={max} step={step} required value={features[key]} onChange={(event) => setFeatures((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-white" /></label>)}</div><button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-300 disabled:opacity-50"><FiCpu />{loading ? "Evaluating..." : "Estimate default risk"}</button>{error && <p role="alert" className="text-sm text-amber-200">{error}</p>}</form></Panel>
        <div className="space-y-3"><InstallmentPredictionCard assessment={loading ? { loading: true } : assessment} /><p className="text-xs text-gray-500">This benchmark prediction is for model demonstration only. It is not based on the connected wallet or CryptoPay payment history.</p></div>
      </div>
    </div>
  );
}

export default function LoanFeaturesHub() {
  const [section, setSection] = useState("overview");
  const [prices, setPrices] = useState(INITIAL_PRICES);
  const [pricesLoading, setPricesLoading] = useState(false);
  const { address } = useAccount();
  const assetIds = useMemo(() => ASSETS.map((asset) => asset.id).join(","), []);

  const refreshPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${assetIds}&vs_currencies=usd`);
      if (!response.ok) throw new Error("Price feed unavailable");
      const data = await response.json();
      setPrices((current) => Object.fromEntries(ASSETS.map((asset) => [asset.symbol, data[asset.id]?.usd ?? current[asset.symbol]])));
    } catch (error) {
      console.warn("Loan market price refresh failed:", error);
    } finally { setPricesLoading(false); }
  }, [assetIds]);

  useEffect(() => { refreshPrices(); }, [refreshPrices]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-white">Loans</h1><p className="mt-1 text-gray-400">Loan dashboard, markets, earnings, activity, and model demos.</p></div>
        <Link href="/ai-analytics" className="inline-flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-400/15"><FiCpu />Prediction analytics</Link>
      </div>
      <div role="tablist" aria-label="Loan tools" className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2">
        {SECTIONS.map(([key, label, Icon]) => <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => setSection(key)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${section === key ? "bg-sky-400/15 text-sky-200" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>
      {section === "overview" && <Overview setSection={setSection} />}
      {section === "markets" && <Markets prices={prices} pricesLoading={pricesLoading} refreshPrices={refreshPrices} />}
      {section === "borrow" && <BorrowTools prices={prices} setSection={setSection} />}
      {section === "lend" && <LendEstimates />}
      {section === "history" && <LoanHistory address={address} />}
      {section === "crop" && <div className="space-y-5"><div><h2 className="text-xl font-bold text-white">On-chain loans</h2><p className="mt-1 text-sm text-gray-400">The existing wallet-connected loan form is preserved here.</p></div><MicroLoanForm /></div>}
      {section === "model" && <InstallmentPrediction />}
    </div>
  );
}