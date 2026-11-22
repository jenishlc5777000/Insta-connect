const isTest = process.env.NODE_ENV === 'test';

const stamp = () => new Date().toISOString();

module.exports = {
  info: (...args) => !isTest && console.log(`[${stamp()}] INFO`, ...args),
  warn: (...args) => !isTest && console.warn(`[${stamp()}] WARN`, ...args),
  error: (...args) => console.error(`[${stamp()}] ERROR`, ...args),
};
