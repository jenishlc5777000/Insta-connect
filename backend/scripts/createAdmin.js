/**
 * Creates (or promotes / resets) an admin account.
 *   npm run create-admin -- --email admin@jencorps.com --name "JenCorps Admin" --password "S3cure-pass"
 * When --password is omitted a strong random password is generated and printed once.
 */
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User } = require('../src/models');
const { generatePassword } = require('../src/utils/helpers');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

(async () => {
  const email = (arg('email') || '').toLowerCase().trim();
  const name = arg('name') || 'JenCorps Admin';
  let password = arg('password');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage: npm run create-admin -- --email you@company.com [--name "Name"] [--password "..."]');
    process.exit(1);
  }
  const generated = !password;
  if (generated) password = generatePassword(16);
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    console.error('Password must be 8+ characters with letters and numbers');
    process.exit(1);
  }

  await connectDB(env.mongoUri);
  let user = await User.findOne({ email });
  if (user) {
    user.role = 'admin';
    user.status = 'active';
    console.log(`Existing user ${email} promoted to admin and password reset.`);
  } else {
    user = new User({ email, name, role: 'admin', emailVerified: true });
    console.log(`Admin ${email} created.`);
  }
  await user.setPassword(password);
  await user.save();
  if (generated) console.log(`Generated password (shown once): ${password}`);
  console.log(`Log in at ${env.frontendUrl}/admin/login`);
  await disconnectDB();
})().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
