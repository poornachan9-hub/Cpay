// test-rpc.js — find a working Polygon RPC
const https = require("https");

const rpcs = [
  "https://rpc-mainnet.matic.network",
  "https://rpc-mainnet.maticvigil.com",
  "https://poly-rpc.gateway.pokt.network",
  "https://rpc.ankr.com/polygon",
  "https://polygon.llamarpc.com",
  "https://polygon-bor-rpc.publicnode.com",
  "https://1rpc.io/matic",
  "https://endpoints.omniatech.io/v1/matic/mainnet/public",
];

const payload = JSON.stringify({
  jsonrpc: "2.0",
  method: "eth_blockNumber",
  params: [],
  id: 1,
});

let done = 0;

rpcs.forEach((rpcUrl) => {
  try {
    const u = new URL(rpcUrl);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + (u.search || ""),
      method: "POST",
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };
    const req = https.request(opts, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        done++;
        const snippet = body.substring(0, 100).replace(/\n/g, " ");
        console.log("[" + res.statusCode + "] " + rpcUrl + " => " + snippet);
        if (done === rpcs.length) {
          console.log("Done.");
        }
      });
    });
    req.on("timeout", () => {
      done++;
      console.log("[TIMEOUT] " + rpcUrl);
      req.destroy();
    });
    req.on("error", (e) => {
      done++;
      console.log("[ERROR] " + rpcUrl + " => " + e.message);
    });
    req.write(payload);
    req.end();
  } catch (e) {
    done++;
    console.log("[PARSE ERROR] " + rpcUrl + " => " + e.message);
  }
});
