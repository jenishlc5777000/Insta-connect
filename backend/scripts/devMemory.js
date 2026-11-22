/**
 * DEVELOPMENT ONLY: runs the API against a throw-away in-memory MongoDB replica set,
 * seeded with sample data. No MongoDB installation needed.
 * The API restarts automatically (nodemon) when backend code changes; the data survives
 * those restarts because the database lives in this parent process.
 *   npm run dev:memory -w backend
 */
const { spawn } = require('child_process');
const path = require('path');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('dev:memory is for development only');
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const env = { ...process.env, MONGODB_URI: replSet.getUri('jencorps') };
  console.log(`In-memory MongoDB replica set: ${env.MONGODB_URI}`);

  const run = (script) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(__dirname, script)], { env, stdio: 'inherit' });
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited with ${code}`))));
    });

  await run('seed.js');
  const backend = path.join(__dirname, '..');
  const nodemon = require.resolve('nodemon/bin/nodemon.js');
  const server = spawn(process.execPath, [nodemon, '--watch', 'src', '--watch', 'server.js', 'server.js'], { env, stdio: 'inherit', cwd: backend });
  const stop = async () => {
    server.kill();
    await replSet.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  server.on('exit', async (code) => {
    await replSet.stop();
    process.exit(code ?? 0);
  });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
