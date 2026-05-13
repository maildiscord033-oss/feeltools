require('dotenv').config();

const { startServer } = require('./web/server');
const { startBot } = require('./bot/client');
const { initializeDB } = require('./modules/db');
const { Protection } = require('./modules/protection');

// Anti-Debug (معطل في Railway)
if (!process.env.RAILWAY_ENVIRONMENT) {
    Protection.enableProtection();
}

async function main() {
    console.log(`
╔══════════════════════════════════════╗
║          FEEL STORE v1.0.0          ║
║        Railway Deployment           ║
╚══════════════════════════════════════╝
    `);
    
    console.log('[*] Checking environment...');
    Protection.checkEnvironment();
    
    console.log('[*] Initializing database...');
    await initializeDB();
    
    console.log('[*] Starting web server...');
    await startServer();
    
    // البوت في Railway - اختياري
    if (process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN !== '') {
        console.log('[*] Starting Discord bot...');
        try {
            await startBot();
        } catch(e) {
            console.log('[!] Bot start failed, continuing with web only');
        }
    } else {
        console.log('[*] No bot token, skipping bot...');
    }
    
    const port = process.env.PORT || 3000;
    console.log(`[SUCCESS] Server running on port ${port}`);
}

main().catch(err => {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
});
