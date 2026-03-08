const stripeService = require('./stripeService');

async function getDashboardMetrics() {
    try {
        const [balance, payments, customers, subscriptions, refunds] = await Promise.all([
            stripeService.getBalance(),
            stripeService.getPayments(100),
            stripeService.getCustomers(1), // Just need total count ideally, but getting 1 for active check if search API is not used
            stripeService.getSubscriptions(100),
            stripeService.getRefunds(100)
        ]);

        // Calculate Revenue (Simplified: sum of successful payments in last 100)
        // For production, we would use Stripe Search API or aggregate over standard timeframes
        let totalRevenue = 0;
        let successfulPayments = 0;
        let failedPayments = 0;

        payments.data.forEach(p => {
            if (p.status === 'succeeded') {
                totalRevenue += p.amount;
                successfulPayments++;
            } else if (p.status === 'requires_payment_method' || p.status === 'canceled') {
                // Approximate representation of failed/incomplete
                failedPayments++;
            }
        });

        let totalRefunds = 0;
        refunds.data.forEach(r => totalRefunds += r.amount);

        // Active subscriptions
        const activeSubCount = subscriptions.data.filter(s => s.status === 'active').length;

        // Group revenue by day for charts (using the last 100 payments)
        const revenueByDay = {};
        payments.data.forEach(p => {
            if (p.status === 'succeeded') {
                const date = new Date(p.created * 1000).toISOString().split('T')[0];
                if (!revenueByDay[date]) revenueByDay[date] = 0;
                revenueByDay[date] += p.amount;
            }
        });

        return {
            balance: {
                available: balance.available,
                pending: balance.pending
            },
            metrics: {
                totalRevenue,
                totalRefunds,
                successfulPayments,
                failedPayments
                // totalCustomers: customers.data.length - this is paginated so it only shows up to limit
            },
            charts: {
                revenueByDay
            }
        };

    } catch (error) {
        console.error('Error computing analytics:', error);
        throw error;
    }
}

module.exports = {
    getDashboardMetrics
};
