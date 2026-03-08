const config = require('../config');
const stripeService = require('./stripeService');
const storage = require('./storage');

function setupWebhook(app, express) {
    // Stripe requires the raw body to construct the event
    app.post('/api/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
        const sig = request.headers['stripe-signature'];
        const endpointSecret = config.stripeWebhookSecret;

        let event;

        try {
            if (endpointSecret && stripeService.stripe) {
                event = stripeService.stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
            } else {
                // Fallback for testing without signature validation if secret is not set
                event = JSON.parse(request.body);
            }
        } catch (err) {
            console.error(`Webhook Error: ${err.message}`);
            storage.logWebhook({ id: 'err_' + Date.now(), type: 'error.signature_verification_failed', created: Math.floor(Date.now() / 1000), data: { object: { object: 'error' } } });
            return response.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Log the event locally
        await storage.logWebhook(event);

        // Handle specific events
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
                // Add to ledger or send notification
                break;
            case 'payment_method.attached':
                const paymentMethod = event.data.object;
                break;
            case 'charge.refunded':
                console.log('Charge was refunded');
                break;
            // ... handle other event types
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        // Return a 200 response to acknowledge receipt of the event
        response.send();
    });
}

module.exports = {
    setupWebhook
};
