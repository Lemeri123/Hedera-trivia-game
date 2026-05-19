// gameState.js — game state helpers and data structures

/** @returns {object} Fresh GameState for a new session */
export function createGameState() {
  return {
    wins: 0,
    losses: 0,
    unresolved: 0,
    totalWagered: 0,
    netResult: 0,
    receipts: [],
    currentRound: null, // ActiveRound | null
  };
}

/**
 * Build a Receipt object for a completed round.
 * @param {object} question
 * @param {'win'|'loss'|'unresolved'} outcome
 * @param {number} hbarAmount
 * @param {string} transactionId
 * @returns {object}
 */
export function buildReceipt(question, outcome, hbarAmount, transactionId) {
  return {
    question: question.text,
    correctAnswer: `${question.answer}) ${question.choices[question.answer]}`,
    outcome,
    hbarAmount,
    transactionId,
    timestamp: new Date(),
  };
}

/**
 * Update session stats after a round completes.
 * Mutates gameState in place.
 * @param {object} gameState
 * @param {'win'|'loss'|'unresolved'} outcome
 * @param {number} entryFeeHbar
 * @param {number} payoutHbar
 */
export function updateStats(gameState, outcome, entryFeeHbar, payoutHbar) {
  gameState.totalWagered += entryFeeHbar;
  if (outcome === 'win') {
    gameState.wins += 1;
    gameState.netResult += payoutHbar - entryFeeHbar;
  } else if (outcome === 'loss') {
    gameState.losses += 1;
    gameState.netResult -= entryFeeHbar;
  } else {
    gameState.unresolved += 1;
  }
}

/**
 * Check if the player can afford the entry fee.
 * @param {number} balance
 * @param {number} entryFee
 * @returns {boolean}
 */
export function canAfford(balance, entryFee) {
  return balance >= entryFee;
}

/**
 * Format session stats for display.
 * @param {object} gameState
 * @returns {string}
 */
export function formatStats(gameState) {
  const total = gameState.wins + gameState.losses + gameState.unresolved;
  if (total === 0) {
    return '📊 No rounds played yet this session. Type "play" to start!';
  }
  const sign = gameState.netResult >= 0 ? '+' : '';
  return [
    '📊 SESSION STATS',
    `   🏆 Wins:          ${gameState.wins}`,
    `   💸 Losses:        ${gameState.losses}`,
    `   ❓ Unresolved:    ${gameState.unresolved}`,
    `   💰 Total wagered: ${gameState.totalWagered} HBAR`,
    `   📈 Net result:    ${sign}${gameState.netResult.toFixed(2)} HBAR`,
  ].join('\n');
}

/**
 * Format receipt history for display.
 * @param {object} gameState
 * @returns {string}
 */
export function formatReceipts(gameState) {
  if (gameState.receipts.length === 0) {
    return '📜 No rounds completed yet this session.';
  }
  return gameState.receipts
    .map((r, i) => {
      const icon = r.outcome === 'win' ? '🏆' : r.outcome === 'loss' ? '💸' : '❓';
      return [
        `\n--- Round ${i + 1} ${icon} ---`,
        `Q:      ${r.question}`,
        `Answer: ${r.correctAnswer}`,
        `Result: ${r.outcome.toUpperCase()} | ${r.hbarAmount} HBAR`,
        `Tx ID:  ${r.transactionId}`,
        `Time:   ${r.timestamp.toLocaleTimeString()}`,
      ].join('\n');
    })
    .join('\n');
}

/**
 * Build the closing message shown on exit.
 * @param {object} gameState
 * @returns {string}
 */
export function buildClosingMessage(gameState) {
  const total = gameState.wins + gameState.losses + gameState.unresolved;
  if (total === 0) {
    return "👋 Thanks for stopping by our Trivia! Come back again. Stay hashed out there!";
  }
  const sign = gameState.netResult >= 0 ? '+' : '';
  return [
    "🎬 That's a wrap on today's episode of Hash Gordon's Blockchain Bonanza!",
    `   Final score: ${gameState.wins} wins, ${gameState.losses} losses`,
    `   Net result:  ${sign}${gameState.netResult.toFixed(2)} HBAR`,
    "   Until next time — stay decentralized! 🔗✨",
  ].join('\n');
}
