const fs = require('fs').promises;
const path = require('path');
const cryptoUtils = require('./cryptoUtils');

const dataDir = path.join(__dirname, '..', 'data');
const ledgerFile = path.join(dataDir, 'ledger.json');
const webhooksFile = path.join(dataDir, 'webhook_logs.json');

// Ensure data files exist
async function initStorage() {
    try {
        await fs.mkdir(dataDir, { recursive: true });

        try {
            await fs.access(ledgerFile);
        } catch {
            await fs.writeFile(ledgerFile, JSON.stringify([]));
        }

        try {
            await fs.access(webhooksFile);
        } catch {
            await fs.writeFile(webhooksFile, JSON.stringify([]));
        }
    } catch (error) {
        console.error('Storage Initialization Error:', error);
    }
}

async function readJsonFile(filePath) {
    try {
        const rawData = await fs.readFile(filePath, 'utf8');

        // Step 1: Try parsing as plain JSON first (legacy unencrypted files)
        try {
            const parsed = JSON.parse(rawData);
            // File was plaintext - re-save it encrypted so future reads are encrypted
            console.log(`[Storage] Migrating ${path.basename(filePath)} to encrypted format...`);
            await writeJsonFile(filePath, parsed);
            return parsed;
        } catch (plainJsonErr) {
            // Not plain JSON, try decrypting
        }

        // Step 2: Try decrypting
        try {
            const decrypted = cryptoUtils.decrypt(rawData);
            return JSON.parse(decrypted);
        } catch (decryptErr) {
            // CRITICAL: Do NOT reset the file to [] if decryption fails.
            // This preserves the file so the user can fix their ENCRYPTION_KEY.
            console.error(`[Storage] FATAL: Could not decrypt ${path.basename(filePath)}. Check your ENCRYPTION_KEY!`);
            throw new Error(`Data integrity error in ${path.basename(filePath)}. Decryption failed.`);
        }
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        // Log error but don't return [] if it's a decryption error (caught above)
        console.error(`[Storage] Error reading ${path.basename(filePath)}:`, error.message);
        throw error;
    }
}

async function writeJsonFile(filePath, data) {
    const jsonStr = JSON.stringify(data, null, 2);
    const encrypted = cryptoUtils.encrypt(jsonStr);
    await fs.writeFile(filePath, encrypted, 'utf8');
}

// Ledger Operations
async function getLedger() {
    return await readJsonFile(ledgerFile);
}

async function saveLedger(ledgerData) {
    await writeJsonFile(ledgerFile, ledgerData);
}

// Webhook Operations
async function getWebhooks() {
    return await readJsonFile(webhooksFile);
}

async function logWebhook(event) {
    const logs = await getWebhooks();
    logs.unshift({
        id: event.id,
        type: event.type,
        created: event.created,
        object: event.data.object.object,
        status: 'processed',
        received_at: Math.floor(Date.now() / 1000)
    });

    // Keep only last 100 webhook logs to save space
    if (logs.length > 100) logs.pop();

    await writeJsonFile(webhooksFile, logs);
}

module.exports = {
    initStorage,
    getLedger,
    saveLedger,
    getWebhooks,
    logWebhook
};
