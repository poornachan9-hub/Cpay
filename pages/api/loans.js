// pages/api/loans.js
// Crypto Lending API — Supabase CRUD + demo escrow simulation
//
// Endpoints:
//   GET  /api/loans?borrower=0x...          → list loans for borrower
//   GET  /api/loans?id=123                → single loan
//   GET  /api/loans?simulate=true&loanId=X → simulate escrow revenue
//   POST /api/loans                        → create loan record
//   PATCH /api/loans                       → update loan status

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mock crypto price table for demo escrow simulation
const CRYPTO_PRICES_USD = {
  bitcoin: 0.3,
  ethereum: 0.25,
  solana: 0.35,
  polkadot: 0.2,
  chainlink: 0.28,
};

function simulateEscrowRevenue(collateralKg) {
  // Randomly pick a crypto asset and calculate how much selling ~60% of collateral earns
  const assets = Object.keys(CRYPTO_PRICES_USD);
  const crypto = assets[Math.floor(Math.random() * assets.length)];
  const price = CRYPTO_PRICES_USD[crypto];
  const soldKg = collateralKg * 0.6;
  const revenueUSDC = parseFloat((soldKg * price).toFixed(2));
  return { crypto, soldKg: parseFloat(soldKg.toFixed(1)), revenueUSDC };
}

export default async function handler(req, res) {
  try {
    // ──────────────────────────────────────────────────────
    // GET
    // ──────────────────────────────────────────────────────
    if (req.method === "GET") {
      const { borrower, farmer, id, simulate, loanId } = req.query;

      // Demo escrow simulation
      if (simulate === "true" && loanId) {
        // Fetch loan details first
        const { data: loan, error } = await supabase
          .from("loans")
          .select("*")
          .eq("loan_id", loanId)
          .single();

        const collateralKg = loan?.collateral_kg || 200; // default demo
        const { crypto, soldKg, revenueUSDC } = simulateEscrowRevenue(parseFloat(collateralKg));

        return res.status(200).json({
          success: true,
          simulation: true,
          crypto,
          soldKg,
          revenueUSDC,
          message: `Escrow: Sold ${soldKg} units ${crypto} @ $${CRYPTO_PRICES_USD[crypto]}/unit → $${revenueUSDC} USDC credited`,
        });
      }

      // Single loan
      if (id) {
        const { data, error } = await supabase
          .from("loans")
          .select("*")
          .eq("loan_id", id)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            return res.status(404).json({ success: false, error: "Loan not found" });
          }
          throw error;
        }
        return res.status(200).json({ success: true, loan: data });
      }

      // All loans for borrower
      if (farmer) {
        const { data, error } = await supabase
          .from("loans")
          .select("*")
          .ilike("farmer_id", farmer)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return res.status(200).json({ success: true, loans: data });
      }

      // All loans (admin)
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return res.status(200).json({ success: true, loans: data });
    }

    // ──────────────────────────────────────────────────────
    // POST — create loan record (called after on-chain borrow)
    // ──────────────────────────────────────────────────────
    if (req.method === "POST") {
      const { simulate, loanId } = req.query;

      // POST simulate (from frontend LoanCard demo button)
      if (simulate === "true" && loanId) {
        const { data: loan } = await supabase
          .from("loans")
          .select("*")
          .eq("loan_id", loanId)
          .single();

        const collateralKg = loan?.collateral_kg || 200;
        const { crypto, soldKg, revenueUSDC } = simulateEscrowRevenue(parseFloat(collateralKg));

        return res.status(200).json({
          success: true,
          simulation: true,
          crypto,
          soldKg,
          revenueUSDC,
          message: `Simulated: sold ${soldKg} units ${crypto} → $${revenueUSDC} USDC available to repay`,
        });
      }

      const {
        loan_id,
        farmer_id,
        amount_usdc,
        collateral_kg,
        status = "active",
        repay_by,
        tx_hash,
      } = req.body;

      // Validate required fields
      if (!farmer_id) {
        return res.status(400).json({ success: false, error: "farmer_id is required" });
      }
      if (!amount_usdc || isNaN(Number(amount_usdc))) {
        return res.status(400).json({ success: false, error: "amount_usdc is required" });
      }
      if (!repay_by) {
        return res.status(400).json({ success: false, error: "repay_by is required" });
      }

      const { data, error } = await supabase
        .from("loans")
        .insert({
          loan_id: loan_id || `loan_${Date.now()}_${farmer_id.slice(2, 8)}`,
          farmer_id: farmer_id.toLowerCase(),
          amount_usdc: parseFloat(amount_usdc),
          collateral_kg: parseFloat(collateral_kg || 0),
          status,
          repay_by,
          tx_hash: tx_hash || null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(201).json({ success: true, loan: data });
    }

    // ──────────────────────────────────────────────────────
    // PATCH — update loan status
    // ──────────────────────────────────────────────────────
    if (req.method === "PATCH") {
      const { id, status, tx_hash } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, error: "id is required" });
      }
      if (!["active", "repaid", "liquidated"].includes(status)) {
        return res
          .status(400)
          .json({ success: false, error: "status must be active|repaid|liquidated" });
      }

      const updates = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (tx_hash) updates.tx_hash = tx_hash;

      const { data, error } = await supabase
        .from("loans")
        .update(updates)
        .eq("loan_id", id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, loan: data });
    }

    // ──────────────────────────────────────────────────────
    // DELETE — soft delete (security: owner only via service role)
    // ──────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ success: false, error: "id required" });
      }

      await supabase
        .from("loans")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("loan_id", id);

      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (err) {
    console.error("Loans API error:", err);
    return res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    });
  }
}
