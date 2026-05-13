const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logFile = path.join(__dirname, '..', 'data', 'system.log');
        this.ensureLogFile();
    }
    
    ensureLogFile() {
        const dir = path.dirname(this.logFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };
        
        const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}\n`;
        
        fs.appendFileSync(this.logFile, logLine);
        
        const colors = {
            info: '\x1b[36m',
            warn: '\x1b[33m',
            error: '\x1b[31m',
            success: '\x1b[32m'
        };
        
        const color = colors[level] || '\x1b[0m';
        console.log(`${color}${logLine}\x1b[0m`);
    }
    
    info(message, data) {
        this.log('info', message, data);
    }
    
    warn(message, data) {
        this.log('warn', message, data);
    }
    
    error(message, data) {
        this.log('error', message, data);
    }
    
    success(message, data) {
        this.log('success', message, data);
    }
    
    getLogs(lines = 100) {
        try {
            const content = fs.readFileSync(this.logFile, 'utf8');
            const logLines = content.trim().split('\n');
            return logLines.slice(-lines);
        } catch {
            return [];
        }
    }
}

module.exports = new Logger();