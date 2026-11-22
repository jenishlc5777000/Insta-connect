const env = require('./src/config/env');
const { connectDB, disconnectDB } = require('./src/config/db');
const { createApp } = require('./src/app');
const logger = require('./src/utils/logger');

async function start() {
  await connectDB(env.mongoUri);
  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`JenCorps API listening on :${env.port} (${env.nodeEnv})`);
    logger.info(`Base domain: ${env.baseDomain} | Frontend: ${env.frontendUrl}`);
    if (env.paymentMock) logger.warn('Payments: MOCK gateway active (development only). Set Razorpay keys to use Razorpay.');
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
