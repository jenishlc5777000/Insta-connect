const mongoose = require('mongoose');
const { dbState } = require('../config/db');

/**
 * Runs fn inside a MongoDB transaction when the deployment supports it (replica set / Atlas).
 * Falls back to running without a session on standalone servers (local development).
 * fn may be retried on transient errors, so keep external side effects (emails, HTTP) outside it.
 */
async function withTransaction(fn) {
  if (!dbState.supportsTransactions) return fn(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { withTransaction };
