const Stripe = require('stripe');
const config = require('../config');

// Initialize Stripe gracefully, so app doesn't crash if key is missing initially
let stripe;
if (config.stripeSecretKey) {
    stripe = Stripe(config.stripeSecretKey);
}

// Wrapper to check if stripe is configured
const ensureStripe = () => {
    if (!stripe) throw new Error('Stripe Secret Key is not configured.');
    return stripe;
};

async function getBalance() {
    const s = ensureStripe();
    return await s.balance.retrieve();
}

async function getPayments(limit = 50, startingAfter = null) {
    const s = ensureStripe();
    const params = { limit };
    if (startingAfter) params.starting_after = startingAfter;
    return await s.paymentIntents.list(params);
}

async function getPayment(id) {
    const s = ensureStripe();
    return await s.paymentIntents.retrieve(id);
}

async function getCustomers(limit = 50) {
    const s = ensureStripe();
    return await s.customers.list({ limit });
}

async function getCustomer(id) {
    const s = ensureStripe();
    return await s.customers.retrieve(id);
}

async function getSubscriptions(limit = 50) {
    const s = ensureStripe();
    return await s.subscriptions.list({ limit });
}

async function getInvoices(limit = 50) {
    const s = ensureStripe();
    return await s.invoices.list({ limit });
}

async function getPayouts(limit = 50) {
    const s = ensureStripe();
    return await s.payouts.list({ limit });
}

async function getRefunds(limit = 50) {
    const s = ensureStripe();
    return await s.refunds.list({ limit });
}

async function getDisputes(limit = 50) {
    const s = ensureStripe();
    return await s.disputes.list({ limit });
}

async function createRefund(paymentIntentId, amount, reason) {
    const s = ensureStripe();
    const params = { payment_intent: paymentIntentId };
    if (amount) params.amount = amount; // amount in cents
    if (reason) params.reason = reason;
    return await s.refunds.create(params);
}

// Additional helpers for dashboard summaries
async function getRecentActivity() {
    const s = ensureStripe();
    const [payments, refunds, payouts] = await Promise.all([
        s.paymentIntents.list({ limit: 5 }),
        s.refunds.list({ limit: 5 }),
        s.payouts.list({ limit: 5 })
    ]);
    return { payments: payments.data, refunds: refunds.data, payouts: payouts.data };
}

module.exports = {
    getBalance,
    getPayments,
    getPayment,
    getCustomers,
    getCustomer,
    getSubscriptions,
    getInvoices,
    getPayouts,
    getRefunds,
    getDisputes,
    createRefund,
    getRecentActivity,
    stripe // export raw instance for webhooks
};
