const express = require('express');
const router = express.Router();
const { db } = require('../modules/db');
const activationSystem = require('../modules/activate');
const logger = require('../modules/logger');

// Activation
router.post('/activate', (req, res) => {
    const { code, hwid } = req.body;
    const result = activationSystem.validateAndActivate(code, hwid);
    
    logger.info(`Activation attempt: ${code} - ${result.success ? 'Success' : result.error}`);
    
    res.json(result);
});

// Session validation
router.post('/validate-session', (req, res) => {
    const { sessionId, hwid } = req.body;
    const valid = activationSystem.validateSession(sessionId, hwid);
    res.json({ valid });
});

// Webhook send
router.post('/webhook/send', async (req, res) => {
    const { webhook, content, embeds, username, avatar_url, tts } = req.body;
    
    if (!webhook) {
        return res.status(400).json({ success: false, error: 'Webhook URL required' });
    }
    
    try {
        const axios = require('axios');
        const payload = {};
        
        if (content) payload.content = content;
        if (embeds) payload.embeds = Array.isArray(embeds) ? embeds : [embeds];
        if (username) payload.username = username;
        if (avatar_url) payload.avatar_url = avatar_url;
        if (tts) payload.tts = true;
        
        const response = await axios.post(webhook, payload);
        
        logger.info('Webhook message sent successfully');
        
        res.json({
            success: true,
            status: response.status
        });
    } catch (err) {
        logger.error('Webhook send failed', { error: err.message });
        res.json({ success: false, error: err.message });
    }
});

// Webhook check
router.post('/webhook/check', async (req, res) => {
    const { webhook } = req.body;
    
    if (!webhook) {
        return res.status(400).json({ valid: false, error: 'Webhook URL required' });
    }
    
    try {
        const axios = require('axios');
        const response = await axios.get(webhook);
        
        res.json({
            valid: true,
            data: {
                name: response.data.name,
                avatar: response.data.avatar,
                channel_id: response.data.channel_id,
                guild_id: response.data.guild_id
            }
        });
    } catch (err) {
        res.json({ valid: false, error: err.message });
    }
});

// Webhook delete
router.delete('/webhook/delete', async (req, res) => {
    const { webhook } = req.body;
    
    if (!webhook) {
        return res.status(400).json({ success: false, error: 'Webhook URL required' });
    }
    
    try {
        const axios = require('axios');
        await axios.delete(webhook);
        logger.info('Webhook deleted');
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Webhook modify
router.patch('/webhook/modify', async (req, res) => {
    const { webhook, name, avatar } = req.body;
    
    if (!webhook) {
        return res.status(400).json({ success: false, error: 'Webhook URL required' });
    }
    
    try {
        const axios = require('axios');
        const payload = {};
        if (name) payload.name = name;
        if (avatar) payload.avatar = avatar;
        
        await axios.patch(webhook, payload);
        logger.info('Webhook modified');
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Stats
router.get('/stats', (req, res) => {
    const dbStats = db.getStats();
    const activeSessions = activationSystem.getActiveSessions();
    
    res.json({
        ...dbStats,
        activeSessions,
        uptime: process.uptime()
    });
});

// Logs
router.get('/logs', (req, res) => {
    const logs = logger.getLogs(200);
    res.json(logs);
});

// Health check
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

module.exports = router;