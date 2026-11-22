/**
 * Vercel serverless entry: serves the whole Express API (/api/v1/*) from one function.
 * The React app is served as static files; see vercel.json for the routing.
 */
const env = require('../backend/src/config/env');
const { ensureConnected } = require('../backend/src/config/db');
const { createApp } = require('../backend/src/app');

const app = createApp();

module.exports = async (req, res) => {
  try {
    await ensureConnected(env.mongoUri);
  } catch (err) {
    console.error('Database connection failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'Service temporarily unavailable. Please try again.' } }));
    return;
  }
  return app(req, res);
};
