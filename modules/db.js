const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const HWID_FILE = path.join(DATA_DIR, 'hwid.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'FEEL_STORE_SECRET_KEY_2024';

const ALL_TOOLS = [
    'webhook', 'embed', 'spam', 'profile', 'multi', 'scheduler', 'deleter',
    'server-cloner', 'booster', 'nitro-gen', 'nitro-pro', 'nitro-promo',
    'token-login', 'bot-login', 'username-sniper'
];

function initializeDB() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(KEYS_FILE)) writeJSON(KEYS_FILE, []);
    if (!fs.existsSync(HWID_FILE)) writeJSON(HWID_FILE, []);
    if (!fs.existsSync(LOGS_FILE)) writeJSON(LOGS_FILE, []);
    console.log('[DB] Database initialized successfully');
}

function encryptData(data) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
}

function decryptData(encrypted) {
    try {
        const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (e) { return []; }
}

function readJSON(filePath) {
    try { return decryptData(fs.readFileSync(filePath, 'utf8')); } 
    catch (e) { return []; }
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, encryptData(data), 'utf8');
}

function createKey(duration = 'permanent', maxDevices = 1, clientName = '', tools = ['all']) {
    const keys = readJSON(KEYS_FILE);
    const code = `FEEL-${genSegment()}-${genSegment()}-${genSegment()}`;
    
    const keyData = {
        code,
        duration,
        maxDevices,
        clientName,
        tools: tools.includes('all') ? ALL_TOOLS : tools,
        createdAt: new Date().toISOString(),
        expiresAt: calcExpiry(duration),
        hwids: [],
        used: false,
        active: true
    };
    
    keys.push(keyData);
    writeJSON(KEYS_FILE, keys);
    addLog(`Key created: ${code} - Tools: ${keyData.tools.length}`);
    return keyData;
}

function genSegment() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function calcExpiry(duration) {
    const now = new Date();
    const multipliers = { day: 1, week: 7, month: 30 };
    return multipliers[duration] ? new Date(now.getTime() + multipliers[duration]*24*60*60*1000).toISOString() : 'never';
}

function validateKey(code, hwid) {
    const keys = readJSON(KEYS_FILE);
    const key = keys.find(k => k.code === code);
    
    if (!key || !key.active) return { valid: false, reason: 'Invalid key' };
    if (key.expiresAt !== 'never' && new Date(key.expiresAt) < new Date()) return { valid: false, reason: 'Key expired' };
    if (key.hwids.length >= key.maxDevices && !key.hwids.includes(hwid)) return { valid: false, reason: 'Key already used on another device' };
    
    if (!key.hwids.includes(hwid)) {
        key.hwids.push(hwid);
        key.used = true;
        writeJSON(KEYS_FILE, keys);
        addLog(`Activation: ${code} -> ${hwid.substring(0,16)}...`);
    }
    
    return { valid: true, key: { ...key, tools: key.tools } };
}

function getUserTools(code, hwid) {
    const result = validateKey(code, hwid);
    if (!result.valid) return { success: false, error: result.reason };
    return { success: true, tools: result.key.tools };
}

function removeKey(code) {
    let keys = readJSON(KEYS_FILE);
    writeJSON(KEYS_FILE, keys.filter(k => k.code !== code));
    addLog(`Key removed: ${code}`);
}

function resetKey(code) {
    const keys = readJSON(KEYS_FILE);
    const key = keys.find(k => k.code === code);
    if (key) { key.hwids = []; key.used = false; writeJSON(KEYS_FILE, keys); addLog(`Key reset: ${code}`); }
}

function blacklist(hwid) {
    const hwids = readJSON(HWID_FILE);
    if (!hwids.includes(hwid)) { hwids.push(hwid); writeJSON(HWID_FILE, hwids); addLog(`Blacklisted HWID: ${hwid.substring(0,16)}...`); }
}

function isBlacklisted(hwid) {
    return readJSON(HWID_FILE).includes(hwid);
}

function getStats() {
    const keys = readJSON(KEYS_FILE);
    const hwids = readJSON(HWID_FILE);
    return {
        totalKeys: keys.length,
        activeKeys: keys.filter(k => k.active).length,
        expiredKeys: keys.filter(k => k.expiresAt !== 'never' && new Date(k.expiresAt) < new Date()).length,
        totalDevices: keys.reduce((acc, k) => acc + k.hwids.length, 0),
        blacklisted: hwids.length
    };
}

function addLog(message) {
    const logs = readJSON(LOGS_FILE);
    logs.push({ timestamp: new Date().toISOString(), message });
    writeJSON(LOGS_FILE, logs.slice(-500));
}

module.exports = {
    initializeDB, createKey, validateKey, getUserTools, removeKey, resetKey,
    blacklist, isBlacklisted, getStats, addLog,
    readJSON, writeJSON, KEYS_FILE, HWID_FILE, LOGS_FILE, ALL_TOOLS
};