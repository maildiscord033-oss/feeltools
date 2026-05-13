require('dotenv').config();

const { startServer } = require('./web/server');
const { startBot } = require('./bot/client');
const { initializeDB } = require('./modules/db');
const { Protection } = require('./modules/protection');

// Anti-Debug Protection (معطل في السيرفر)
if (!process.env.RAILWAY_ENVIRONMENT && !process.env.NODE_ENV === 'production') {
    Protection.enableProtection();
}

async function main() {
    console.clear();
    
    console.log(`
╔══════════════════════════════════════╗
║          FEEL STORE v1.0.0          ║
║        Advanced Tool Panel          ║
╚══════════════════════════════════════╝
    `);
    
    console.log('[*] Checking environment...');
    Protection.checkEnvironment();
    
    console.log('[*] Initializing database...');
    await initializeDB();
    
    console.log('[*] Starting web server...');
    await startServer();
    
    console.log('[*] Starting Discord bot...');
    await startBot();
    
    const port = process.env.PORT || 3000;
    
    console.log(`
╔══════════════════════════════════════╗
║  [SUCCESS] All Systems Online       ║
║  Web: http://localhost:${port}            ║
║  Bot: Online & Ready                ║
╚══════════════════════════════════════╝
    `);
    
    // فتح المتصفح تلقائياً (محلياً فقط)
    if (!process.env.RAILWAY_ENVIRONMENT) {
        try {
            const open = require('open');
            await open(`http://localhost:${port}`);
        } catch (e) {
            console.log(`[*] Open: http://localhost:${port}`);
        }
    }
}

main().catch(err => {
    console.error(`[ERROR] ${err.message}`);
    console.error(err);
    process.exit(1);
});
