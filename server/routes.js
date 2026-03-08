const express = require('express');
const auth = require('./auth');
const config = require('../config');
const stripeService = require('./stripeService');
const analyticsService = require('./analyticsService');
const ledgerService = require('./ledgerService');
const storage = require('./storage');

const router = express.Router();

// Public Auth Endpoints
router.post('/login', auth.login);
router.post('/logout', auth.logout);
router.get('/session', auth.checkSession);

// Secure all endpoints below an authentication wall
router.use(auth.isAuthenticated);

// --- Stripe Endpoints ---

router.get('/dashboard', async (req, res) => {
    try {
        const metrics = await analyticsService.getDashboardMetrics();
        res.json(metrics);
    } catch (error) {
        if (!config.stripeSecretKey) return res.status(503).json({ error: 'Stripe is not configured. Add your key in .env or settings.' });
        res.status(500).json({ error: error.message });
    }
});

router.get('/payments', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const payments = await stripeService.getPayments(limit);
        res.json({ data: payments.data });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/payment/:id', async (req, res) => {
    try {
        const payment = await stripeService.getPayment(req.params.id);
        res.json(payment);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/refund', async (req, res) => {
    try {
        const { payment_intent, amount, reason } = req.body;
        const refund = await stripeService.createRefund(payment_intent, amount, reason);
        res.json({ success: true, refund });
    } catch (error) {
        res.status(400).json({ error: error.message || 'Refund failed' });
    }
});

router.get('/customers', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const customers = await stripeService.getCustomers(limit);
        res.json({ data: customers.data });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/customer/:id', async (req, res) => {
    try {
        const customer = await stripeService.getCustomer(req.params.id);
        res.json(customer);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/subscriptions', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const subs = await stripeService.getSubscriptions(limit);
        res.json({ data: subs.data });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/invoices', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const invoices = await stripeService.getInvoices(limit);
        res.json({ data: invoices.data });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/balance', async (req, res) => {
    try {
        const balance = await stripeService.getBalance();
        res.json(balance);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/payouts', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const payouts = await stripeService.getPayouts(limit);
        res.json({ data: payouts.data });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/refunds', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const refunds = await stripeService.getRefunds(limit);
        res.json({ data: refunds.data });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/disputes', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const disputes = await stripeService.getDisputes(limit);
        res.json({ data: disputes.data });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/events', async (req, res) => {
    try {
        // Return local webhook logs
        const events = await storage.getWebhooks();
        res.json({ data: events });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Ledger Endpoints ---

router.get('/ledger', async (req, res) => {
    try {
        const entries = await ledgerService.getLedgerEntries();
        res.json({ data: entries });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/ledger/summary', async (req, res) => {
    try {
        const summary = await ledgerService.getLedgerSummary();
        res.json(summary);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/ledger/add', async (req, res) => {
    try {
        const newEntry = await ledgerService.addLedgerEntry(req.body);
        res.json({ success: true, entry: newEntry });
    } catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/ledger/delete', async (req, res) => {
    try {
        const { id } = req.body;
        await ledgerService.deleteLedgerEntry(id);
        res.json({ success: true });
    } catch (error) { res.status(400).json({ error: error.message }); }
});

// --- Settings Endpoints ---

router.get('/settings', (req, res) => {
    // Only return safe settings, never secrets!
    res.json({
        adminUsername: config.adminUsername,
        defaultCurrency: config.defaultCurrency,
        nodeEnv: config.nodeEnv,
        stripeConfigured: !!config.stripeSecretKey,
        webhookConfigured: !!config.stripeWebhookSecret
    });
});

router.post('/settings/update', (req, res) => {
    // In a production app, this would write to a database or .env file and possibly restart the server
    // For this project, we'll return a success message but warn that hardcoded config changes need manual .env edits.
    res.json({
        success: true,
        message: 'Settings update interface connected. Note: Modifying Core Admin Credentials or Stripe Keys requires editing the .env file directly.'
    });
});

module.exports = router;
