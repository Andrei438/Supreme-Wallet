const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('../config');
const storage = require('./storage');
const auth = require('./auth');
const webhookHandler = require('./webhookHandler');
const routes = require('./routes');

const app = express();

// Initialize Storage
storage.initStorage();

// Trust proxy if running behind a reverse proxy (e.g. Nginx/Heroku)
app.set('trust proxy', 1);

// Basic Security Headers
app.use(helmet({
    contentSecurityPolicy: false // disabled for simplicity when loading external chart scripts like Chart.js
}));

// Cross Origin Resource Sharing
app.use(cors());

// Webhook parsing MUST remain raw buffer before express.json()
webhookHandler.setupWebhook(app, express);

// Parse JSON payload
app.use(express.json());

// Session Management
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        // Only require secure cookies if in production AND not on localhost
        // If testing production mode locally on HTTP, secure must be false
        secure: config.nodeEnv === 'production' && process.env.ALLOW_HTTP_SESSION !== 'true',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// Base path for the app - set in .env as BASE_PATH=/wallet
const BASE = config.basePath || '';

// Health check endpoint — no auth required, answers to Dokploy/Docker healthcheck
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Rate limiting for login specially
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many login attempts, please try again later.' }
});

// Apply login limiter
app.use(`${BASE}/api/login`, loginLimiter);

// API Routes (under /wallet/api)
app.use(`${BASE}/api`, routes);

// Static files (Frontend) - served under /wallet
app.use(BASE, express.static(path.join(__dirname, '..', 'public')));

// Protect specific HTML dashboard pages
const dashboardPages = [
    '/index.html', '/transactions.html', '/customers.html',
    '/subscriptions.html', '/invoices.html', '/balance.html',
    '/refunds.html', '/disputes.html', '/events.html',
    '/analytics.html', '/ledger.html', '/settings.html'
].map(p => `${BASE}${p}`);

app.get(dashboardPages, auth.isAuthenticated, (req, res, next) => {
    next();
});

// Root redirect to base path (only if BASE is defined)
if (BASE && BASE !== '/') {
    app.get('/', (req, res) => {
        res.redirect(BASE);
    });
}

// /wallet redirect to login or dashboard
app.get([`${BASE}`, `${BASE}/`], (req, res) => {
    if (req.session && req.session.authenticated) {
        res.redirect(`${BASE}/index.html`);
    } else {
        res.redirect(`${BASE}/login.html`);
    }
});

const PORT = config.port;
app.listen(PORT, () => {
    console.log(`[Supreme Wallet Server] Running on http://localhost:${PORT}${BASE}`);
});
