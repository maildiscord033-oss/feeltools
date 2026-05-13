const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const axios = require('axios');
const {
    validateKey, getUserTools, isBlacklisted, getStats,
    readJSON, writeJSON, KEYS_FILE, HWID_FILE, LOGS_FILE, addLog
} = require('../modules/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] } });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.set('trust proxy', 1);
app.use('/api/', rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    max: 300, 
    message: { error: 'طلبات كثيرة' },
    validate: { xForwardedForHeader: false }
}));
app.use(express.static(path.join(__dirname, '..', 'dashboard')));

// ========== API ==========

app.post('/api/activate', (req, res) => {
    const { code, hwid } = req.body;
    if (!code || !hwid) return res.json({ success: false, error: 'Missing code or HWID' });
    if (isBlacklisted(hwid)) return res.json({ success: false, error: 'الجهاز محظور' });
    const result = validateKey(code, hwid);
    if (result.valid) return res.json({ success: true, key: result.key });
    return res.json({ success: false, error: result.reason });
});

app.post('/api/webhook/send', async (req, res) => {
    const { webhook, content, embeds, username, avatar_url } = req.body;
    if (!webhook) return res.status(400).json({ success: false, error: 'الرابط مطلوب' });
    try {
        const payload = {};
        if (content) payload.content = content;
        if (embeds) payload.embeds = Array.isArray(embeds) ? embeds : [embeds];
        if (username) payload.username = username;
        if (avatar_url) payload.avatar_url = avatar_url;
        await axios.post(webhook, payload);
        addLog('تم إرسال رسالة ويبهوك');
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

app.post('/api/webhook/check', async (req, res) => {
    const { webhook } = req.body;
    if (!webhook) return res.json({ valid: false, error: 'الرابط مطلوب' });
    try {
        const r = await axios.get(webhook);
        res.json({ valid: true, data: { name: r.data.name, channel_id: r.data.channel_id, guild_id: r.data.guild_id } });
    } catch (err) { res.json({ valid: false, error: err.message }); }
});

app.delete('/api/webhook/delete', async (req, res) => {
    const { webhook } = req.body;
    if (!webhook) return res.json({ success: false, error: 'الرابط مطلوب' });
    try { await axios.delete(webhook); addLog('تم حذف رسالة ويبهوك'); res.json({ success: true }); }
    catch (err) { res.json({ success: false, error: err.message }); }
});

app.patch('/api/webhook/modify', async (req, res) => {
    const { webhook, name, avatar } = req.body;
    if (!webhook) return res.json({ success: false, error: 'الرابط مطلوب' });
    try {
        const p = {}; if (name) p.name = name; if (avatar) p.avatar = avatar;
        await axios.patch(webhook, p); addLog('تم تعديل مظهر الويبهوك'); res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// نسخ السيرفرات
// نسخ السيرفرات (مطور - فئات + رومات + رتب + ترتيب)
app.post('/api/tools/server-cloner', async (req, res) => {
    const { token, source, target, options } = req.body;
    if (!token || !source || !target) return res.json({ success: false, error: 'بيانات ناقصة' });
    
    try {
        const headers = {
            Authorization: token,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0'
        };

        // ===== المرحلة 0: التحقق من الصلاحية =====
        const userRes = await axios.get('https://discord.com/api/v9/users/@me', { headers });
        const userId = userRes.data.id;
        
        // التحقق من صلاحية الحساب في السيرفرين
        const srcMember = await axios.get(`https://discord.com/api/v9/guilds/${source}/members/${userId}`, { headers }).catch(() => null);
        const tgtMember = await axios.get(`https://discord.com/api/v9/guilds/${target}/members/${userId}`, { headers }).catch(() => null);
        
        if (!srcMember) return res.json({ success: false, error: 'الحساب ليس عضواً في السيرفر المصدر' });
        if (!tgtMember) return res.json({ success: false, error: 'الحساب ليس عضواً في السيرفر الهدف' });
        
        const srcPerms = BigInt(srcMember.data.permissions || 0);
        const tgtPerms = BigInt(tgtMember.data.permissions || 0);
        const ADMIN = BigInt(0x8);
        const MANAGE_GUILD = BigInt(0x20);
        const MANAGE_CHANNELS = BigInt(0x10);
        const MANAGE_ROLES = BigInt(0x10000000);
        
        if (!(tgtPerms & ADMIN) && !(tgtPerms & MANAGE_GUILD)) {
            return res.json({ success: false, error: 'الحساب لا يملك صلاحية ADMINISTRATOR أو MANAGE_GUILD في السيرفر الهدف' });
        }

        // ===== المرحلة 1: حذف كل شيء في السيرفر الهدف =====
        if (options.deleteFirst) {
            addLog(`بدء حذف محتويات السيرفر الهدف ${target}...`);
            
            // حذف جميع الرومات (بما فيها الفئات)
            const tgtChannels = await axios.get(`https://discord.com/api/v9/guilds/${target}/channels`, { headers });
            
            // حذف الرومات أولاً ثم الفئات
            const regularChannels = tgtChannels.data.filter(c => c.type !== 4); // غير الفئات
            const categories = tgtChannels.data.filter(c => c.type === 4); // الفئات
            
            // حذف الرومات العادية
            for (const ch of regularChannels) {
                try {
                    await axios.delete(`https://discord.com/api/v9/guilds/${target}/channels/${ch.id}`, { headers });
                } catch(e) {}
                await new Promise(r => setTimeout(r, 100));
            }
            
            // حذف الفئات
            for (const cat of categories) {
                try {
                    await axios.delete(`https://discord.com/api/v9/guilds/${target}/channels/${cat.id}`, { headers });
                } catch(e) {}
                await new Promise(r => setTimeout(r, 100));
            }
            
            // حذف الرتب (ما عدا @everyone والرتب المدارة)
            const tgtRoles = await axios.get(`https://discord.com/api/v9/guilds/${target}/roles`, { headers });
            const rolesToDelete = tgtRoles.data.filter(r => 
                r.name !== '@everyone' && !r.managed && r.id !== target // ما يحذف رتبة everyone ولا الرتب اللي يديرها بوت
            );
            
            // حذف من الأعلى للأدنى
            for (const role of rolesToDelete.sort((a, b) => b.position - a.position)) {
                try {
                    await axios.delete(`https://discord.com/api/v9/guilds/${target}/roles/${role.id}`, { headers });
                } catch(e) {}
                await new Promise(r => setTimeout(r, 100));
            }
            
            addLog(`تم حذف جميع الرومات والرتب من السيرفر الهدف`);
            await new Promise(r => setTimeout(r, 2000)); // انتظار ثانيتين بعد الحذف
        }

        // ===== المرحلة 2: جلب بيانات السيرفر المصدر =====
        const srcChannels = await axios.get(`https://discord.com/api/v9/guilds/${source}/channels`, { headers });
        const srcRoles = await axios.get(`https://discord.com/api/v9/guilds/${source}/roles`, { headers });
        
        const categories = srcChannels.data.filter(c => c.type === 4); // 4 = GUILD_CATEGORY
        const textChannels = srcChannels.data.filter(c => c.type === 0); // 0 = GUILD_TEXT
        const voiceChannels = srcChannels.data.filter(c => c.type === 2); // 2 = GUILD_VOICE
        const otherChannels = srcChannels.data.filter(c => ![0, 2, 4].includes(c.type)); // باقي الأنواع
        
        const categoryMap = {}; // ربط ايدي الفئة القديم بالجديد
        const roleMap = {}; // ربط ايدي الرتبة القديم بالجديد

        // ===== المرحلة 3: إنشاء الرتب (من الأدنى للأعلى لعكس ترتيب المصدر) =====
        if (options.roles) {
            addLog(`جاري نسخ ${srcRoles.data.length} رتبة...`);
            
            const rolesToCreate = srcRoles.data
                .filter(r => r.name !== '@everyone' && !r.managed)
                .sort((a, b) => a.position - b.position); // من الأدنى للأعلى
            
            for (const role of rolesToCreate) {
                try {
                    const newRole = await axios.post(
                        `https://discord.com/api/v9/guilds/${target}/roles`,
                        {
                            name: role.name,
                            permissions: String(role.permissions),
                            color: role.color,
                            hoist: role.hoist,
                            mentionable: role.mentionable,
                            position: role.position
                        },
                        { headers }
                    );
                    roleMap[role.id] = newRole.data.id;
                    
                    // إذا كانت الرتبة لها نفس اللون أو أيقونة خاصة
                    if (role.icon) {
                        try {
                            await axios.patch(
                                `https://discord.com/api/v9/guilds/${target}/roles/${newRole.data.id}`,
                                { icon: role.icon },
                                { headers }
                            );
                        } catch(e) {}
                    }
                    
                    addLog(`تم نسخ الرتبة: ${role.name}`);
                } catch(e) {
                    addLog(`فشل نسخ الرتبة: ${role.name} - ${e.message}`);
                }
                await new Promise(r => setTimeout(r, 250));
            }
        }

        // ===== المرحلة 4: إنشاء الفئات أولاً =====
        if (options.channels) {
            addLog(`جاري إنشاء ${categories.length} فئة...`);
            
            for (const cat of categories.sort((a, b) => a.position - b.position)) {
                try {
                    const newCat = await axios.post(
                        `https://discord.com/api/v9/guilds/${target}/channels`,
                        {
                            name: cat.name,
                            type: 4,
                            position: cat.position,
                            permission_overwrites: cat.permission_overwrites || []
                        },
                        { headers }
                    );
                    categoryMap[cat.id] = newCat.data.id;
                    addLog(`تم إنشاء الفئة: ${cat.name}`);
                } catch(e) {
                    addLog(`فشل إنشاء الفئة: ${cat.name} - ${e.message}`);
                }
                await new Promise(r => setTimeout(r, 300));
            }

            // ===== المرحلة 5: إنشاء الرومات النصية داخل فئاتها =====
            addLog(`جاري إنشاء ${textChannels.length} روم نصي...`);
            
            for (const ch of textChannels.sort((a, b) => a.position - b.position)) {
                try {
                    const channelData = {
                        name: ch.name,
                        type: 0,
                        position: ch.position,
                        permission_overwrites: ch.permission_overwrites || []
                    };
                    
                    // ربط الروم بفئته
                    if (ch.parent_id && categoryMap[ch.parent_id]) {
                        channelData.parent_id = categoryMap[ch.parent_id];
                    }
                    
                    if (ch.topic) channelData.topic = ch.topic;
                    if (ch.nsfw !== undefined) channelData.nsfw = ch.nsfw;
                    if (ch.rate_limit_per_user) channelData.rate_limit_per_user = ch.rate_limit_per_user;
                    
                    await axios.post(`https://discord.com/api/v9/guilds/${target}/channels`, channelData, { headers });
                    addLog(`تم إنشاء الروم: #${ch.name}`);
                } catch(e) {
                    addLog(`فشل إنشاء الروم: #${ch.name} - ${e.message}`);
                }
                await new Promise(r => setTimeout(r, 250));
            }

            // ===== المرحلة 6: إنشاء الرومات الصوتية داخل فئاتها =====
            addLog(`جاري إنشاء ${voiceChannels.length} روم صوتي...`);
            
            for (const ch of voiceChannels.sort((a, b) => a.position - b.position)) {
                try {
                    const channelData = {
                        name: ch.name,
                        type: 2,
                        position: ch.position,
                        permission_overwrites: ch.permission_overwrites || []
                    };
                    
                    if (ch.parent_id && categoryMap[ch.parent_id]) {
                        channelData.parent_id = categoryMap[ch.parent_id];
                    }
                    
                    if (ch.bitrate) channelData.bitrate = ch.bitrate;
                    if (ch.user_limit) channelData.user_limit = ch.user_limit;
                    if (ch.rtc_region) channelData.rtc_region = ch.rtc_region;
                    
                    await axios.post(`https://discord.com/api/v9/guilds/${target}/channels`, channelData, { headers });
                    addLog(`تم إنشاء الروم الصوتي: 🔊 ${ch.name}`);
                } catch(e) {
                    addLog(`فشل إنشاء الروم الصوتي: ${ch.name} - ${e.message}`);
                }
                await new Promise(r => setTimeout(r, 250));
            }

            // ===== المرحلة 7: إنشاء باقي أنواع الرومات =====
            if (otherChannels.length > 0) {
                addLog(`جاري إنشاء ${otherChannels.length} روم إضافي...`);
                
                for (const ch of otherChannels.sort((a, b) => a.position - b.position)) {
                    try {
                        const channelData = {
                            name: ch.name,
                            type: ch.type,
                            position: ch.position,
                            permission_overwrites: ch.permission_overwrites || []
                        };
                        
                        if (ch.parent_id && categoryMap[ch.parent_id]) {
                            channelData.parent_id = categoryMap[ch.parent_id];
                        }
                        
                        await axios.post(`https://discord.com/api/v9/guilds/${target}/channels`, channelData, { headers });
                    } catch(e) {}
                    await new Promise(r => setTimeout(r, 200));
                }
            }
        }

        // ===== المرحلة 8: تحديث صلاحيات الرومات لاستخدام الرتب الجديدة =====
        if (Object.keys(roleMap).length > 0) {
            try {
                const updatedChannels = await axios.get(`https://discord.com/api/v9/guilds/${target}/channels`, { headers });
                
                for (const ch of updatedChannels.data) {
                    if (!ch.permission_overwrites || ch.permission_overwrites.length === 0) continue;
                    
                    let needsUpdate = false;
                    const newOverwrites = ch.permission_overwrites.map(ow => {
                        if (roleMap[ow.id]) {
                            needsUpdate = true;
                            return { ...ow, id: roleMap[ow.id] };
                        }
                        return ow;
                    });
                    
                    if (needsUpdate) {
                        try {
                            await axios.patch(
                                `https://discord.com/api/v9/guilds/${target}/channels/${ch.id}`,
                                { permission_overwrites: newOverwrites },
                                { headers }
                            );
                        } catch(e) {}
                        await new Promise(r => setTimeout(r, 100));
                    }
                }
            } catch(e) {}
        }

        addLog(`تم نسخ السيرفر بالكامل: ${source} -> ${target}`);
        res.json({ success: true, message: 'تم نسخ السيرفر بنجاح!' });
        
    } catch(err) {
        addLog(`خطأ في نسخ السيرفر: ${err.message}`);
        res.json({ success: false, error: err.message });
    }
});

// ضرب بوستات (API الجديد - يضرب كل البوستات المتاحة)
app.post('/api/tools/booster', async (req, res) => {
    const { token, invite } = req.body;
    if (!token || !invite) return res.json({ success: false, error: 'بيانات ناقصة' });
    
    try {
        const headers = {
            Authorization: token,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'X-Discord-Locale': 'en-US',
            'X-Debug-Options': 'bugReporterEnabled'
        };
        
        // 1. استخراج كود الدعوة
        const inviteCode = invite
            .replace('https://discord.gg/', '')
            .replace('https://discord.com/invite/', '')
            .replace('discord.gg/', '')
            .trim();
        
        // 2. جلب معلومات الدعوة والسيرفر
        let guildId, guildName;
        try {
            const inviteInfo = await axios.get(
                `https://discord.com/api/v9/invites/${inviteCode}?with_counts=true`,
                { headers }
            );
            guildId = inviteInfo.data.guild.id;
            guildName = inviteInfo.data.guild.name;
        } catch(e) {
            return res.json({ success: false, error: 'رابط الدعوة غير صالح' });
        }
        
        // 3. جلب اشتراكات المستخدم مباشرة
        let subscriptions = [];
        try {
            const subsRes = await axios.get(
                'https://discord.com/api/v9/users/@me/billing/subscriptions',
                { headers }
            );
            subscriptions = subsRes.data || [];
        } catch(e) {
            return res.json({ success: false, error: 'فشل جلب الاشتراكات' });
        }
        
        // 4. البحث عن اشتراكات النيترو
        const nitroSubs = subscriptions.filter(sub => {
            const name = (sub.name || '').toLowerCase();
            const status = sub.status; // 1 = active, 2 = past due
            const type = sub.type; // 1 = nitro
            
            // نتأكد إنه نيترو حقيقي
            const isNitro = 
                name.includes('nitro') || 
                name.includes('premium') ||
                name.includes('boosting');
            
            const isActive = status === 1 || status === 2 || status === 3;
            
            // طباعة للتشخيص
            if (isNitro) {
                console.log(`[Booster] Found subscription: ${sub.name}, Status: ${status}, Type: ${type}`);
            }
            
            return isNitro && isActive;
        });
        
        if (nitroSubs.length === 0) {
            // البحث عن أي اشتراك
            const anySubs = subscriptions.filter(s => s.status === 1);
            console.log(`[Booster] No nitro found. Total active subscriptions: ${anySubs.length}`);
            
            if (anySubs.length === 0) {
                return res.json({ 
                    success: true, 
                    boosted: false, 
                    noNitro: true,
                    message: 'لا يوجد نيترو نشط في هذا الحساب'
                });
            }
            
            // محاولة استخدام أي اشتراك نشط
            nitroSubs.push(...anySubs);
        }
        
        // 5. التأكد من العضوية في السيرفر
        let isMember = false;
        try {
            await axios.get(
                `https://discord.com/api/v9/guilds/${guildId}/members/@me`,
                { headers }
            );
            isMember = true;
        } catch(e) {
            // الانضمام للسيرفر
            try {
                await axios.post(
                    `https://discord.com/api/v9/invites/${inviteCode}`,
                    {},
                    { headers }
                );
                isMember = true;
                await new Promise(r => setTimeout(r, 2000));
            } catch(joinErr) {
                return res.json({ success: false, error: 'فشل الانضمام للسيرفر' });
            }
        }
        
        // 6. ضرب البوست - الطريقة الصحيحة
        let boosted = false;
        let attempts = 0;
        
        for (const sub of nitroSubs) {
            attempts++;
            
            try {
                // الطريقة 1: استخدام subscription_id مباشرة
                const boostPayload = {
                    user_premium_guild_subscription_slot_ids: [sub.id]
                };
                
                const boostRes = await axios.put(
                    `https://discord.com/api/v9/guilds/${guildId}/premium/subscriptions`,
                    boostPayload,
                    { headers }
                );
                
                if (boostRes.status === 201 || boostRes.status === 200) {
                    boosted = true;
                    console.log(`[Booster] Boost success! Method 1, sub: ${sub.id}`);
                    break;
                }
            } catch(err1) {
                console.log(`[Booster] Method 1 failed: ${err1.response?.status} ${err1.response?.data?.message}`);
                
                // الطريقة 2: استخدام guild premium
                try {
                    const boostRes2 = await axios.put(
                        `https://discord.com/api/v9/guilds/${guildId}/premium/subscriptions/@me`,
                        { user_id: sub.user_id },
                        { headers }
                    );
                    
                    if (boostRes2.status === 201 || boostRes2.status === 200) {
                        boosted = true;
                        console.log(`[Booster] Boost success! Method 2`);
                        break;
                    }
                } catch(err2) {
                    console.log(`[Booster] Method 2 failed: ${err2.response?.status}`);
                    
                    // الطريقة 3: محاولة مع tier
                    try {
                        const boostRes3 = await axios.put(
                            `https://discord.com/api/v9/guilds/${guildId}/premium/subscriptions`,
                            { 
                                user_premium_guild_subscription_slot_ids: [sub.id],
                                location: 'Guild Settings' 
                            },
                            { 
                                headers,
                                validateStatus: () => true 
                            }
                        );
                        
                        if (boostRes3.status === 201 || boostRes3.status === 200 || boostRes3.status === 204) {
                            boosted = true;
                            console.log(`[Booster] Boost success! Method 3`);
                            break;
                        }
                    } catch(err3) {
                        console.log(`[Booster] Method 3 failed: ${err3.message}`);
                    }
                }
            }
        }
        
        // 7. التحقق من نجاح البوست
        if (boosted) {
            addLog(`✅ بوست: ${inviteCode} -> ${guildName}`);
            res.json({ success: true, boosted: true, guildName, attempts });
        } else {
            // قد يكون ضارب كل بوستاته
            res.json({ 
                success: true, 
                boosted: false, 
                alreadyIn: true,
                message: 'قد تكون جميع البوستات مستخدمة مسبقاً',
                attempts
            });
        }
        
    } catch(err) {
        console.log(`[Booster] Fatal error: ${err.message}`);
        res.json({ success: false, error: err.message });
    }
});

app.get('/api/stats', (req, res) => res.json(getStats()));
app.get('/api/logs', (req, res) => res.json(readJSON(LOGS_FILE).slice(-100)));
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// WebSocket
io.on('connection', (socket) => {
    console.log('[Socket] متصل');
    socket.on('disconnect', () => console.log('[Socket] غير متصل'));
});
app.set('io', io);

function startServer() {
    const port = process.env.PORT || 3000;
    return new Promise((resolve) => {
        server.listen(port, '0.0.0.0', () => {
            console.log(`[Web] يعمل على http://0.0.0.0:${port}`);
            resolve(server);
        });
    });
}

module.exports = { startServer, app, io };
