# SolanaLog-X 🔍 (v2.0 Modular Enterprise Edition)

A high-performance, low-latency TypeScript CLI tool designed to stream, parse, and analyze real-time Solana RPC program logs via WebSockets. Built with a production-ready, decoupled architecture to ensure maximum fault tolerance and scalability.

## 🚀 Key Features

- **Live WebSocket Streaming:** Connects directly to Solana Devnet using `@solana/web3.js` subscriptions (`onLogs`) with an automated **reconnection engine** to survive RPC drops.
- **Performance Profiling:** Extracts and calculates Compute Budget consumption percentages dynamically via regex parsers.
- **Advanced CLI Filtering:** Minimize terminal noise by targeting exactly what you need using custom runtime flags.
- **Persistent Production Logging:** Safely pipes critical transaction data to disk with an integrated **log rotation mechanism** capped at 50KB to protect host storage.
- **Session Telemetry:** Tracks processing metrics and generates an analytical dashboard summary upon user termination.

---

## 📁 Architecture Overview

The codebase is split into decoupled, single-responsibility modules under the `src/` directory to maintain enterprise-grade testability and structure:

* **`index.ts`**: The central orchestration engine managing the WebSocket life cycle and system signals.
* **`src/Config.ts`**: Centralized configuration management handling environment variables, sizing thresholds, and CLI flags.
* **`src/Parser.ts`**: High-performance log extraction module utilizing strict evaluation regex patterns.
* **`src/Logger.ts`**: IO-safe file-handling layer managing persistent file appending and automated log-rotation archives.
* **`src/Telemetry.ts`**: Session state machine collecting live operational data and formatting the final performance summary.

---

## ⚙️ Installation & Setup

1. **Clone the repository and install dependencies:**
   ```bash
   npm install

```

2. **Configure Environment Variables:**
Create a `.env` file in the root directory:
```env
SOLANA_RPC_URL=[https://api.devnet.solana.com](https://api.devnet.solana.com)

```


3. **Run the Analyzer:**
```bash
# Stream all transactions (Standard)
npx ts-node index.ts

# Stream ONLY failed contract executions
npx ts-node index.ts --errors

# Stream ONLY resource-heavy transactions (>80% CUs used)
npx ts-node index.ts --heavy

```



---

## 📊 Outputs & Artifacts

* **Console UI:** Visually colored CLI blocks (powered by `chalk`) explicitly isolating slot metrics, transaction signatures, and compute limits.
* **File System:** Generates `solanalog-x.log`. Upon crossing the 50KB safety threshold, the system automatically cycles the file out into `solanalog-x.old.log` to retain diagnostic history without leaking storage.

```