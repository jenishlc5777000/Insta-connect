const mongoose = require('mongoose');
const logger = require('../utils/logger');

const dbState = { supportsTransactions: false };

async function connectDB(uri, options = {}) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, options);

  // Transactions require a replica set or sharded cluster (MongoDB Atlas always is)
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    dbState.supportsTransactions = Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch {
    dbState.supportsTransactions = false;
  }

  // Make sure every collection + index exists (unique constraints are relied upon)
  require('../models');
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));

  logger.info(
    `MongoDB connected (${mongoose.connection.name}); transactions ${
      dbState.supportsTransactions ? 'enabled' : 'unavailable (standalone server)'
    }`
  );
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB, dbState };
