const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Protection {
    static enableProtection() {
        this.antiDebug();
        this.hideSensitive();
    }
    
    static antiDebug() {
        if (process.env.NODE_ENV !== 'development') {
            setInterval(() => {
                const start = Date.now();
                debugger;
                if (Date.now() - start > 100) {
                    console.log('[SECURITY] Debugger detected! Exiting...');
                    process.exit(1);
                }
            }, 1000);
        }
    }
    
    static hideSensitive() {
        const originalLog = console.log;
        console.log = function(...args) {
            const filtered = args.map(arg => {
                if (typeof arg === 'string') {
                    return arg.replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{38,}/g, '[TOKEN HIDDEN]');
                }
                return arg;
            });
            originalLog.apply(console, filtered);
        };
    }
    
    static checkEnvironment() {
        const required = ['ENCRYPTION_KEY'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            console.warn(`[WARNING] Missing: ${missing.join(', ')}. Using defaults.`);
        }
        
        if (!process.env.PORT) {
            process.env.PORT = '3000';
        }
    }
}

module.exports = { Protection };