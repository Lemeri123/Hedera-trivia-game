# Hash Gordon's Blockchain Bonanza 🎰

A fun, interactive Hedera trivia game agent built on the [Hedera Agent Kit](https://portal.hedera.com/agent-lab). Test your Hedera knowledge, put real HBAR on the line, and win double your money if you get it right.

## What It Does

Hash Gordon is an AI-powered game-show host that runs a live trivia game in your terminal. Every round:

1. You pay a **1 HBAR entry fee** — a real on-chain transfer to the prize pool account
2. The AI generates a **fresh Hedera trivia question** (consensus, HTS, HCS, governance, and more)
3. Answer correctly → **win 2 HBAR back**, sent on-chain from the prize pool to your wallet
4. Answer incorrectly → the entry fee stays in the prize pool, and Hash Gordon explains the answer

Every transaction is a real HBAR transfer on Hedera testnet with a verifiable Transaction ID.


- **Real on-chain transactions** — not simulated. Every entry fee and payout is a live Hedera transfer
- **AI-generated questions** — infinite variety, always fresh, Hedera-focused
- **Conversational agent** — talk to Hash Gordon naturally, ask for hints, check your balance, ask about Hedera
- **Built on Hedera Agent Kit** — uses `TRANSFER_HBAR_TOOL` and `GET_HBAR_BALANCE_QUERY_TOOL` from the official toolkit

## Tech Stack

- [Hedera Agent Kit](https://github.com/hashgraph/hedera-agent-kit) — Hedera tools for LangChain agents
- [LangChain](https://js.langchain.com) + [LangGraph](https://langchain-ai.github.io/langgraphjs/) — agent orchestration
- [Groq](https://console.groq.com) (llama-3.1-8b-instant) — fast, free LLM for question generation and conversation
- [Hedera JS SDK](https://github.com/hashgraph/hedera-sdk-js) — direct transaction signing
- Node.js 22+

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd hedera-agent
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `HEDERA_ACCOUNT_ID` | Yes | Your Hedera testnet account (e.g. `0.0.12345`) |
| `HEDERA_PRIVATE_KEY` | Yes | DER-encoded private key for your account |
| `PRIZE_POOL_ACCOUNT_ID` | Yes | A second Hedera account that holds the prize pool |
| `PRIZE_POOL_PRIVATE_KEY` | Yes | DER-encoded private key for the prize pool account |
| `GROQ_API_KEY` | Yes | Free API key from [console.groq.com](https://console.groq.com) |
| `HEDERA_NETWORK` | No | `testnet` (default), `mainnet`, or `previewnet` |
| `ENTRY_FEE_HBAR` | No | Entry fee per round (default: `1`) |
| `PAYOUT_MULTIPLIER` | No | Payout multiplier on correct answer (default: `2`) |

Get free testnet accounts and HBAR at [portal.hedera.com](https://portal.hedera.com).  
Get a free Groq API key at [console.groq.com](https://console.groq.com).

### 3. Fund the prize pool

Make sure your prize pool account has enough HBAR to cover payouts. For 25 rounds at 2x payout, you need ~50 HBAR in the prize pool.

### 4. Run

```bash
npm start
```

## How to Play

```
Type anything to chat | "play" to start | "score" | "history" | "exit"
```

| Command | What it does |
|---|---|
| `play` | Start a new round (pays entry fee on-chain) |
| `score` / `stats` | See your session win/loss record |
| `history` | See all round receipts with transaction IDs |
| `hint` | Get a clue for the current question |
| `exit` / `quit` | End the session with a final score |

You can also just talk to Hash Gordon naturally — ask about Hedera, check your balance, or just chat.

## Example Session

```
🎰 ============================================ 🎰
   Welcome to HASH GORDON'S BLOCKCHAIN BONANZA!
🎰 ============================================ 🎰

💰 Entry fee: 1 HBAR  |  🏆 Payout: 2 HBAR

You: play
💰 Entry fee: 1 HBAR. Ready to play? (yes/no): yes
⏳ Paying entry fee on-chain...
Hash Gordon: Boom! 1 HBAR locked in — Tx: 0.0.6456650@1779182702.847391208
✅ Entry fee paid!

🤔 Generating your question...

❓ What consensus algorithm does Hedera use?
   A) Proof of Work
   B) Proof of Stake
   C) Hashgraph
   D) Delegated BFT

You: C
✅ CORRECT! Sending your winnings...
Hash Gordon: Hash-tastic! 2 HBAR incoming — Tx: 0.0.8895143@1779182750.123456789
🧾 RECEIPT | WIN🏆 | 2 HBAR | Tx: 0.0.8895143@1779182750.123456789
```

## Project Structure

```
agent.js          # Main agent — REPL loop, game flow, Hedera transfers
config.js         # Environment variable loading and validation
gameState.js      # Session state, receipts, stats helpers
systemPrompt.js   # Hash Gordon persona prompt
.env.example      # Environment variable template
```

## Built For

[Hedera Agent Kit Hackathon](https://ai-bounties.hedera.com/#submit) — demonstrating a real commercial interaction using the Hedera Agent Kit with on-chain HBAR payments.
