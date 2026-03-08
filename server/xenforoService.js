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
 * Fetches XenForo user info (username, avatar) by email address.
 * Integrates with Redis for 24-hour caching.
 */
async function getUserInfoByEmail(email) {
    if (!email || !config.xenforoApiUrl || !config.xenforoApiKey) return null;

    const cacheKey = `xf_user_v2:${email.toLowerCase()}`;
    const redis = await getRedis();

    try {
        // 1. Check Cache
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        // 2. Fetch from XenForo API
        // Standard XF2 user search via filtering
        const url = new URL(`${config.xenforoApiUrl}/api/users/`);
        url.searchParams.append('email', email);

        const response = await fetch(url.toString(), {
            headers: { 'XF-Api-Key': config.xenforoApiKey },
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            const errBody = await response.text();
            
            // Fallback: Some setups might still use /find if an addon is present
            if (response.status === 404) {
                const findUrl = new URL(`${config.xenforoApiUrl}/api/users/find`);
                findUrl.searchParams.append('email', email);
                const findRes = await fetch(findUrl.toString(), {
                    headers: { 'XF-Api-Key': config.xenforoApiKey },
                    signal: AbortSignal.timeout(5000)
                });
                if (findRes.ok) {
                    const findData = await findRes.json();
                    return handleUserResponse(findData.user, cacheKey, redis);
                }
            }
            throw new Error(`API returned ${response.status}: ${errBody}`);
        }
        
        const data = await response.json();
        // /api/users/ returns a list of results { users: [...], pagination: ... }
        const user = data?.users?.[0] || data?.user;
        
        return handleUserResponse(user, cacheKey, redis);
    } catch (error) {
        console.error(`[XenForo Service] Lookup failed for ${email}:`, error.message);
        return null;
    }
}

async function handleUserResponse(user, cacheKey, redis) {
    if (!user) {
        await redis.set(cacheKey, JSON.stringify({ error: 'UNKNOWN' }), { EX: 3600 });
        return null;
    }

    const userInfo = {
        username: user.username,
        // Match main server logic: o > h > m > s falling back to anonymous
        avatar_url: user.avatar_urls?.o || user.avatar_urls?.h || user.avatar_urls?.m || user.avatar_urls?.s || "https://supreme-cheats.xyz/anonymus.png",
        user_id: user.user_id
    };

    // 3. Cache Result (24 hrs)
    await redis.set(cacheKey, JSON.stringify(userInfo), { EX: 86400 });

    return userInfo;
}

module.exports = {
    getUserInfoByEmail
};
