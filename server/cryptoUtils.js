const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

function encrypt(text) {
    if (!text) return text;
    if (!config.encryptionKey) {
        console.warn('[Crypto] No encryption key provided, saving in plaintext!');
        return text;
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = crypto.pbkdf2Sync(config.encryptionKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

function decrypt(cipherText) {
    if (!cipherText) return cipherText;
    if (!config.encryptionKey) return cipherText;

    try {
        const data = Buffer.from(cipherText, 'base64');

        const salt = data.slice(0, SALT_LENGTH);
        const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const tag = data.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        const encrypted = data.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

        const key = crypto.pbkdf2Sync(config.encryptionKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        return decipher.update(encrypted) + decipher.final('utf8');
    } catch (err) {
        console.error('[Crypto] Decryption failed. Data might be corrupted or key is wrong.', err);
        return cipherText; // Fallback to raw if decryption fails (might be unencrypted)
    }
}

module.exports = { encrypt, decrypt };
