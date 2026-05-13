// ========== FEEL STORE - لوحة التحكم ==========

const socket = io();
let userTools = ['all'];
let activationData = null;

// ========== الجسيمات المتحركة ==========
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const particles = Array.from({length: 60}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 1,
    speedX: (Math.random() - 0.5) * 1.2,
    speedY: (Math.random() - 0.5) * 1.2,
    opacity: Math.random() * 0.4 + 0.1
}));
function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, i) => {
        p.x += p.speedX; p.y += p.speedY;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.fillStyle = `rgba(111,110,158,${p.opacity})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
            const dx = p.x - particles[j].x, dy = p.y - particles[j].y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 100) {
                ctx.strokeStyle = `rgba(111,110,158,${0.06 * (1 - dist/100)})`;
                ctx.lineWidth = 0.5; ctx.beginPath();
                ctx.moveTo(p.x, p.y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke();
            }
        }
    });
    requestAnimationFrame(animateParticles);
}
animateParticles();
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

// ========== الإشعارات ==========
function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    div.innerHTML = `<span>${icons[type]}</span> ${msg}`;
    container.appendChild(div);
    setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.5s'; setTimeout(() => div.remove(), 500); }, 3500);
}

// ========== التنقل بين الأقسام ==========
function showSection(name) {
    document.querySelectorAll('#dashboard-content > .section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`section-${name}`);
    if (target) target.classList.add('active');
    document.querySelectorAll('.sidebar nav a').forEach(l => l.classList.remove('active'));
    const link = document.querySelector(`.sidebar nav a[data-section="${name}"]`);
    if (link) link.classList.add('active');
    if (name === 'stats') loadStats();
    if (name === 'logs') loadLogs();
}

document.querySelectorAll('.sidebar nav a[data-section]').forEach(link => {
    link.addEventListener('click', () => showSection(link.dataset.section));
});

// ========== إظهار الأدوات حسب التفعيل ==========
function showTools(tools) {
    userTools = tools;
    document.querySelectorAll('.sidebar nav a[data-section]').forEach(link => {
        const section = link.dataset.section;
        if (['stats','logs'].includes(section)) return;
        if (tools.includes('all')) { link.style.display = 'flex'; return; }
        link.style.display = tools.includes(section) ? 'flex' : 'none';
    });
}

// ========== نظام التفعيل ==========
async function generateHWID() {
    const components = [navigator.userAgent, navigator.language, screen.colorDepth,
        new Date().getTimezoneOffset(), navigator.hardwareConcurrency || 1].join('|');
    const enc = new TextEncoder().encode(components);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function activate() {
    const code = document.getElementById('key-input').value.trim().toUpperCase();
    const rememberMe = document.getElementById('remember-me').checked;
    const statusEl = document.getElementById('activation-status');
    
    if (!code) {
        statusEl.innerHTML = '<span style="color:#dc2626;">الرجاء إدخال مفتاح التفعيل</span>';
        return;
    }
    
    statusEl.innerHTML = '<span style="color:#fbbf24;">⏳ جاري التفعيل...</span>';
    const hwid = await generateHWID();
    
    try {
        const res = await fetch('/api/activate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, hwid })
        });
        const data = await res.json();
        
        if (data.success) {
            activationData = data;
            if (rememberMe) {
                localStorage.setItem('feel_key', code);
                localStorage.setItem('feel_hwid', hwid);
            }
            document.getElementById('activation-screen').classList.remove('active');
            document.getElementById('dashboard-content').classList.add('active');
            document.getElementById('section-webhook').classList.add('active');
            showTools(data.key.tools || ['all']);
            toast(`مرحباً ${data.key.clientName || 'بك'}! تم التفعيل بنجاح`, 'success');
        } else {
            const errors = {
                'invalid': 'المفتاح غير صالح',
                'expired': 'انتهت صلاحية المفتاح',
                'used': 'المفتاح مستخدم على جهاز آخر'
            };
            statusEl.innerHTML = `<span style="color:#dc2626;">❌ ${errors[data.error] || data.error}</span>`;
        }
    } catch (e) {
        statusEl.innerHTML = '<span style="color:#dc2626;">❌ خطأ في الاتصال</span>';
    }
}

// تفعيل تلقائي
window.addEventListener('load', async () => {
    const savedKey = localStorage.getItem('feel_key');
    if (savedKey) {
        document.getElementById('key-input').value = savedKey;
        document.getElementById('remember-me').checked = true;
        await activate();
    }
});

// ========== 1. مرسل الويبهوك ==========
async function checkWebhook() {
    const url = document.getElementById('wh-url').value.trim();
    if (!url) return toast('الرجاء إدخال رابط الويبهوك', 'error');
    try {
        const res = await fetch('/api/webhook/check', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webhook: url })
        });
        const data = await res.json();
        document.getElementById('wh-info').innerHTML = data.valid
            ? `<span class="badge badge-success">✅ صالح</span> الاسم: ${data.data.name} | القناة: ${data.data.channel_id}`
            : `<span class="badge badge-error">❌ ${data.error}</span>`;
    } catch (e) { toast('خطأ في الفحص', 'error'); }
}

async function sendWebhook() {
    const url = document.getElementById('wh-url').value.trim();
    let content = document.getElementById('wh-content').value;
    const everyone = document.getElementById('wh-everyone').checked;
    const resultEl = document.getElementById('wh-result');
    if (!url) return toast('الرجاء إدخال رابط الويبهوك', 'error');
    if (!content) return toast('الرجاء كتابة رسالة', 'error');
    if (everyone) content = '@everyone ' + content;
    try {
        const res = await fetch('/api/webhook/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhook: url, content })
        });
        const data = await res.json();
        resultEl.innerHTML = data.success ? '<span class="badge badge-success">✅ تم الإرسال!</span>' : `<span class="badge badge-error">❌ ${data.error}</span>`;
        if (data.success) toast('تم إرسال الرسالة!', 'success');
    } catch (e) { resultEl.innerHTML = '<span class="badge badge-error">خطأ</span>'; }
}

function saveWebhook() {
    const url = document.getElementById('wh-url').value.trim();
    if (url) {
        let webhooks = JSON.parse(localStorage.getItem('feel_webhooks') || '[]');
        if (!webhooks.includes(url)) { webhooks.push(url); localStorage.setItem('feel_webhooks', JSON.stringify(webhooks)); toast('تم حفظ الويبهوك!', 'success'); }
    }
}

// ========== 2. منشئ الامبد ==========
function updateEmbedPreview() {
    document.getElementById('preview-title').textContent = document.getElementById('emb-title').value || 'العنوان هنا';
    document.getElementById('preview-desc').textContent = document.getElementById('emb-desc').value || 'الوصف هنا';
    document.getElementById('preview-footer').textContent = document.getElementById('emb-footer').value || 'التذييل';
    const color = document.getElementById('emb-color').value;
    document.getElementById('embed-preview').style.borderRightColor = color;
    const img = document.getElementById('emb-image').value;
    document.getElementById('preview-image').style.display = img ? 'block' : 'none';
    if (img) document.getElementById('preview-image').src = img;
}
updateEmbedPreview();

async function sendEmbed() {
    const url = document.getElementById('emb-url').value.trim();
    if (!url) return toast('الرجاء إدخال رابط الويبهوك', 'error');
    const embed = {
        title: document.getElementById('emb-title').value,
        description: document.getElementById('emb-desc').value,
        color: parseInt(document.getElementById('emb-color').value.replace('#',''), 16)
    };
    const image = document.getElementById('emb-image').value;
    const footer = document.getElementById('emb-footer').value;
    if (image) embed.image = { url: image };
    if (footer) embed.footer = { text: footer };
    try {
        const res = await fetch('/api/webhook/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhook: url, embeds: [embed] })
        });
        const data = await res.json();
        document.getElementById('emb-result').innerHTML = data.success ? '<span class="badge badge-success">✅ تم!</span>' : `<span class="badge badge-error">❌ ${data.error}</span>`;
    } catch(e) { document.getElementById('emb-result').innerHTML = '<span class="badge badge-error">خطأ</span>'; }
}

// ========== 3. سبام الويبهوك ==========
let spamRunning = false;
async function startSpam() {
    const url = document.getElementById('spam-url').value.trim();
    const msg = document.getElementById('spam-msg').value;
    const amount = parseInt(document.getElementById('spam-amount').value) || 10;
    const delay = parseInt(document.getElementById('spam-delay').value) || 500;
    if (!url) return toast('الرجاء إدخال رابط الويبهوك', 'error');
    spamRunning = true;
    document.getElementById('spam-start').style.display = 'none';
    document.getElementById('spam-stop').style.display = 'inline-flex';
    for (let i = 0; i < amount && spamRunning; i++) {
        try { await fetch('/api/webhook/send', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({webhook:url,content:msg}) }); }
        catch(e) {}
        document.getElementById('spam-status').textContent = `تم الإرسال: ${i+1}/${amount}`;
        document.getElementById('spam-progress').style.width = `${((i+1)/amount)*100}%`;
        if (delay > 0) await new Promise(r => setTimeout(r, delay));
    }
    stopSpam(); toast('اكتمل السبام!', 'success');
}
function stopSpam() { spamRunning = false; document.getElementById('spam-start').style.display='inline-flex'; document.getElementById('spam-stop').style.display='none'; }

// ========== 4. تغيير المظهر ==========
async function changeProfile() {
    const url = document.getElementById('prof-url').value.trim();
    const name = document.getElementById('prof-name').value;
    const avatar = document.getElementById('prof-avatar').value;
    if (!url) return toast('الرجاء إدخال رابط الويبهوك', 'error');
    try {
        const res = await fetch('/api/webhook/modify', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhook: url, name, avatar })
        });
        const data = await res.json();
        document.getElementById('prof-result').innerHTML = data.success ? '<span class="badge badge-success">✅ تم التحديث!</span>' : `<span class="badge badge-error">❌ ${data.error}</span>`;
    } catch(e) { document.getElementById('prof-result').innerHTML = '<span class="badge badge-error">خطأ</span>'; }
}

// ========== 5. ويبهوكات متعددة ==========
async function sendMulti() {
    const urls = document.getElementById('multi-urls').value.trim().split('\n').filter(u => u.trim());
    const msg = document.getElementById('multi-msg').value;
    if (urls.length === 0) return toast('الرجاء إدخال روابط الويبهوكات', 'error');
    let sent = 0;
    for (const url of urls) {
        try { await fetch('/api/webhook/send', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({webhook:url.trim(),content:msg}) }); sent++; }
        catch(e) {}
    }
    document.getElementById('multi-result').innerHTML = `<span class="badge badge-success">✅ تم الإرسال لـ ${sent}/${urls.length}</span>`;
    toast(`تم الإرسال لـ ${sent} ويبهوك!`, 'success');
}

// ========== 6. الجدولة ==========
let schedulerRunning = false;
async function startScheduler() {
    const url = document.getElementById('sched-url').value.trim();
    const msg = document.getElementById('sched-msg').value;
    const delay = parseInt(document.getElementById('sched-delay').value) || 5;
    const repeat = parseInt(document.getElementById('sched-repeat').value) || 1;
    if (!url) return toast('الرجاء إدخال رابط الويبهوك', 'error');
    schedulerRunning = true;
    document.getElementById('sched-start').style.display='none';
    document.getElementById('sched-stop').style.display='inline-flex';
    for (let i = 0; i < repeat && schedulerRunning; i++) {
        document.getElementById('sched-status').textContent = `⏳ انتظار ${delay} ثانية... (${i+1}/${repeat})`;
        await new Promise(r => setTimeout(r, delay * 1000));
        if (!schedulerRunning) break;
        try { await fetch('/api/webhook/send', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({webhook:url,content:msg}) }); }
        catch(e) {}
        document.getElementById('sched-status').textContent = `✅ تم الإرسال ${i+1}/${repeat}`;
    }
    stopScheduler(); toast('اكتملت الجدولة!', 'success');
}
function stopScheduler() { schedulerRunning = false; document.getElementById('sched-start').style.display='inline-flex'; document.getElementById('sched-stop').style.display='none'; }

// ========== 7. حذف الرسائل ==========
async function deleteMessage() {
    const url = document.getElementById('del-url').value.trim();
    const msgId = document.getElementById('del-msgid').value.trim();
    if (!url || !msgId) return toast('الرجاء إدخال الرابط ومعرف الرسالة', 'error');
    try {
        const res = await fetch('/api/webhook/delete', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhook: `${url}/messages/${msgId}` })
        });
        const data = await res.json();
        document.getElementById('del-result').innerHTML = data.success ? '<span class="badge badge-success">✅ تم الحذف!</span>' : `<span class="badge badge-error">❌ ${data.error}</span>`;
    } catch(e) { document.getElementById('del-result').innerHTML = '<span class="badge badge-error">خطأ</span>'; }
}

// ========== 8. مرسل JSON ==========
async function sendJSON() {
    const url = document.getElementById('json-url').value.trim();
    const raw = document.getElementById('json-payload').value.trim();
    if (!url || !raw) return toast('الرجاء إدخال الرابط و JSON', 'error');
    try {
        const payload = JSON.parse(raw);
        const res = await fetch('/api/webhook/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhook: url, ...payload })
        });
        const data = await res.json();
        document.getElementById('json-result').innerHTML = data.success ? '<span class="badge badge-success">✅ تم!</span>' : `<span class="badge badge-error">❌ ${data.error}</span>`;
    } catch(e) { document.getElementById('json-result').innerHTML = `<span class="badge badge-error">❌ JSON غير صالح</span>`; }
}

// ========== 9. نسخ السيرفرات ==========
async function cloneServer() {
    const token = document.getElementById('cloner-token').value.trim();
    const source = document.getElementById('cloner-source').value.trim();
    const target = document.getElementById('cloner-target').value.trim();
    const deleteFirst = document.getElementById('cloner-delete-first').checked;
    const options = {
        channels: document.getElementById('cloner-channels').checked,
        roles: document.getElementById('cloner-roles').checked,
        deleteFirst
    };
    if (!token || !source || !target) return toast('الرجاء ملء جميع الحقول', 'error');
    document.getElementById('cloner-result').innerHTML = '<span class="badge badge-warning">⏳ جاري النسخ...</span>';
    try {
        const res = await fetch('/api/tools/server-cloner', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, source, target, options })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('cloner-result').innerHTML = '<span class="badge badge-success">✅ تم النسخ بنجاح!</span>';
            toast('اكتمل نسخ السيرفر!', 'success');
        } else {
            document.getElementById('cloner-result').innerHTML = `<span class="badge badge-error">❌ ${data.error}</span>`;
        }
    } catch(e) { document.getElementById('cloner-result').innerHTML = '<span class="badge badge-error">خطأ</span>'; }
}

// ========== 10. ضرب بوستات (مصحح بالكامل) ==========
async function startBooster() {
    const tokensText = document.getElementById('boost-tokens').value.trim();
    const inviteInput = document.getElementById('boost-invite').value.trim();
    
    if (!tokensText) return toast('الرجاء إدخال التوكنات', 'error');
    if (!inviteInput) return toast('الرجاء إدخال رابط السيرفر', 'error');
    
    const tokens = tokensText.split('\n').filter(t => t.trim());
    
    document.getElementById('boost-result').innerHTML = '<span style="color:#fbbf24;">⏳ جاري ضرب البوستات...</span>';
    document.getElementById('boost-progress').style.width = '0%';
    
    let successCount = 0;
    let failCount = 0;
    let noNitroCount = 0;
    let results = [];
    
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i].trim();
        
        try {
            const res = await fetch('/api/tools/booster', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, invite: inviteInput })
            });
            
            const data = await res.json();
            
            if (data.boosted) {
                successCount++;
                results.push({ token: token.substring(0, 20) + '...', status: '✅ بوست' });
            } else if (data.noNitro) {
                noNitroCount++;
                results.push({ token: token.substring(0, 20) + '...', status: '💎 بدون نيترو' });
            } else {
                failCount++;
                results.push({ token: token.substring(0, 20) + '...', status: '❌ فشل' });
            }
        } catch(e) {
            failCount++;
            results.push({ token: token.substring(0, 20) + '...', status: '❌ خطأ' });
        }
        
        // تحديث التقدم
        const progress = ((i + 1) / tokens.length) * 100;
        document.getElementById('boost-progress').style.width = progress + '%';
        
        document.getElementById('boost-result').innerHTML = `
            <div style="margin-bottom:10px;">
                ⏳ ${i + 1}/${tokens.length} | ✅ ${successCount} | 💎 ${noNitroCount} | ❌ ${failCount}
            </div>
            ${results.slice(-5).map(r => 
                `<div style="font-size:11px;color:#B0B0B2;">${r.token}: ${r.status}</div>`
            ).join('')}
        `;
        
        // تأخير بين كل حساب
        await new Promise(r => setTimeout(r, 800));
    }
    
    // النتيجة النهائية
    document.getElementById('boost-result').innerHTML = `
        <div style="background:#010102;border:2px solid #6F6E9E;border-radius:12px;padding:15px;text-align:center;">
            <h3 style="color:#6F6E9E;margin-bottom:10px;">✅ اكتملت العملية</h3>
            <div style="display:flex;justify-content:center;gap:30px;">
                <div><span style="font-size:28px;color:#16a34a;">${successCount}</span><br><span style="font-size:12px;color:#B0B0B2;">بوست</span></div>
                <div><span style="font-size:28px;color:#fbbf24;">${noNitroCount}</span><br><span style="font-size:12px;color:#B0B0B2;">بدون نيترو</span></div>
                <div><span style="font-size:28px;color:#dc2626;">${failCount}</span><br><span style="font-size:12px;color:#B0B0B2;">فشل</span></div>
            </div>
        </div>
    `;
    
    document.getElementById('boost-progress').style.width = '100%';
    
    if (successCount > 0) {
        toast(`✅ تم ضرب ${successCount} بوست!`, 'success');
    } else if (noNitroCount > 0) {
        toast(`💎 ${noNitroCount} حساب بدون نيترو`, 'info');
    } else {
        toast(`❌ فشلت جميع المحاولات`, 'error');
    }
}
// ========== 11. توليد نيترو (مصحح - يرسل روابط قفت ويظهر الشغال) ==========
let nitroGenRunning = false, nitroGenFound = [];

async function startNitroGen() {
    const webhook = document.getElementById('nitrogen-webhook').value.trim();
    const count = parseInt(document.getElementById('nitrogen-count').value) || 100;
    const threads = parseInt(document.getElementById('nitrogen-threads').value) || 5;
    
    nitroGenRunning = true;
    nitroGenFound = [];
    document.getElementById('nitrogen-start').style.display = 'none';
    document.getElementById('nitrogen-stop').style.display = 'inline-flex';
    document.getElementById('nitrogen-valid').innerHTML = '';
    document.getElementById('nitrogen-result').innerHTML = '';
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    function generateCode() {
        let code = '';
        for (let i = 0; i < 24; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }
    
    async function checkAndSend(code) {
        const giftUrl = `https://discord.gift/${code}`;
        
        try {
            const res = await fetch(`https://discord.com/api/v9/entitlements/gift-codes/${code}?with_application=false&with_subscription_plan=true`);
            
            if (res.status === 200) {
                const data = await res.json();
                
                if (data.uses !== undefined && data.max_uses !== undefined && data.uses < data.max_uses) {
                    // ✅ الكود شغال
                    nitroGenFound.push(code);
                    
                    const validEntry = document.createElement('div');
                    validEntry.style.cssText = 'background:#010102;border:1px solid #16a34a;border-radius:8px;padding:10px;margin:5px 0;';
                    validEntry.innerHTML = `
                        <span style="font-size:20px;">🎁</span>
                        <a href="${giftUrl}" target="_blank" style="color:#16a34a;font-weight:bold;">${giftUrl}</a>
                        <span class="badge badge-success">شغال</span>
                        <span style="color:#B0B0B2;font-size:11px;">(${data.uses}/${data.max_uses} uses)</span>
                    `;
                    document.getElementById('nitrogen-valid').appendChild(validEntry);
                    
                    // إرسال للويبهوك
                    if (webhook) {
                        await fetch('/api/webhook/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                webhook: webhook,
                                content: `@here 🎁 **نيترو شغال!**\n${giftUrl}\nUses: ${data.uses}/${data.max_uses}`
                            })
                        }).catch(() => {});
                    }
                    
                    document.getElementById('nitrogen-result').innerHTML = `<span style="color:#16a34a;">✅ وجد كود شغال! ${giftUrl}</span>`;
                    
                } else {
                    // ❌ الكود مستخدم بالكامل - نرسله كقفت
                    if (webhook && Math.random() > 0.7) { // نرسل بعض الأكواد القفت مو كلها
                        await fetch('/api/webhook/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                webhook: webhook,
                                content: `❌ **Gift Used:** ${giftUrl} (${data.uses}/${data.max_uses})`
                            })
                        }).catch(() => {});
                    }
                }
            } else if (res.status === 404) {
                // ❌ كود غير صالح = قفت
                if (webhook && Math.random() > 0.5) {
                    await fetch('/api/webhook/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            webhook: webhook,
                            content: `🎁 **Gift Code:** ${giftUrl}`
                        })
                    }).catch(() => {});
                }
            }
        } catch(e) {}
    }
    
    let checked = 0;
    const interval = setInterval(() => {
        if (!nitroGenRunning || checked >= count) {
            clearInterval(interval);
            stopNitroGen();
            return;
        }
        
        const batch = [];
        const batchSize = Math.min(threads, count - checked);
        for (let i = 0; i < batchSize; i++) {
            batch.push(checkAndSend(generateCode()));
            checked++;
        }
        
        Promise.all(batch);
        
        document.getElementById('nitrogen-result').textContent = `🔍 تم: ${checked}/${count} | 🎁 شغال: ${nitroGenFound.length}`;
        document.getElementById('nitrogen-progress').style.width = `${(checked/count)*100}%`;
        
    }, 0);
    
    setTimeout(() => {
        if (nitroGenRunning) {
            stopNitroGen();
            toast(`✅ اكتمل! وجد ${nitroGenFound.length} كود شغال من ${checked}`, 'success');
        }
    }, 30000); // ايقاف بعد 30 ثانية كحد أقصى
}

function stopNitroGen() {
    nitroGenRunning = false;
    document.getElementById('nitrogen-start').style.display = 'inline-flex';
    document.getElementById('nitrogen-stop').style.display = 'none';
}

// ========== 12. توليد نيترو برو (مصحح) ==========
let nitroProRunning = false, nitroProFound = [];

async function startNitroPro() {
    const webhook = document.getElementById('nitropro-webhook').value.trim();
    const count = parseInt(document.getElementById('nitropro-count').value) || 500;
    const threads = parseInt(document.getElementById('nitropro-threads').value) || 10;
    
    nitroProRunning = true;
    nitroProFound = [];
    document.getElementById('nitropro-start').style.display = 'none';
    document.getElementById('nitropro-stop').style.display = 'inline-flex';
    document.getElementById('nitropro-valid').innerHTML = '';
    document.getElementById('nitropro-result').innerHTML = '';
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const prefixes = ['https://discord.gift/', 'https://discord.com/gifts/', 'https://promos.discord.gg/'];
    
    function generateCode() {
        let code = '';
        for (let i = 0; i < 24; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }
    
    async function checkAndSend(code) {
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const fullUrl = prefix + code;
        
        try {
            const res = await fetch(`https://discord.com/api/v9/entitlements/gift-codes/${code}?with_application=false&with_subscription_plan=true`);
            
            if (res.status === 200) {
                const data = await res.json();
                
                if (data.uses !== undefined && data.max_uses !== undefined && data.uses < data.max_uses) {
                    nitroProFound.push(fullUrl);
                    
                    const entry = document.createElement('div');
                    entry.style.cssText = 'background:#010102;border:1px solid #16a34a;border-radius:8px;padding:10px;margin:5px 0;';
                    entry.innerHTML = `
                        <span>💎</span>
                        <a href="${fullUrl}" target="_blank" style="color:#16a34a;font-weight:bold;">${fullUrl}</a>
                        <span class="badge badge-success">شغال</span>
                    `;
                    document.getElementById('nitropro-valid').appendChild(entry);
                    
                    if (webhook) {
                        await fetch('/api/webhook/send', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ webhook, content: `@here 💎 **نيترو برو شغال!**\n${fullUrl}` })
                        }).catch(() => {});
                    }
                } else {
                    if (webhook && Math.random() > 0.8) {
                        await fetch('/api/webhook/send', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ webhook, content: `❌ **Used:** ${fullUrl}` })
                        }).catch(() => {});
                    }
                }
            } else if (res.status === 404 && webhook && Math.random() > 0.5) {
                await fetch('/api/webhook/send', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ webhook, content: `💎 **Gift:** ${fullUrl}` })
                }).catch(() => {});
            }
        } catch(e) {}
    }
    
    let checked = 0;
    const interval = setInterval(() => {
        if (!nitroProRunning || checked >= count) {
            clearInterval(interval);
            stopNitroPro();
            return;
        }
        
        const batch = [];
        const batchSize = Math.min(threads, count - checked);
        for (let i = 0; i < batchSize; i++) {
            batch.push(checkAndSend(generateCode()));
            checked++;
        }
        
        Promise.all(batch);
        document.getElementById('nitropro-result').textContent = `🔍 ${checked}/${count} | 💎 شغال: ${nitroProFound.length}`;
        document.getElementById('nitropro-progress').style.width = `${(checked/count)*100}%`;
        
    }, 0);
}

function stopNitroPro() {
    nitroProRunning = false;
    document.getElementById('nitropro-start').style.display = 'inline-flex';
    document.getElementById('nitropro-stop').style.display = 'none';
}

// ========== 13. برومو 3 شهور (مصحح) ==========
let nitroPromoRunning = false, nitroPromoFound = [];

async function startNitroPromo() {
    const webhook = document.getElementById('nitropromo-webhook').value.trim();
    const count = parseInt(document.getElementById('nitropromo-count').value) || 300;
    const threads = parseInt(document.getElementById('nitropromo-threads').value) || 8;
    
    nitroPromoRunning = true;
    nitroPromoFound = [];
    document.getElementById('nitropromo-start').style.display = 'none';
    document.getElementById('nitropromo-stop').style.display = 'inline-flex';
    document.getElementById('nitropromo-valid').innerHTML = '';
    document.getElementById('nitropromo-result').innerHTML = '';
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    function generateCode() {
        let code = '';
        for (let i = 0; i < 24; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }
    
    async function checkAndSend(code) {
        const giftUrl = `https://discord.gift/${code}`;
        
        try {
            const res = await fetch(`https://discord.com/api/v9/entitlements/gift-codes/${code}?with_application=false&with_subscription_plan=true`);
            
            if (res.status === 200) {
                const data = await res.json();
                
                if (data.uses !== undefined && data.max_uses !== undefined && data.uses < data.max_uses) {
                    nitroPromoFound.push(giftUrl);
                    
                    const entry = document.createElement('div');
                    entry.style.cssText = 'background:#010102;border:1px solid #16a34a;border-radius:8px;padding:10px;margin:5px 0;';
                    entry.innerHTML = `
                        <span>👑</span>
                        <a href="${giftUrl}" target="_blank" style="color:#16a34a;font-weight:bold;">${giftUrl}</a>
                        <span class="badge badge-success">شغال</span>
                    `;
                    document.getElementById('nitropromo-valid').appendChild(entry);
                    
                    if (webhook) {
                        await fetch('/api/webhook/send', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ webhook, content: `@here 👑 **برومو 3 شهور شغال!**\n${giftUrl}` })
                        }).catch(() => {});
                    }
                } else {
                    if (webhook && Math.random() > 0.7) {
                        await fetch('/api/webhook/send', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ webhook, content: `👑 **Gift:** ${giftUrl} (Used)` })
                        }).catch(() => {});
                    }
                }
            } else if (res.status === 404 && webhook && Math.random() > 0.5) {
                await fetch('/api/webhook/send', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ webhook, content: `👑 **Promo Gift:** ${giftUrl}` })
                }).catch(() => {});
            }
        } catch(e) {}
    }
    
    let checked = 0;
    const interval = setInterval(() => {
        if (!nitroPromoRunning || checked >= count) {
            clearInterval(interval);
            stopNitroPromo();
            return;
        }
        
        const batch = [];
        const batchSize = Math.min(threads, count - checked);
        for (let i = 0; i < batchSize; i++) {
            batch.push(checkAndSend(generateCode()));
            checked++;
        }
        
        Promise.all(batch);
        document.getElementById('nitropromo-result').textContent = `🔍 ${checked}/${count} | 👑 شغال: ${nitroPromoFound.length}`;
        document.getElementById('nitropromo-progress').style.width = `${(checked/count)*100}%`;
        
    }, 0);
}

function stopNitroPromo() {
    nitroPromoRunning = false;
    document.getElementById('nitropromo-start').style.display = 'inline-flex';
    document.getElementById('nitropromo-stop').style.display = 'none';
}

// ========== 14. دخول بالتوكن (إضافة كروم - أسهل وأسرع) ==========
function tokenLogin() {
    const token = document.getElementById('tokenlogin-input').value.trim();
    
    if (!token) {
        document.getElementById('tokenlogin-result').innerHTML = '<span style="color:#dc2626;">❌ الرجاء إدخال التوكن</span>';
        return toast('الرجاء إدخال التوكن', 'error');
    }
    
    // نسخ التوكن تلقائياً
    navigator.clipboard.writeText(token).then(() => {
        toast('✅ تم نسخ التوكن!', 'success');
    }).catch(() => {
        toast('⚠️ لم يتم نسخ التوكن تلقائياً، انسخه يدوياً', 'info');
    });
    
    // فتح صفحة تحميل الإضافة
    const w = window.open('about:blank', '_blank');
    
    if (!w) {
        // إذا مانفتح، نفتح الإضافة مباشرة
        window.open('https://chromewebstore.google.com/detail/discord-token-login/pdmpkpjlmnndlfdllmnekbmgjikhghjg', '_blank');
        document.getElementById('tokenlogin-result').innerHTML = `
            <span style="color:#16a34a;">✅ تم نسخ التوكن وفتح صفحة الإضافة!</span>
            <br><span style="color:#B0B0B2;font-size:12px;">ثبّت الإضافة > الصق التوكن > Login</span>
        `;
        return;
    }
    
    w.document.write(`
        <!DOCTYPE html>
        <html lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>FEEL STORE - Token Login</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: linear-gradient(135deg, #313040, #010102);
                    color: #E1E1E1;
                    font-family: 'Segoe UI', Tahoma, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    text-align: center;
                    direction: rtl;
                }
                .card {
                    background: #010102;
                    border: 2px solid #51526D;
                    border-radius: 24px;
                    padding: 50px 40px;
                    max-width: 550px;
                    width: 90%;
                }
                .icon { font-size: 70px; margin-bottom: 20px; }
                h1 { font-size: 26px; margin-bottom: 10px; color: #E1E1E1; }
                .highlight { color: #6F6E9E; }
                p { color: #B0B0B2; font-size: 14px; line-height: 1.8; margin-bottom: 12px; }
                .steps {
                    text-align: right;
                    background: #313040;
                    border-radius: 16px;
                    padding: 25px;
                    margin: 25px 0;
                }
                .step {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 0;
                    border-bottom: 1px solid #51526D;
                    font-size: 14px;
                }
                .step:last-child { border-bottom: none; }
                .step-num {
                    background: #6F6E9E;
                    color: #fff;
                    width: 30px; height: 30px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 14px;
                    flex-shrink: 0;
                }
                .token-box {
                    background: #010102;
                    border: 2px dashed #51526D;
                    border-radius: 12px;
                    padding: 15px;
                    margin: 15px 0;
                    word-break: break-all;
                    font-family: monospace;
                    font-size: 12px;
                    color: #6F6E9E;
                }
                .btn {
                    display: inline-block;
                    background: #6F6E9E;
                    color: #fff;
                    padding: 14px 35px;
                    border-radius: 12px;
                    text-decoration: none;
                    font-size: 15px;
                    font-weight: bold;
                    cursor: pointer;
                    border: none;
                    margin: 6px;
                    transition: all 0.3s;
                }
                .btn:hover { background: #5c5d8a; transform: translateY(-2px); }
                .btn-store {
                    background: linear-gradient(135deg, #5865F2, #4752c4);
                }
                .btn-store:hover { background: linear-gradient(135deg, #4752c4, #3c45a5); }
                .btn-copy {
                    background: #16a34a;
                }
                .btn-copy:hover { background: #15803d; }
                .copied { color: #16a34a; font-size: 13px; margin-top: 8px; display: none; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">🔐</div>
                <h1>تسجيل الدخول <span class="highlight">بالتوكن</span></h1>
                <p>تم نسخ التوكن تلقائياً. اتبع الخطوات التالية:</p>
                
                <div class="steps">
                    <div class="step">
                        <span class="step-num">1</span>
                        <span>حمل إضافة <strong>Discord Token Login</strong> من سوق كروم</span>
                    </div>
                    <div class="step">
                        <span class="step-num">2</span>
                        <span>ثبت الإضافة في متصفحك</span>
                    </div>
                    <div class="step">
                        <span class="step-num">3</span>
                        <span>الصق التوكن في الإضافة واضغط <strong>Login</strong></span>
                    </div>
                </div>
                
                <div class="token-box" id="tokenBox">${token.substring(0, 30)}...</div>
                <p style="font-size:12px;color:#16a34a;">✅ تم نسخ التوكن تلقائياً إلى الحافظة</p>
                
                <button class="btn btn-copy" onclick="copyAgain()">📋 نسخ التوكن مرة أخرى</button>
                <br>
                <a href="https://chromewebstore.google.com/detail/discord-token-login/pdmpkpjlmnndlfdllmnekbmgjikhghjg" target="_blank" class="btn btn-store">
                    🛒 تحميل الإضافة من سوق كروم
                </a>
                
                <p style="margin-top:15px;font-size:11px;color:#51526D;">
                    الإضافة آمنة ومجانية من سوق Chrome الرسمي
                </p>
            </div>
            
            <script>
                const token = "${token}";
                
                function copyAgain() {
                    navigator.clipboard.writeText(token).then(() => {
                        alert('✅ تم نسخ التوكن!\\n\\nالصقه في الإضافة واضغط Login');
                    }).catch(() => {
                        prompt('انسخ التوكن يدوياً:', token);
                    });
                }
                
                // نسخ تلقائي
                try {
                    navigator.clipboard.writeText(token);
                } catch(e) {}
                
                // فتح صفحة الإضافة تلقائياً بعد 3 ثواني
                setTimeout(() => {
                    window.open('https://chromewebstore.google.com/detail/discord-token-login/pdmpkpjlmnndlfdllmnekbmgjikhghjg', '_blank');
                }, 3000);
            <\/script>
        </body>
        </html>
    `);
    
    w.document.close();
    
    document.getElementById('tokenlogin-result').innerHTML = `
        <div style="background:#010102;border:1px solid #51526D;border-radius:12px;padding:15px;">
            <span style="color:#16a34a;">✅ تم نسخ التوكن وفتح صفحة التحميل!</span>
            <br><br>
            <span style="color:#B0B0B2;font-size:12px;">
                <strong>الخطوات:</strong><br>
                ➀ ثبت الإضافة من سوق كروم<br>
                ➁ الصق التوكن في الإضافة<br>
                ➂ اضغط Login
            </span>
        </div>
    `;
    
    toast('✅ تم نسخ التوكن! ثبت الإضافة والصقه', 'success');
}

// ========== 16. صيد اليوزرات (مصلح) ==========
// ========== 16. صيد اليوزرات - Lao Store Checker مدمج ==========
let sniperRunning = false;
let sniperFound = [];
let sniperTokens = [];
let currentTokenIndex = 0;

function toggleSniperOptions() {
    const type = document.getElementById('sniper-type').value;
    document.getElementById('sniper-custom').style.display = type === 'custom' ? 'block' : 'none';
}

function getSniperHeaders() {
    const multiToken = document.getElementById('sniper-multi').checked;
    const singleToken = document.getElementById('sniper-token').value.trim();
    
    if (multiToken && sniperTokens.length > 0) {
        const token = sniperTokens[currentTokenIndex % sniperTokens.length];
        return {
            'Content-Type': 'application/json',
            'Origin': 'https://discord.com',
            'Authorization': token
        };
    } else {
        return {
            'Content-Type': 'application/json',
            'Origin': 'https://discord.com',
            'Authorization': singleToken
        };
    }
}

function switchToNextToken() {
    if (sniperTokens.length > 0) {
        currentTokenIndex = (currentTokenIndex + 1) % sniperTokens.length;
        return true;
    }
    return false;
}

async function startSniper() {
    const token = document.getElementById('sniper-token').value.trim();
    const multiTokenChecked = document.getElementById('sniper-multi').checked;
    const multiTokensText = document.getElementById('sniper-multi-tokens').value.trim();
    const type = document.getElementById('sniper-type').value;
    const webhook = document.getElementById('sniper-webhook').value.trim();
    const delay = parseFloat(document.getElementById('sniper-delay').value) || 0.5;
    const maxCount = parseInt(document.getElementById('sniper-count').value) || 100;
    
    // تجهيز التوكنات
    sniperTokens = [];
    currentTokenIndex = 0;
    
    if (multiTokenChecked && multiTokensText) {
        sniperTokens = multiTokensText.split('\n').filter(t => t.trim());
        if (sniperTokens.length === 0) {
            return toast('الرجاء إدخال توكنات في وضع التوكنات المتعددة', 'error');
        }
    } else {
        if (!token) {
            return toast('الرجاء إدخال التوكن', 'error');
        }
        sniperTokens = [token];
    }
    
    // تنظيف النتائج
    document.getElementById('sniper-result').innerHTML = '';
    sniperFound = [];
    
    // التحقق من التوكن الأول
    document.getElementById('sniper-result').innerHTML = '<span style="color:#fbbf24;">⏳ جاري التحقق من التوكن...</span>';
    
    try {
        const checkRes = await fetch('https://discord.com/api/v9/users/@me', {
            headers: { 'Authorization': sniperTokens[0] }
        });
        
        if (checkRes.status !== 200) {
            document.getElementById('sniper-result').innerHTML = '<span style="color:#dc2626;">❌ التوكن غير صالح</span>';
            return toast('التوكن غير صالح', 'error');
        }
        
        const userData = await checkRes.json();
        document.getElementById('sniper-result').innerHTML = `<span style="color:#16a34a;">✅ متصل: ${userData.username} | متعدد: ${multiTokenChecked ? 'نعم ('+sniperTokens.length+' توكن)' : 'لا'}</span>`;
    } catch(e) {
        document.getElementById('sniper-result').innerHTML = '<span style="color:#dc2626;">❌ خطأ في الاتصال</span>';
        return toast('خطأ في الاتصال', 'error');
    }
    
    sniperRunning = true;
    document.getElementById('sniper-start').style.display = 'none';
    document.getElementById('sniper-stop').style.display = 'inline-flex';
    
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const punctuation = '._';
    
    let checked = 0, found = 0;
    let useString = true;
    let useDigits = true;
    let usePunct = true;
    
    // إعدادات متقدمة
    const advString = document.getElementById('sniper-string')?.checked ?? true;
    const advDigits = document.getElementById('sniper-digits')?.checked ?? true;
    const advPunct = document.getElementById('sniper-punct')?.checked ?? false;
    
    function getRandomChar(chars) {
        return chars[Math.floor(Math.random() * chars.length)];
    }
    
    function get_names(type) {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const punct = '._';
    
    function rChar(chars) { return chars[Math.floor(Math.random() * chars.length)]; }
    
    if (type === 'semi-3') {
        // شبه ثلاثي: حرف + رقمين مع نقطة/شرطة = a.12 , z_99 , 6.ak
        const l = rChar(letters);
        const d1 = rChar(digits);
        const d2 = rChar(digits);
        const sep = rChar(punct);
        
        // وضع الفاصل في موقع عشوائي
        const parts = [l, d1, d2];
        const pos = Math.floor(Math.random() * 2) + 1; // موقع 1 أو 2
        parts.splice(pos, 0, sep);
        return parts.join('');
        
    } else if (type === 'semi-4') {
        // شبه رباعي: حرفين + رقمين = ab.12 , zx_88
        const l1 = rChar(letters);
        const l2 = rChar(letters);
        const d1 = rChar(digits);
        const d2 = rChar(digits);
        const sep = rChar(punct);
        
        const parts = [l1, l2, d1, d2];
        const pos = Math.floor(Math.random() * 3) + 1; // موقع 1,2,3
        parts.splice(pos, 0, sep);
        return parts.join('');
        
    } else if (type === 'custom') {
        // مخصص: عدد حروف + عدد أرقام يحددها المستخدم
        const numLetters = parseInt(document.getElementById('sniper-letters').value) || 2;
        const numNumbers = parseInt(document.getElementById('sniper-numbers').value) || 2;
        
        let username = '';
        for (let i = 0; i < numLetters; i++) username += rChar(letters);
        for (let i = 0; i < numNumbers; i++) username += rChar(digits);
        
        // إضافة فاصل عشوائي إذا المستخدم مفعل punctuation
        const usePunct = document.getElementById('sniper-punct')?.checked ?? false;
        if (usePunct && username.length >= 3) {
            const parts = username.split('');
            const pos = Math.floor(Math.random() * (parts.length - 1)) + 1;
            parts.splice(pos, 0, rChar(punct));
            username = parts.join('');
        }
        
        return username;
        
    } else {
        // عشوائي: خليط من كل شي
        const useString = document.getElementById('sniper-string')?.checked ?? true;
        const useDigits = document.getElementById('sniper-digits')?.checked ?? true;
        const usePunct = document.getElementById('sniper-punct')?.checked ?? false;
        
        let chars = '';
        if (useString) chars += letters;
        if (useDigits) chars += digits;
        if (usePunct) chars += punct;
        if (chars === '') chars = letters + digits;
        
        const length = Math.floor(Math.random() * 4) + 2; // 2 إلى 5
        let username = '';
        for (let i = 0; i < length; i++) {
            username += rChar(chars);
        }
        
        // إضافة فاصل في اليوزرات الطويلة
        if (usePunct && username.length >= 3 && Math.random() > 0.5) {
            const parts = username.split('');
            const pos = Math.floor(Math.random() * (parts.length - 1)) + 1;
            parts.splice(pos, 0, rChar(punct));
            username = parts.join('');
        }
        
        return username;
    }
}
    
    async function validateUsername(username) {
        const headers = getSniperHeaders();
        
        try {
            const endpoint = await fetch('https://discord.com/api/v9/users/@me/pomelo-attempt', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ username: username })
            });
            
            checked++;
            
            if (endpoint.status === 200) {
                const json = await endpoint.json();
                
                if (json.taken === false) {
                    // ✅ اليوزر متاح
                    found++;
                    sniperFound.push(username);
                    
                    const entry = document.createElement('div');
                    entry.style.cssText = 'background:#010102;border:1px solid #16a34a;border-radius:8px;padding:10px;margin:5px 0;';
                    entry.innerHTML = `<span style="color:#16a34a;font-weight:bold;">✅ ${username}</span> - متاح`;
                    document.getElementById('sniper-result').appendChild(entry);
                    
                    // إرسال للويبهوك
                    await sendWebhookResult(username, webhook);
                    
                } else if (json.taken === true) {
                    // ❌ اليوزر ماخوذ - ما نعرض شي
                }
                
            } else if (endpoint.status === 429) {
                // Rate Limit - تبديل التوكن إذا متاح
                const errorData = await endpoint.json().catch(() => ({}));
                const retryAfter = errorData.retry_after || 5;
                
                if (switchToNextToken()) {
                    const newHeaders = getSniperHeaders();
                    const newUser = await fetch('https://discord.com/api/v9/users/@me', { headers: newHeaders }).then(r => r.json());
                    const msg = document.createElement('div');
                    msg.style.cssText = 'color:#fbbf24;font-size:11px;margin:3px 0;';
                    msg.textContent = `⚠️ تبديل التوكن > ${newUser.username} (انتظار ${retryAfter}s)`;
                    document.getElementById('sniper-result').appendChild(msg);
                } else {
                    const msg = document.createElement('div');
                    msg.style.cssText = 'color:#fbbf24;font-size:11px;margin:3px 0;';
                    msg.textContent = `⚠️ تحديد المعدل - انتظار ${retryAfter}s`;
                    document.getElementById('sniper-result').appendChild(msg);
                }
                
                await new Promise(r => setTimeout(r, retryAfter * 1000));
                
            } else if (endpoint.status === 401) {
                // توكن منتهي
                if (switchToNextToken()) {
                    const msg = document.createElement('div');
                    msg.style.cssText = 'color:#fbbf24;font-size:11px;margin:3px 0;';
                    msg.textContent = '⚠️ توكن منتهي - تبديل للتوكن التالي';
                    document.getElementById('sniper-result').appendChild(msg);
                } else {
                    const msg = document.createElement('div');
                    msg.style.cssText = 'color:#dc2626;font-size:11px;margin:3px 0;';
                    msg.textContent = '❌ التوكن غير صالح';
                    document.getElementById('sniper-result').appendChild(msg);
                    return 'stop';
                }
            }
            
        } catch(e) {
            const msg = document.createElement('div');
            msg.style.cssText = 'color:#dc2626;font-size:11px;margin:3px 0;';
            msg.textContent = `خطأ: ${e.message}`;
            document.getElementById('sniper-result').appendChild(msg);
        }
        
        return 'continue';
    }
    
    async function sendWebhookResult(username, webhookUrl) {
        if (!webhookUrl) return;
        
        try {
            await fetch('/api/webhook/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    webhook: webhookUrl,
                    username: 'Feel Store',
                    avatar_url: 'https://cdn.discordapp.com/icons/1474397233809195196/447d49be570c1bafe99ec2cda4bd78d9.webp?size=1024',
                    embeds: [{
                        title: `✅ Username: \`${username}\` is available`,
                        timestamp: new Date().toISOString(),
                        footer: { text: 'FEEL STORE' },
                        color: 0xffcc00
                    }]
                })
            });
        } catch(e) {}
    }
    
    // الحلقة الرئيسية
    while (sniperRunning && checked < maxCount) {
        const username = get_names(type);
        
        const status = await validateUsername(username);
        if (status === 'stop') break;
        
        // تحديث التقدم
        const progressDivs = document.getElementById('sniper-result').querySelectorAll('div[style*="6F6E9E"]');
        progressDivs.forEach(d => d.remove());
        
        const progress = document.createElement('div');
        progress.style.cssText = 'color:#6F6E9E;font-weight:bold;font-size:13px;margin:8px 0;padding:8px;background:#313040;border-radius:8px;text-align:center;';
        progress.innerHTML = `🔍 الفحص: ${checked}/${maxCount} | 🎯 وجد: ${found} | 🔑 توكن: ${currentTokenIndex + 1}/${sniperTokens.length}`;
        document.getElementById('sniper-result').insertBefore(progress, document.getElementById('sniper-result').firstChild);
        
        if (delay > 0) {
            await new Promise(r => setTimeout(r, delay * 1000));
        }
    }
    
    stopSniper();
    
    // النتيجة النهائية
    const final = document.createElement('div');
    final.style.cssText = 'background:#010102;border:2px solid #6F6E9E;border-radius:12px;padding:15px;margin:10px 0;text-align:center;';
    final.innerHTML = `
        <h3 style="color:#6F6E9E;">✅ اكتمل البحث</h3>
        <div style="display:flex;justify-content:center;gap:30px;">
            <div><span style="font-size:28px;">${checked}</span><br><span style="color:#B0B0B2;font-size:12px;">تم الفحص</span></div>
            <div><span style="font-size:28px;color:#16a34a;">${found}</span><br><span style="color:#B0B0B2;font-size:12px;">متاح</span></div>
        </div>
    `;
    document.getElementById('sniper-result').appendChild(final);
    
    toast(`✅ اكتمل! وجد ${found} يوزر متاح من ${checked} محاولة`, 'success');
}

function stopSniper() {
    sniperRunning = false;
    document.getElementById('sniper-start').style.display = 'inline-flex';
    document.getElementById('sniper-stop').style.display = 'none';
}

// ========== الإحصائيات ==========
async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('stats-container').innerHTML = `
            <div class="stat-card"><h3>${data.totalKeys||0}</h3><p>إجمالي المفاتيح</p></div>
            <div class="stat-card"><h3>${data.activeKeys||0}</h3><p>مفاتيح نشطة</p></div>
            <div class="stat-card"><h3>${data.totalDevices||0}</h3><p>الأجهزة المفعلة</p></div>
            <div class="stat-card"><h3>${data.blacklisted||0}</h3><p>محظور</p></div>`;
    } catch(e) {}
}

// ========== السجلات ==========
async function loadLogs() {
    try {
        const res = await fetch('/api/logs');
        const logs = await res.json();
        const container = document.getElementById('logs-container');
        if (!logs.length) { container.innerHTML = '<p style="color:#B0B0B2;padding:15px;">لا توجد سجلات</p>'; return; }
        container.innerHTML = logs.reverse().slice(0, 100).map(l =>
            `<div class="log-entry"><span class="time">[${new Date(l.timestamp).toLocaleTimeString('ar-SA')}]</span>${l.message}</div>`
        ).join('');
    } catch(e) {}
}

// ========== المقبس ==========
socket.on('broadcast', (data) => { toast(`📢 ${data.message}`, 'info'); });
console.log('🚀 FEEL STORE جاهز');