require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'super-secret-default-key-12345',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'password123',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripePublicKey: process.env.STRIPE_PUBLIC_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'usd',
  nodeEnv: process.env.NODE_ENV || 'development',
  totpSecret: process.env.TOTP_SECRET || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  // This key is used for disk encryption of ledger/webhooks. Keep it extremely safe!
  encryptionKey: process.env.ENCRYPTION_KEY || 'a-very-secure-default-encryption-key-change-me',
  // Base URL path for the app. Defaults to /wallet
  basePath: process.env.BASE_PATH || '/wallet'
};
