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
import { Client, PrivateKey, TransferTransaction, Hbar, AccountId } from '@hiero-ledger/sdk';
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

  const operatorKey = PrivateKey.fromStringDer(config.operatorPrivateKey);
  const client = getHederaClient().setOperator(config.operatorAccountId, operatorKey);

  // Prize pool key for signing outgoing payout transfers
  let prizePoolKey = null;
  if (config.prizePoolPrivateKey) {
    try {
      prizePoolKey = PrivateKey.fromStringDer(config.prizePoolPrivateKey);
    } catch {
      console.warn('Warning: PRIZE_POOL_PRIVATE_KEY could not be parsed. Payouts may fail.');
    }
  }
 // only need 2 tools to reduce on token requests
  const { TRANSFER_HBAR_TOOL } = coreAccountPluginToolNames;
  const { GET_HBAR_BALANCE_QUERY_TOOL } = coreAccountQueryPluginToolNames;

  const hederaAgentToolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      plugins: [coreAccountPlugin, coreAccountQueryPlugin],
      tools: [TRANSFER_HBAR_TOOL, GET_HBAR_BALANCE_QUERY_TOOL],
      context: { mode: AgentMode.AUTONOMOUS, accountId: config.operatorAccountId },
    },
  });

  const responseParserService = new ResponseParserService(hederaAgentToolkit.getTools());
  const memory = new MemorySaver();
  const agentConfig = { configurable: { thread_id: 'hash-gordon-trivia' } };

  const llm = new ChatGroq({ model: 'llama-3.1-8b-instant', apiKey: config.groqApiKey });

  // Minimal system prompt — no confirmation logic, just persona + transfer instructions
  const systemPrompt = `You are Hash Gordon, an enthusiastic blockchain game-show host.
You have ONLY two tools available: TRANSFER_HBAR and GET_HBAR_BALANCE.
When told to transfer HBAR, call TRANSFER_HBAR immediately with the exact amounts given.
When told to check balance, call GET_HBAR_BALANCE.
For ALL other questions, answer from your own knowledge — NEVER call any other tool.
Keep responses short, punny, and energetic.`;

  const agent = createAgent({
    model: llm,
    tools: hederaAgentToolkit.getTools(),
    checkpointer: memory,
    stateModifier: systemPrompt,
  });

  const gameState = createGameState();

  // Generate a fresh Hedera-only trivia question via the LLM
  async function generateQuestion() {
    const topics = [
      'Hedera Hashgraph consensus algorithm',
      'Gossip about Gossip protocol',
      'Asynchronous Byzantine Fault Tolerance (aBFT)',
      'Hedera finality time (3-5 seconds)',
      'HBAR tokenomics and supply',
      'Hedera Token Service (HTS)',
      'Hedera Consensus Service (HCS)',
      'Hedera Smart Contract Service (HSCS)',
      'Hedera Governing Council',
      'Hedera transaction fee structure',
      'Hedera account ID format (shard.realm.num)',
      'Hedera transaction ID format',
      'Hedera EVM compatibility',
      'Hedera mirror nodes',
      'Hedera mainnet vs testnet',
      'Hedera SDK for JavaScript',
      'Hedera network finality guarantee',
      'Hedera proxy staking',
      'Hedera Improvement Proposal (HIP) process',
      'Hedera carbon-negative sustainability claims',
      'Hedera serialization format protobuf details',
      'Hedera transaction durability and write-ahead logs',
      'Hedera consensus time vs wall clock time',
      'Hedera throttles and capacity limits by request type',
      'Hedera transaction queuing algorithm',
      'Hedera state proofs and cryptographic verification',
      'Hedera virtual voting mathematics',
      'Hedera round creation and consensus rounds',
      'Hedera hashgraph efficiency O(n²) vs O(n log n)',
      'Hedera reconnection and resync protocols',
      'Hedera Token Service custom fees (fixed, fractional, royalty)',
      'Hedera token supply types (finite, infinite, varying)',
      'Hedera token freeze functionality',
      'Hedera token wipe functionality',
      'Hedera token pause and unpause mechanics',
      'Hedera token kyc (Know Your Customer) configuration',
      'Hedera token dissassociation limits and requirements',
      'Hedera token metadata schema and standards',
      'Hedera fractional NFTs and royalty splits',
      'Hedera token delegation and staking',
      'Hedera Consensus Service topic submit keys',
      'Hedera Consensus Service sequencer and submit key validation',
      'Hedera Consensus Service chunking for large messages',
      'Hedera Consensus Service running hashes and verification',
      'Hedera Consensus Service topic expiration and auto-renew',
      'Hedera Consensus Service message retention limits',
      'Hedera Consensus Service for verifiable random numbers',
      'Hedera Consensus Service for decentralized oracles',
      'Hedera precompiled contracts (htsPrecompile, prng)',
      'Hedera Solidity gas calculation vs native transaction fees',
      'Hedera contract deployment via HFS file system',
      'Hedera contract traceability and opcode logs',
      'Hedera contract auto-renew accounts',
      'Hedera contract bytecode storage fees',
      'Hedera system contract for account information',
      'Hedera Redux (transaction simulation before execution)',
      'Hedera account auto-renewal period configuration',
      'Hedera account expiring vs deleted state',
      'Hedera account alias using ECDSA compressed keys',
      'Hedera account receive signature requirements',
      'Hedera account threshold keys and multi-signature',
      'Hedera account keylist with different public keys',
      'Hedera account smart contract id alias',
      'Hedera account treasury role for tokens',
      'Hedera transaction chunking for file uploads (append)',
      'Hedera transaction schedule (scheduleCreate, scheduleSign)',
      'Hedera transaction batch processing limits',
      'Hedera transaction child records and receipts',
      'Hedera transaction queries (balance, info, records)',
      'Hedera transaction transfer relationships',
      'Hedera transaction signature verification',
      'Hedera transaction memo character limits',
      'Hedera ED25519 key pair generation and verification',
      'Hedera ECDSA secp256k1 key support for Ethereum compatibility',
      'Hedera zero-knowledge proof (ZKP) integration via precompiles',
      'Hedera key derivation and hierarchical deterministic wallets',
      'Hedera signature counting and verification limits',
      'Hedera transaction signing with multiple keys',
      'Hedera client certificate authentication (mTLS)',
      'Hedera cryptographic randomness via HCS message hash',
      'Hedera network fee sub-types (node, service, network)',
      'Hedera congestion pricing during high traffic',
      'Hedera fee schedule file (0.0.111) updates',
      'Hedera gas fee calculation for smart contracts',
      'Hedera HBAR denominated fees vs USD equivalent',
      'Hedera treasury funding for developers (grants)',
      'Hedera transaction cache and storage fees',
      'Hedera token transfer fees (associate, transfer, dissociate)',
      'Hedera Local Node for offline development',
      'Hedera SDK entity management (create, update, delete)',
      'Hedera REST API mirror node endpoints',
      'Hedera JSON-RPC relay for MetaMask compatibility',
      'Hedera Dagger (high-performance mirror node explorer)',
      'Hedera CLI wallet (hedera-cli for terminal)',
      'Hedera Testnet faucet mechanics and rate limits',
      'Hedera SDK batching for performance optimization',
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const result = await llm.invoke([
      {
        role: 'user',
        content: `Generate a multiple-choice trivia question specifically about ${topic} on the Hedera network.
Respond with ONLY valid JSON, no markdown, no extra text:
{
  "text": "question text here",
  "choices": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "answer": "A",
  "explanation": "brief explanation of the correct answer",
  "hint": "a clue that narrows it down without giving it away"
}`,
      },
    ]);
    const raw = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse question JSON from LLM response');
    return JSON.parse(match[0]);
  }

  function formatQuestion(q) {
    return [
      `\n❓ ${q.text}`,
      `   A) ${q.choices.A}`,
      `   B) ${q.choices.B}`,
      `   C) ${q.choices.C}`,
      `   D) ${q.choices.D}`,
      '',
    ].join('\n');
  }

  function evaluateAnswer(question, input) {
    const normalized = input.trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(normalized)) return 'invalid';
    return normalized === question.answer.toUpperCase() ? 'correct' : 'incorrect';
  }

  // Helper: invoke agent and return last message text + first tool call
  async function invokeAgent(userMessage) {
    const result = await agent.invoke(
      { messages: [{ role: 'user', content: userMessage }] },
      agentConfig,
    );
    const parsed = responseParserService.parseNewToolMessages(result);
    // Get last assistant text message, skip any that look like raw JSON tool dumps
    let text = '';
    for (let i = result.messages.length - 1; i >= 0; i--) {
      const msg = result.messages[i];
      if (msg.role === 'assistant' || msg._getType?.() === 'ai') {
        const content = typeof msg.content === 'string' ? msg.content : '';
        // Skip messages that are just raw JSON dumps
        if (content && !content.trim().startsWith('{') && !content.trim().startsWith('[')) {
          text = content;
          break;
        } else if (content) {
          text = content;
          break;
        }
      }
    }
    const toolCall = parsed[0] ?? null;
    // Extract transaction ID from various possible locations
    const txId = toolCall?.transactionId
      ?? toolCall?.result?.transactionId
      ?? toolCall?.raw?.transactionId
      ?? null;
    return { text, toolCall, txId };
  }

  // Helper: ask a yes/no question in the terminal
  async function askYesNo(question) {
    const r = await prompts({ type: 'text', name: 'answer', message: question });
    return /^(y|yes|yeah|yep|sure|ok|okay|do it|let'?s go)/i.test((r.answer ?? '').trim());
  }

  // Welcome
  console.log('\n🎰 ============================================ 🎰');
  console.log("   Welcome to HASH GORDON'S BLOCKCHAIN BONANZA!");
  console.log('🎰 ============================================ 🎰');
  console.log(`\n💰 Entry fee: ${config.entryFeeHbar} HBAR  |  🏆 Payout: ${config.payoutHbar} HBAR`);
  console.log('\nType anything to chat | "play" to start | "score" | "history" | "exit"\n');

  // Main REPL
  while (true) {
    const r = await prompts({ type: 'text', name: 'input', message: 'You: ' });
    if (!r.input) continue;

    const input = r.input.trim();
    const lower = input.toLowerCase();

    // --- Exit ---
    if (['exit', 'quit'].includes(lower)) {
      console.log('\n' + buildClosingMessage(gameState) + '\n');
      break;
    }

    // --- Local commands ---
    if (['score', 'stats'].includes(lower)) { console.log('\n' + formatStats(gameState) + '\n'); continue; }
    if (lower === 'history') { console.log('\n' + formatReceipts(gameState) + '\n'); continue; }

    if (gameState.currentRound?.awaitingAnswer) {
      if (lower === 'hint') {
        console.log(`\n💡 Hint: ${gameState.currentRound.question.hint}\n`);
        continue;
      }

      const result = evaluateAnswer(gameState.currentRound.question, input);
      if (result === 'invalid') { console.log('\n⚠️  Please answer A, B, C, or D.\n'); continue; }

      const round = gameState.currentRound;
      const isCorrect = result === 'correct';

      if (isCorrect) {
        console.log('\n✅ CORRECT! Sending your winnings...\n');
        try {
          const { text, toolCall, txId: payoutTxId } = await invokeAgent(
            `The player answered correctly! Transfer exactly ${config.payoutHbar} HBAR from ${config.prizePoolAccountId} to ${config.operatorAccountId} as their prize. Then celebrate!`
          );
          console.log('Hash Gordon: ' + text + '\n');
          const finalTxId = payoutTxId ?? round.entryFeeTxId;
          const receipt = buildReceipt(round.question, 'win', config.payoutHbar, finalTxId);
          gameState.receipts.push(receipt);
          updateStats(gameState, 'win', config.entryFeeHbar, config.payoutHbar);
        } catch (err) {
          console.error('Payout error:', err.message);
          const receipt = buildReceipt(round.question, 'unresolved', config.payoutHbar, round.entryFeeTxId);
          gameState.receipts.push(receipt);
          updateStats(gameState, 'unresolved', config.entryFeeHbar, config.payoutHbar);
        }
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

      gameState.currentRound = null;
      continue;
    }

    // --- Play intent ---
    const isPlayIntent = /\b(play|start|let'?s go|new round|another|again|hit me)\b/i.test(lower);
    if (isPlayIntent && !gameState.currentRound) {
      // Step 1: confirm entry fee in the REPL (no agent involved)
      const confirmed = await askYesNo(`💰 Entry fee: ${config.entryFeeHbar} HBAR. Ready to play? (yes/no): `);
      if (!confirmed) { console.log('\nNo problem, come back when you\'re ready!\n'); continue; }

      // Step 2: agent does the transfer
      console.log('\n⏳ Paying entry fee on-chain...\n');
      try {
        const { text, toolCall, txId } = await invokeAgent(
          `Transfer exactly ${config.entryFeeHbar} HBAR from ${config.operatorAccountId} to ${config.prizePoolAccountId} as the trivia entry fee.`
        );
        console.log('Hash Gordon: ' + text + '\n');

        if (!toolCall) {
          console.log('⚠️  Transfer did not go through. Round cancelled.\n');
          continue;
        }

        const entryTxId = txId ?? 'unknown';
        console.log(`✅ Entry fee paid! Tx: ${entryTxId}\n`);

        // Step 3: generate question via AI and show it
        console.log('🤔 Generating your question...\n');
        let question;
        try {
          question = await generateQuestion();
        } catch (err) {
          console.error('Question generation error:', err.message);
          console.log('⚠️  Could not generate a question. Round cancelled.\n');
          continue;
        }
        gameState.currentRound = { question, entryFeeTxId: entryTxId, awaitingAnswer: true };
        console.log(formatQuestion(question));
        console.log('Type A, B, C, or D to answer. Type "hint" for a clue.\n');
      } catch (err) {
        console.error('Entry fee error:', err.message);
        console.log('⚠️  Could not pay entry fee. Round cancelled.\n');
      }
      continue;
    }

    // --- Balance check ---
    if (/balance|hbar|afford/i.test(lower)) {
      try {
        const { text } = await invokeAgent(`Check the HBAR balance for account ${config.operatorAccountId} and report it.`);
        console.log('\nHash Gordon: ' + text + '\n');
      } catch (err) {
        console.error('Balance check error:', err.message);
      }
      continue;
    }

    // --- General chat ---
    try {
      const { text } = await invokeAgent(input);
      console.log('\nHash Gordon: ' + text + '\n');
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
}

await bootstrap();
