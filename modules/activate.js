const { db } = require('./db');
const { HWIDGenerator } = require('./hwid');

class ActivationSystem {
    constructor() {
        this.activeSessions = new Map();
    }
    
    validateAndActivate(code, hwid) {
        if (!code || !hwid) {
            return { success: false, error: 'Missing code or HWID' };
        }
        
        if (!HWIDGenerator.validate(hwid)) {
            return { success: false, error: 'Invalid HWID format' };
        }
        
        if (db.isBlacklisted(hwid)) {
            db.addLog(`Blacklisted HWID attempted: ${hwid.substring(0, 16)}...`);
            return { success: false, error: 'Device blacklisted' };
        }
        
        const result = db.validateKey(code, hwid);
        
        if (!result.valid) {
            return { success: false, error: result.reason };
        }
        
        const sessionId = this.createSession(code, hwid);
        
        return {
            success: true,
            sessionId,
            key: result.key
        };
    }
    
    createSession(code, hwid) {
        const sessionId = require('crypto').randomUUID();
        this.activeSessions.set(sessionId, {
            code,
            hwid,
            createdAt: new Date(),
            lastActivity: new Date()
        });
        return sessionId;
    }
    
    validateSession(sessionId, hwid) {
        const session = this.activeSessions.get(sessionId);
        
        if (!session) {
            return false;
        }
        
        if (session.hwid !== hwid) {
            this.activeSessions.delete(sessionId);
            return false;
        }
        
        // Check session age (24 hours max)
        const age = Date.now() - session.createdAt.getTime();
        if (age > 24 * 60 * 60 * 1000) {
            this.activeSessions.delete(sessionId);
            return false;
        }
        
        session.lastActivity = new Date();
        return true;
    }
    
    getActiveSessions() {
        return this.activeSessions.size;
    }
    
    getSessionInfo(sessionId) {
        return this.activeSessions.get(sessionId) || null;
    }
}

module.exports = new ActivationSystem();