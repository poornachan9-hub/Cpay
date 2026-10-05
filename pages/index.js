import React from "react";
import Head from "next/head";
import dynamic from "next/dynamic";

// Three.js / GSAP use browser APIs — must be dynamically imported with SSR disabled
const ScrollHero = dynamic(() => import("../components/ui/ethereal"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#050507",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "3px solid rgba(99,102,241,0.2)",
          borderTopColor: "#6366f1",
          animation: "spin 0.9s linear infinite",
        }}
      />
      <p
        style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        Loading
      </p>
    </div>
  ),
});

export default function Home() {
  return (
    <>
      <Head>
        <title>CryptoPay – Seamless Crypto Payments</title>
        <meta
          name="description"
          content="Accept cryptocurrency payments with enterprise-grade security. Lightning-fast settlements. Simple integration."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <ScrollHero
        sections={[
          {
            id: "hero",
            headline: "Seamless",
            subheadline: "Crypto Payments",
            body: "Accept cryptocurrency payments with enterprise-grade security. Lightning-fast settlements. Simple integration.",
          },
          {
            id: "features",
            headline: "Enterprise",
            subheadline: "Grade Security",
            body: "Bank-level encryption and multi-signature wallets safeguard every transaction on-chain.",
          },
          {
            id: "developers",
            headline: "Lightning",
            subheadline: "Fast Settlements",
            body: "Sub-second finality on Polygon — your funds arrive before the coffee cools.",
          },
          {
            id: "enterprise",
            headline: "Launch",
            subheadline: "Dashboard",
            body: "Everything you need to manage payments, payouts and analytics — all in one place.",
          },
        ]}
        colorPalette={{
          primary: "#6366f1",
          secondary: "#8b5cf6",
          tertiary: "#ec4899",
          accent: "#06ffa5",
          dark: "#050507",
        }}
        logo="CryptoPay"
        menuItems={["Features", "Developers", "Enterprise", "Dashboard"]}
      />
    </>
  );
}
