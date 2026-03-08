const config = require('../config');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const secretFile = path.join(__dirname, '..', 'data', 'totp_secret.txt');
let totpSecret = ''; // We will store the base32 secret here

// Initialize TOTP
function initAuth() {
    try {
        if (config.totpSecret) {
            totpSecret = config.totpSecret;
            console.log('[Auth] Using TOTP secret from Environment/Config.');
            return;
        }

        if (fs.existsSync(secretFile)) {
            totpSecret = fs.readFileSync(secretFile, 'utf8').trim();
            console.log('[Auth] Loaded existing TOTP secret from file.');
        } else {
            // Generate a new secret
            const secretObj = speakeasy.generateSecret({ name: 'SupremeWallet (Admin)' });
            totpSecret = secretObj.base32;

            fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
            fs.writeFileSync(secretFile, totpSecret, 'utf8');

            console.log('\n==================================================');
            console.log('🔒 NEW 2FA SECRET GENERATED 🔒');
            console.log('==================================================');
            console.log('Please scan the QR code below with Google Authenticator or Authy.');
            console.log('Manual Setup Key:', totpSecret);
            console.log('==================================================\n');

            qrcode.generate(secretObj.otpauth_url, { small: true });
        }
    } catch (err) {
        console.error('[Auth] Failed to initialize TOTP', err);
    }
}

// Call on load
initAuth();

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }

    // Check if it's an API route or page load
    if (req.path.startsWith('/api/') && req.path !== '/api/login') {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    // Redirect to login for page loads
    const base = config.basePath || '';
    res.redirect(`${base}/login.html`);
}

// Controller for login
function login(req, res) {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Verification code is required' });
    }

    try {
        const isValid = speakeasy.totp.verify({
            secret: totpSecret,
            encoding: 'base32',
            token: code,
            window: 1 // Allow 1 step before/after to account for clock drift
        });

        if (isValid) {
            req.session.authenticated = true;
            req.session.user = 'Admin';
            return res.json({ success: true, message: 'Logged in successfully' });
        }
    } catch (err) {
        // format error
        console.error(err);
    }

    res.status(401).json({ error: 'Invalid authenticator code' });
}

// Controller for logout
function logout(req, res) {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully' });
    });
}

// Controller to check session status
function checkSession(req, res) {
    if (req.session && req.session.authenticated) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
}

module.exports = {
    isAuthenticated,
    login,
    logout,
    checkSession
};
