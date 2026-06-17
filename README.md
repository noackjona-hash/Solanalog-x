# SolanaLog-X 🔍

A high-performance, low-latency TypeScript CLI tool designed to stream, parse, and analyze real-time Solana RPC program logs via WebSockets. 

## Features
- **Live Streaming:** Connects directly to Solana Devnet using `@solana/web3.js` WebSocket subscriptions (`onLogs`).
- **Performance Profiling:** Extracts and calculates Compute Budget consumption percentages in real-time.
- **Crash Detection:** Isolates custom program errors and resource exhaustion (`exceeded CUs`) instantly.
- **Clean Layout:** Interactive, color-coded terminal dashboard utilizing `chalk`.

## Installation & Setup

1. Clone the repository and install dependencies:
```bash
npm install

```

2. Run the analyzer locally:

```bash
npx ts-node index.ts

```

```
