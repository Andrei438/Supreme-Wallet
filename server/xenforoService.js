const axios = require('axios');
const config = require('../config');
const { createClient } = require('redis');

let redisClient;

async function getRedis() {
    if (!redisClient) {
        redisClient = createClient({ url: config.redisUrl });
        await redisClient.connect().catch(err => console.error('[XenForo Service] Redis Error:', err));
    }
    return redisClient;
}

/**
 * Fetches a XenForo username by email address.
 * Integrates with Redis for 24-hour caching to ensure top performance.
 */
async function getUsernameByEmail(email) {
    if (!email || !config.xenforoApiUrl || !config.xenforoApiKey) return null;

    const cacheKey = `xf_user:${email.toLowerCase()}`;
    const redis = await getRedis();

    try {
        // 1. Check Cache
        const cached = await redis.get(cacheKey);
        if (cached) return cached;

        // 2. Fetch from XenForo API
        const url = new URL(`${config.xenforoApiUrl}/api/users/find-name`);
        url.searchParams.append('email', email);

        const response = await fetch(url.toString(), {
            headers: { 'XF-Api-Key': config.xenforoApiKey },
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) throw new Error(`API returned ${response.status}`);
        
        const data = await response.json();
        const username = data?.user?.username || null;

        // 3. Cache Result (24 hrs)
        if (username) {
            await redis.set(cacheKey, username, { EX: 86400 });
        } else {
            // Cache negative results for a shorter time to avoid repeated failed lookups
            await redis.set(cacheKey, 'UNKNOWN', { EX: 3600 });
        }

        return username;
    } catch (error) {
        console.error(`[XenForo Service] Lookup failed for ${email}:`, error.message);
        return null;
    }
}

module.exports = {
    getUsernameByEmail
};
