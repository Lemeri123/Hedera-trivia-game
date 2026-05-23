# Hash Gordon's Blockchain Bonanza 🎰

A fun, interactive Hedera trivia game agent built on the [Hedera Agent Kit](https://github.com/hashgraph/hedera-agent-kit-js). Test your Hedera knowledge, put real HBAR on the line, and win double your money if you get it right.

## What It Does

Hash Gordon is an AI-powered agent that runs a live trivia game in your terminal. Every round involves a real HBAR transactions on the Hedera testnet (or mainnet). The agent handles everything i.e entry fees, payouts and balance checks using the Hedera Agent Kit's LangChain integration.

### How a Round Works

1. Type `play` and Hash Gordon asks if you're ready
2. Confirm and the agent executes a real **entry fee transfer** (1 HBAR from your wallet to the prize pool) on-chain
3. The AI generates a fresh **Hedera trivia question**  covering consensus, HTS, HCS, governance, fees, and more basing on Hedera
4. Answer correctly and the agent executes a real **payout transfer** (2 HBAR from the prize pool back to your wallet)
5. Answer incorrectly and the entry fee stays in the prize pool, and Hash Gordon explains the correct answer

Every transaction produces a real Hedera Transaction ID you can verify on [HashScan](https://hashscan.io).

---


- **Real on-chain transactions**: Every entry fee and payout is a live Hedera transfer signed and submitted to the network
- **Agent handles ALL transactions**: The Hedera Agent Kit's `TRANSFER_HBAR_TOOL` is used for both entry fees and payouts
- **AI-generated questions**: Infinite variety, always fresh, always Hedera focused
- **Conversational agent**: Talk to Hash Gordon naturally. Ask for hints, check your balance, ask about Hedera concepts, or just chat casually
- **Built on official Hedera Agent Kit** — uses `coreAccountPlugin`, `coreAccountQueryPlugin`, `TRANSFER_HBAR_TOOL`, and `GET_HBAR_BALANCE_QUERY_TOOL`

---

## Tech Stack

| Component | Technology |
|---|---|
| Blockchain | [Hedera Testnet](https://hedera.com) |
| Agent Framework | [Hedera Agent Kit](https://github.com/hashgraph/hedera-agent-kit) + [LangChain](https://js.langchain.com) |
| Agent Orchestration | [LangGraph](https://langchain-ai.github.io/langgraphjs/) with MemorySaver |
| LLM | [Groq](https://console.groq.com) — `llama-3.1-8b-instant` (free tier) |
| Hedera SDK | [@hiero-ledger/sdk](https://github.com/hashgraph/hedera-sdk-js) |
| Runtime | Node.js 22+ |

---

## Prerequisites

- Node.js 22 or higher
- Two Hedera testnet accounts (player wallet + prize pool)
- A free [Groq API key](https://console.groq.com) (or OpenAI key with credits)

---

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/Lemeri123/Hedera-trivia-game.git
cd Hedera-trivia-game
npm install
```

### 2. Create your environment file

```bash
cp .env.example .env
```

### 3. Configure your `.env`

Open `.env` and fill in all required values:

```env
# LLM Provider
GROQ_API_KEY=gsk_...          # Free at https://console.groq.com

# Player account (your wallet — pays entry fees, receives payouts)
HEDERA_ACCOUNT_ID=0.0.XXXXX
HEDERA_PRIVATE_KEY=302...     # DER-encoded private key (ECDSA or ED25519)

# Prize pool account (collects entry fees, funds payouts)
PRIZE_POOL_ACCOUNT_ID=0.0.YYYYY
PRIZE_POOL_PRIVATE_KEY=302... # DER-encoded private key for the prize pool

# Network
HEDERA_NETWORK=testnet        # testnet | mainnet | previewnet

# Game economics (optional — defaults shown)
ENTRY_FEE_HBAR=1
PAYOUT_MULTIPLIER=2
```

### 4. Get testnet accounts and HBAR

1. Go to [portal.hedera.com](https://portal.hedera.com)
2. Create two testnet accounts
4. Copy the **DER Encoded Private Key** for each account (found under "More Details")
5. Fund the prize pool with at least 50 HBAR (covers ~25 winning rounds at 2x payout)

### 5. Get a free Groq API key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free, no credit card)
3. Create an API key and paste it into `.env`

### 6. Run the game

```bash
npm start
```

---

## How to Play

```
🎰 ============================================ 🎰
   Welcome to HASH GORDON'S BLOCKCHAIN BONANZA!
🎰 ============================================ 🎰

💰 Entry fee: 1 HBAR  |  🏆 Payout: 2 HBAR
🏦 Prize Pool: 0.0.YYYYY

Type anything to chat | "play" to start | "score" | "history" | "exit"
```

### Commands

| Input | What happens |
|---|---|
| `play` | Start a new round |
| `A` / `B` / `C` / `D` | Answer the current question |
| `hint` | Get a clue for the current question |
| `score` or `stats` | See your session win/loss record and net HBAR |
| `history` | See all round receipts with transaction IDs |
| `exit` or `quit` | End the session with a final score summary |
| Anything else | Chat with Hash Gordon, ask about Hedera, check your balance, etc. |

### Example Session

```
You: play
💰 Entry fee: 1 HBAR. Ready to play? (yes/no): yes

⏳ Paying entry fee via agent on-chain...
Hash Gordon: Done! 1 HBAR transferred. Tx: 0.0.6456650@1779304461.216862329
✅ Entry fee paid! Tx: 0.0.6456650@1779304461.216862329

🤔 Generating your question...

❓ What consensus algorithm does Hedera use?
   A) Proof of Work
   B) Proof of Stake
   C) Hashgraph
   D) Delegated BFT

You: C
✅ CORRECT! Hash-tastic! You're on fire! 🔥

🏆 Processing payout via agent...
Hash Gordon: 2 HBAR sent to your wallet! Tx: 0.0.8895143@1779304523.444576400
🧾 RECEIPT | WIN🏆 | 2 HBAR | Tx: 0.0.8895143@1779304523.444576400

You: score
📊 SESSION STATS
   🏆 Wins:          1
   💸 Losses:        0
   💰 Total wagered: 1 HBAR
   📈 Net result:    +1.00 HBAR
```

---

## Project Structure

```
agent.js          # Main agent — REPL loop, game flow, all Hedera transactions
config.js         # Environment variable loading and validation
gameState.js      # Session state, receipts, stats, and display helpers
systemPrompt.js   # Hash Gordon persona system prompt builder
.env.example      # Environment variable template with descriptions
```

### How the Agent Handles Transactions

The agent uses the Hedera Agent Kit's `TRANSFER_HBAR_TOOL` for all on-chain actions:

- **Entry fee**: Client operator is set to the player account and the agent calls `TRANSFER_HBAR_TOOL` to send HBAR to the prize pool
- **Payout**: Client operator is switched to the prize pool account and the agent calls `TRANSFER_HBAR_TOOL` to send HBAR back to the player. Operator is restored after this
- **Balance checks**: Agent calls `GET_HBAR_BALANCE_QUERY_TOOL` for the player account

---

## Switching AI

The game currently uses Groq (free). But you can as well switch to your preferable AI option

---

## Verifying Transactions

All transactions can be verified on HashScan:
- Testnet: [https://hashscan.io/testnet](https://hashscan.io/testnet)
- Search by Transaction ID (format: `0.0.XXXXX@timestamp`)
