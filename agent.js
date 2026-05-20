import dotenv from 'dotenv';
dotenv.config();

import { AgentMode } from '@hashgraph/hedera-agent-kit';
import {
  coreAccountPluginToolNames,
  coreAccountPlugin,
  coreAccountQueryPluginToolNames,
  coreAccountQueryPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
import { HederaLangchainToolkit, ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
import { Client, PrivateKey } from '@hiero-ledger/sdk';
import prompts from 'prompts';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { ChatGroq } from '@langchain/groq';

import { loadConfig } from './config.js';
import {
  createGameState,
  buildReceipt,
  updateStats,
  formatStats,
  formatReceipts,
  buildClosingMessage,
} from './gameState.js';

async function bootstrap() {
  const config = loadConfig();

  function getHederaClient() {
    if (config.network === 'mainnet') return Client.forMainnet();
    if (config.network === 'previewnet') return Client.forPreviewnet();
    return Client.forTestnet();
  }

  function parsePrivateKey(keyStr) {
    try { return PrivateKey.fromStringDer(keyStr); } catch (_) {}
    try { return PrivateKey.fromStringECDSA(keyStr); } catch (_) {}
    try { return PrivateKey.fromStringED25519(keyStr); } catch (_) {}
    throw new Error('Could not parse private key — check format');
  }

  const operatorKey = parsePrivateKey(config.operatorPrivateKey);
  let prizePoolKey = null;
  if (config.prizePoolPrivateKey) {
    try { prizePoolKey = parsePrivateKey(config.prizePoolPrivateKey); } catch (_) {
      console.warn('Warning: PRIZE_POOL_PRIVATE_KEY could not be parsed.');
    }
  }

  const client = getHederaClient().setOperator(config.operatorAccountId, operatorKey);

  const { TRANSFER_HBAR_TOOL } = coreAccountPluginToolNames;
  const { GET_HBAR_BALANCE_QUERY_TOOL } = coreAccountQueryPluginToolNames;

  // Build toolkit when switching operators for payout
  function buildToolkit(accountId) {
    return new HederaLangchainToolkit({
      client,
      configuration: {
        plugins: [coreAccountPlugin, coreAccountQueryPlugin],
        tools: [TRANSFER_HBAR_TOOL, GET_HBAR_BALANCE_QUERY_TOOL],
        context: { mode: AgentMode.AUTONOMOUS, accountId },
      },
    });
  }

  let toolkit = buildToolkit(config.operatorAccountId);
  let responseParserService = new ResponseParserService(toolkit.getTools());

  const memory = new MemorySaver();
  const agentConfig = { configurable: { thread_id: 'hash-gordon-trivia' } };
  const llm = new ChatGroq({ model: 'llama-3.1-8b-instant', apiKey: config.groqApiKey });

  const systemPrompt = `You are Hash Gordon, an enthusiastic blockchain game-show host.
You have ONLY two tools: TRANSFER_HBAR and GET_HBAR_BALANCE.
When told to transfer HBAR, call TRANSFER_HBAR immediately with the exact amounts given.
When told to check balance, call GET_HBAR_BALANCE.
For ALL other questions, answer from your own knowledge — NEVER call any other tool.
Keep responses short, punny, and energetic.`;

  let agent = createAgent({
    model: llm,
    tools: toolkit.getTools(),
    checkpointer: memory,
    stateModifier: systemPrompt,
  });

  // Switch the Hedera client operator and rebuild the agent with new toolkit
  function switchOperator(accountId, key) {
    client.setOperator(accountId, key);
    toolkit = buildToolkit(accountId);
    responseParserService = new ResponseParserService(toolkit.getTools());
    agent = createAgent({
      model: llm,
      tools: toolkit.getTools(),
      checkpointer: memory,
      stateModifier: systemPrompt,
    });
  }

  const gameState = createGameState();
  let lastCompletedRound = null;

  // Extract transaction ID from all possible locations in the response
  function extractTxId(toolCall, result) {
    if (!toolCall) return null;
    const candidates = [
      toolCall.transactionId,
      toolCall.result?.transactionId,
      toolCall.raw?.transactionId,
      toolCall.parsedData?.raw?.transactionId,
      toolCall.parsedData?.transactionId,
    ];
    for (const c of candidates) {
      if (c && typeof c === 'string') return c;
    }
    // Try extracting from tool message content
    for (const msg of (result?.messages ?? [])) {
      const content = typeof msg.content === 'string' ? msg.content : '';
      const match = content.match(/\b(\d+\.\d+\.\d+@\d+\.\d+)\b/);
      if (match) return match[1];
    }
    return null;
  }

  async function invokeAgent(userMessage) {
    const result = await agent.invoke(
      { messages: [{ role: 'user', content: userMessage }] },
      agentConfig,
    );
    const parsed = responseParserService.parseNewToolMessages(result);
    const toolCall = parsed[0] ?? null;
    const txId = extractTxId(toolCall, result);
    let text = '';
    for (let i = result.messages.length - 1; i >= 0; i--) {
      const msg = result.messages[i];
      const role = msg.role ?? msg._getType?.();
      if (role === 'assistant' || role === 'ai') {
        const content = typeof msg.content === 'string' ? msg.content : '';
        if (content) { text = content; break; }
      }
    }
    return { text, toolCall, txId };
  }

  // Question generation
  async function generateQuestion() {
    const topics = [
      'Hedera Hashgraph consensus algorithm',
      'Gossip about Gossip protocol',
      'Asynchronous Byzantine Fault Tolerance (aBFT)',
      'Hedera finality time (3-5 seconds)',
      'HBAR tokenomics and total supply',
      'Hedera Token Service (HTS)',
      'Hedera Consensus Service (HCS)',
      'Hedera Smart Contract Service (HSCS)',
      'Hedera Governing Council structure',
      'Hedera predictable fee structure',
      'Hedera account ID format (shard.realm.num)',
      'Hedera transaction ID format',
      'Hedera EVM compatibility and JSON-RPC relay',
      'Hedera mirror nodes and REST API',
      'Hedera state proofs',
      'Hedera carbon-negative sustainability',
      'Hedera HIP process',
      'Hedera scheduled transactions',
      'Hedera token custom fees',
      'Hedera ECDSA secp256k1 key support',
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const result = await llm.invoke([{
      role: 'user',
      content: `Generate a multiple-choice trivia question about ${topic} on the Hedera network.
Key fact: Hedera fees are predictable and USD-denominated, NOT variable based on congestion.
Respond with ONLY valid JSON, no markdown:
{"text":"...","choices":{"A":"...","B":"...","C":"...","D":"..."},"answer":"A","explanation":"...","hint":"..."}`,
    }]);
    const raw = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse question JSON');
    return JSON.parse(match[0]);
  }

  function formatQuestion(q) {
    return [`\n❓ ${q.text}`, `   A) ${q.choices.A}`, `   B) ${q.choices.B}`, `   C) ${q.choices.C}`, `   D) ${q.choices.D}`, ''].join('\n');
  }

  function evaluateAnswer(question, input) {
    const n = input.trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(n)) return 'invalid';
    return n === question.answer.toUpperCase() ? 'correct' : 'incorrect';
  }

  async function askYesNo(msg) {
    const r = await prompts({ type: 'text', name: 'a', message: msg });
    return /^(y|yes|yeah|yep|sure|ok|okay)/i.test((r.a ?? '').trim());
  }

  const puns = [
    "Hash-tastic! You're on fire! 🔥",
    "Absolutely chain-sational! 💎",
    "You just mined that answer! ⛏️",
    "Block by block, you're building a fortune! 🏗️",
    "Cryptographically correct! 🔐",
  ];

  // Welcome
  console.log('\n🎰 ============================================ 🎰');
  console.log("   Welcome to HASH GORDON'S BLOCKCHAIN BONANZA!");
  console.log('🎰 ============================================ 🎰');
  console.log(`\n💰 Entry fee: ${config.entryFeeHbar} HBAR  |  🏆 Payout: ${config.payoutHbar} HBAR`);
  console.log(`🏦 Prize Pool: ${config.prizePoolAccountId}`);
  console.log('\nType anything to chat | "play" to start | "score" | "history" | "exit"\n');

  // Main REPL
  while (true) {
    const r = await prompts({ type: 'text', name: 'input', message: 'You: ' });
    if (!r.input) continue;
    const input = r.input.trim();
    const lower = input.toLowerCase();

    if (['exit', 'quit'].includes(lower)) {
      console.log('\n' + buildClosingMessage(gameState) + '\n');
      break;
    }

    if (['score', 'stats'].includes(lower)) { console.log('\n' + formatStats(gameState) + '\n'); continue; }
    if (lower === 'history') { console.log('\n' + formatReceipts(gameState) + '\n'); continue; }

    if (gameState.currentRound?.awaitingAnswer) {
      if (lower === 'hint') {
        console.log(`\n💡 Hint: ${gameState.currentRound.question.hint}\n`);
        continue;
      }

      const evalResult = evaluateAnswer(gameState.currentRound.question, input);
      if (evalResult === 'invalid') { console.log('\n⚠️  Please answer A, B, C, or D.\n'); continue; }

      const round = gameState.currentRound;
      const isCorrect = evalResult === 'correct';

      if (isCorrect) {
        console.log('\n✅ CORRECT! ' + puns[Math.floor(Math.random() * puns.length)] + '\n');
        let payoutTxId = null;

        if (prizePoolKey) {
          try {
            console.log('🏆 Processing payout via agent...\n');
            // Switch operator to prize pool so the agent signs with the right key
            switchOperator(config.prizePoolAccountId, prizePoolKey);
            const { text, toolCall, txId } = await invokeAgent(
              `Transfer exactly ${config.payoutHbar} HBAR from ${config.prizePoolAccountId} to ${config.operatorAccountId} as the player's prize payout.`
            );
            // Restore operator back to player
            switchOperator(config.operatorAccountId, operatorKey);

            if (text) console.log('Hash Gordon: ' + text + '\n');

            if (!toolCall) throw new Error('Agent did not execute payout transfer.');
            payoutTxId = txId;
            if (payoutTxId) console.log(`🏆 ${config.payoutHbar} HBAR sent! Tx: ${payoutTxId}\n`);
          } catch (err) {
            switchOperator(config.operatorAccountId, operatorKey); // always restore
            console.log(`⚠️  Payout failed: ${err.message}\n`);
            console.log('💡 Make sure the prize pool account is properly configured and has sufficient funds.\n');
          }
        } else {
          console.log('⚠️  Add PRIZE_POOL_PRIVATE_KEY to .env to enable real payouts.\n');
        }

        const outcome = payoutTxId ? 'win' : 'unresolved';
        const receipt = buildReceipt(round.question, outcome, config.payoutHbar, payoutTxId ?? round.entryFeeTxId);
        gameState.receipts.push(receipt);
        updateStats(gameState, outcome, config.entryFeeHbar, config.payoutHbar);
        console.log(`🧾 RECEIPT | WIN🏆 | ${config.payoutHbar} HBAR | Tx: ${payoutTxId ?? round.entryFeeTxId}\n`);
      } else {
        const correctChoice = round.question.answer;
        const correctText = round.question.choices[correctChoice];
        console.log(`\n❌ Incorrect! The answer was ${correctChoice}) ${correctText}`);
        console.log(`💡 ${round.question.explanation}\n`);
        console.log(`🧾 RECEIPT | LOSS💸 | ${config.entryFeeHbar} HBAR | Tx: ${round.entryFeeTxId}\n`);
        const receipt = buildReceipt(round.question, 'loss', config.entryFeeHbar, round.entryFeeTxId);
        gameState.receipts.push(receipt);
        updateStats(gameState, 'loss', config.entryFeeHbar, config.payoutHbar);
      }

      lastCompletedRound = round;
      gameState.currentRound = null;
      continue;
    }

    // Play intent
    if (/\b(play|start|let'?s go|new round|another|again|hit me)\b/i.test(lower) && !gameState.currentRound) {
      const confirmed = await askYesNo(`💰 Entry fee: ${config.entryFeeHbar} HBAR. Ready to play? (yes/no): `);
      if (!confirmed) { console.log('\nNo problem, come back when you\'re ready!\n'); continue; }

      console.log('\n⏳ Paying entry fee via agent on-chain...\n');
      try {
        const { text, toolCall, txId } = await invokeAgent(
          `Transfer exactly ${config.entryFeeHbar} HBAR from ${config.operatorAccountId} to ${config.prizePoolAccountId} as the trivia entry fee.`
        );
        if (text) console.log('Hash Gordon: ' + text + '\n');
        if (!toolCall) { console.log('⚠️  Transfer did not go through or TX ID not captured. Round cancelled.\n'); continue; }

        const entryTxId = txId ?? 'unknown';
        console.log(`✅ Entry fee paid! Tx: ${entryTxId}\n`);
        console.log('🤔 Generating your question...\n');

        let question;
        try { question = await generateQuestion(); }
        catch (err) { console.log(`⚠️  Could not generate question: ${err.message}\n`); continue; }

        gameState.currentRound = { question, entryFeeTxId: entryTxId, awaitingAnswer: true };
        console.log(formatQuestion(question));
        console.log('Type A, B, C, or D to answer. Type "hint" for a clue.\n');
      } catch (err) {
        console.log(`⚠️  Entry fee error: ${err.message}\n`);
        console.log('💡 Make sure you have sufficient funds in your wallet.\n');
      }
      continue;
    }

    // Balance check
    if (/\bbalance\b|\bafford\b/i.test(lower)) {
      try {
        const { text } = await invokeAgent(`Check the HBAR balance for account ${config.operatorAccountId} and report it.`);
        console.log('\nHash Gordon: ' + text + '\n');
      } catch (err) { console.log(`Balance check error: ${err.message}\n`); }
      continue;
    }

    // General chat
    try {
      let chatMessage = input;
      if (lastCompletedRound && /explain|why|answer|question|correct|wrong|last/i.test(lower)) {
        const q = lastCompletedRound.question;
        chatMessage = `Last trivia question: "${q.text}". Correct answer: ${q.answer}) ${q.choices[q.answer]}. Explanation: ${q.explanation}.\nPlayer asks: ${input}`;
      }
      const { text } = await invokeAgent(chatMessage);
      console.log('\nHash Gordon: ' + text + '\n');
    } catch (err) { console.log(`Error: ${err.message}\n`); }
  }
}

await bootstrap();
