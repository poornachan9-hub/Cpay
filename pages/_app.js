import { useEffect, useState } from "react";
import Head from "next/head";
import "../styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "../lib/wagmi";

// Optimized QueryClient with caching configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes - stale time
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      cacheTime: 10 * 60 * 1000,
      // Don't refetch on window focus (reduces unnecessary calls)
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect
      refetchOnReconnect: false,
      // Retry failed requests once
      retry: 1,
      // Lazy query on mount
      lazy: true,
    },
  },
});

function MyApp({ Component, pageProps }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <Head>
        <title>CryptoPay Payment Gateway</title>
        <meta
          name="description"
          content="A powerful Web3 CryptoPay Payment Gateway DApp built with Next.js, RainbowKit, and Wagmi"
        />
        <link rel="icon" href="/logo.png" />
      </Head>
      {mounted ? (
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider
              theme={darkTheme({
                accentColor: "#1E121F",
                accentColorForeground: "white",
                borderRadius: "medium",
                fontStack: "system",
                overlayBlur: "small",
              })}
            >
              <Component {...pageProps} />
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      ) : (
        <div style={{ minHeight: '100vh', backgroundColor: '#140D19' }} />
      )}
    </>
  );
}

export default MyApp;
