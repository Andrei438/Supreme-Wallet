# Supreme Wallet

Comprehensive financial management dashboard for tracking ledgers and webhooks.

## Features
- **Encrypted Ledger**: Secure storage of financial logs using AES encryption.
- **Stripe Integration**: Automated webhook handling for global payments.
- **Security**: Rate-limited logins, helmet protection, and session management.
- **Standardized Health**: Exposed `/health` endpoint for monitoring.

## Dokploy Deployment
1. Push this repository to a private GitHub repo.
2. In Dokploy, create a **Compose** service using the root `docker-compose.yml`.
3. Set environment variables for Stripe and encryption.
4. Add the domain `wallet.supreme-cheats.xyz` with SSL.

## Tech Stack
- **Language**: Node.js (Express)
- **Storage**: Encrypted JSON files (Persistent Volume)
