const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const puppeteer = require('puppeteer');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files - but handle root path specially for Vercel
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static('public'));

// Use /tmp for uploads in serverless environment
const uploadsDir = process.env.VERCEL === '1' ? '/tmp/uploads' : 'uploads/';
const upload = multer({ 
    dest: uploadsDir,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.xlsx' || ext === '.xls') {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'));
        }
    }
});

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function processExcelFile(filePath) {
    try {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);
        
        const urls = data.map(row => {
            return row.URL || row.url || row.Url || row.Link || row.link;
        }).filter(url => url && url.trim());
        
        return urls;
    } catch (error) {
        console.error('Error processing Excel file:', error);
        throw new Error('Failed to process Excel file');
    }
}

async function scrapeWebpage(url) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        const content = await page.evaluate(() => {
            const getMetaContent = (name) => {
                const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                return meta ? meta.content : '';
            };
            
            const mainContent = document.querySelector('main, article, .content, #content, .main');
            const bodyText = mainContent ? mainContent.innerText : document.body.innerText;
            
            return {
                title: document.title || '',
                text: bodyText.substring(0, 3000),
                metaDescription: getMetaContent('description') || getMetaContent('og:description'),
                ogImage: getMetaContent('og:image'),
                keywords: getMetaContent('keywords')
            };
        });
        
        return content;
    } catch (error) {
        console.error('Error scraping webpage:', error);
        throw new Error(`Failed to scrape ${url}: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function generateInstagramPost(pageContent, url) {
    try {
        const prompt = `
        Based on this webpage content, create an engaging Instagram post.
        
        URL: ${url}
        Title: ${pageContent.title}
        Description: ${pageContent.metaDescription}
        Content: ${pageContent.text}
        
        Generate a response in JSON format with the following structure:
        {
            "caption": "A compelling Instagram caption (max 2000 characters) that is engaging, conversational, includes relevant emojis throughout, and ends with a clear call-to-action",
            "hashtags": "A string of 10-15 relevant hashtags separated by spaces (e.g., #marketing #business #success)",
            "imagePrompt": "A detailed description for an eye-catching Instagram image that would complement this post (50-100 words)"
        }
        
        Make the caption:
        - Start with a hook or question
        - Be conversational and authentic
        - Include 3-5 emojis naturally throughout
        - End with a clear CTA (like, comment, share, visit link, etc.)
        - Keep it under 2000 characters
        
        Important: Return ONLY valid JSON, no additional text.
        `;
        
        const message = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }]
        });
        
        const responseText = message.content[0].text.trim();
        
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        } else {
            throw new Error('Failed to parse JSON from response');
        }
    } catch (error) {
        console.error('Error generating Instagram post:', error);
        throw new Error('Failed to generate Instagram post content');
    }
}

async function generateImage(postContent) {
    try {
        const imagePrompt = postContent.imagePrompt || `Create a modern, eye-catching Instagram post image for: ${postContent.caption.substring(0, 200)}`;
        
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `Create a square Instagram post image (1:1 aspect ratio). ${imagePrompt}. Style: Modern, clean, vibrant colors, professional, social media friendly. NO text in the image.`,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid"
        });
        
        const imageUrl = response.data[0].url;
        
        const imageResponse = await fetch(imageUrl);
        const buffer = await imageResponse.arrayBuffer();
        
        const timestamp = Date.now();
        const filename = `instagram_${timestamp}.jpg`;
        const generatedDir = process.env.VERCEL === '1' ? '/tmp/generated' : path.join('public', 'generated');
        const filepath = path.join(generatedDir, filename);
        
        await fs.mkdir(generatedDir, { recursive: true });
        
        await sharp(Buffer.from(buffer))
            .resize(1080, 1080)
            .jpeg({ quality: 90 })
            .toFile(filepath);
        
        return `/generated/${filename}`;
    } catch (error) {
        console.error('Error generating image:', error);
        
        const generatedDir = process.env.VERCEL === '1' ? '/tmp/generated' : path.join('public', 'generated');
        const placeholderPath = path.join(generatedDir, 'placeholder.jpg');
        await fs.mkdir(generatedDir, { recursive: true });
        
        await sharp({
            create: {
                width: 1080,
                height: 1080,
                channels: 3,
                background: { r: 100, g: 150, b: 200 }
            }
        })
        .jpeg({ quality: 90 })
        .toFile(placeholderPath);
        
        return '/generated/placeholder.jpg';
    }
}

// Initialize helpers - force loading for production
const SchedulingHelper = require('./utils/schedulingHelper');
const schedulingHelper = new SchedulingHelper();
const { InstagramPoster } = require('./utils/instagramPoster');

// Instagram poster instance
let instagramPoster = null;
const sessions = new Map();

async function scheduleInstagramPost(postData) {
    
    console.log('Post ready for scheduling:', {
        caption: postData.caption.substring(0, 100) + '...',
        imageUrl: postData.imageUrl,
        hashtags: postData.hashtags
    });
    
    return {
        status: 'ready_to_post',
        message: 'Post prepared successfully. Download content or use scheduling tools.',
        postData: postData,
        schedulingOptions: schedulingHelper.schedulingOptions
    };
}

app.post('/process-urls', upload.single('excel'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const urls = await processExcelFile(req.file.path);
        
        if (!urls || urls.length === 0) {
            return res.status(400).json({ error: 'No URLs found in Excel file' });
        }
        
        const posts = [];
        const errors = [];
        
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            try {
                console.log(`Processing URL ${i + 1}/${urls.length}: ${url}`);
                
                const pageContent = await scrapeWebpage(url);
                
                const postContent = await generateInstagramPost(pageContent, url);
                
                const imageUrl = await generateImage(postContent);
                
                posts.push({
                    id: i + 1,
                    url,
                    caption: postContent.caption,
                    hashtags: postContent.hashtags,
                    imageUrl,
                    sourceUrl: url,
                    status: 'ready_to_post',
                    message: 'Post generated successfully'
                });
                
                if (i < urls.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                console.error(`Error processing ${url}:`, error);
                errors.push({
                    url,
                    error: error.message
                });
            }
        }
        
        await fs.unlink(req.file.path).catch(console.error);
        
        res.json({ 
            success: true, 
            posts,
            errors: errors.length > 0 ? errors : undefined,
            totalProcessed: urls.length,
            successCount: posts.length,
            errorCount: errors.length
        });
        
    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to process URLs',
            details: error.stack
        });
    }
});

app.post('/export-posts', async (req, res) => {
    try {
        const { posts, format } = req.body;
        
        if (!posts || posts.length === 0) {
            return res.status(400).json({ error: 'No posts to export' });
        }
        
        if (!schedulingHelper) {
            return res.status(503).json({ 
                error: 'Export functionality temporarily unavailable' 
            });
        }
        
        const exportContent = schedulingHelper.exportPosts(posts, format);
        const schedule = schedulingHelper.generatePostingSchedule(posts);
        
        res.json({
            success: true,
            format: format,
            content: exportContent,
            schedule: schedule,
            filename: `instagram_posts_${Date.now()}.${format === 'csv' ? 'csv' : format === 'html' ? 'html' : 'json'}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/download-csv/:posts', (req, res) => {
    try {
        const posts = JSON.parse(decodeURIComponent(req.params.posts));
        const csvContent = schedulingHelper.generateCSV(posts);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=instagram_posts.csv');
        res.send(csvContent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/instagram/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        // Create new poster instance for this session
        const poster = new InstagramPoster();
        const result = await poster.login(username, password);
        
        if (result.success) {
            // Store the session
            const sessionId = `session_${Date.now()}`;
            sessions.set(sessionId, poster);
            instagramPoster = poster; // Set as active poster
            
            // Save session to file for persistence
            await poster.saveSession(path.join(sessionsDir, `${username}.json`));
            
            res.json({
                success: true,
                sessionId,
                user: result.user,
                message: 'Successfully logged in to Instagram'
            });
        } else {
            res.status(401).json(result);
        }
    } catch (error) {
        console.error('Instagram login error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/instagram/verify-2fa', async (req, res) => {
    try {
        const { code, sessionId } = req.body;
        
        const poster = sessions.get(sessionId) || instagramPoster;
        if (!poster) {
            return res.status(400).json({ error: 'No active session' });
        }
        
        const result = await poster.handleTwoFactorAuth(code);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/instagram/post', async (req, res) => {
    try {
        const { post, sessionId } = req.body;
        
        const poster = sessions.get(sessionId) || instagramPoster;
        if (!poster || !poster.loggedIn) {
            return res.status(401).json({ error: 'Not logged in to Instagram' });
        }
        
        const result = await poster.postToInstagram(post);
        res.json(result);
    } catch (error) {
        console.error('Post error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/instagram/post-batch', async (req, res) => {
    try {
        const { posts, delayMinutes = 10, sessionId } = req.body;
        
        const poster = sessions.get(sessionId) || instagramPoster;
        if (!poster || !poster.loggedIn) {
            return res.status(401).json({ error: 'Not logged in to Instagram' });
        }
        
        // Start posting in background
        poster.postMultiple(posts, delayMinutes).then(results => {
            console.log('Batch posting completed:', results);
        });
        
        res.json({
            success: true,
            message: `Started posting ${posts.length} posts with ${delayMinutes} minute delays`,
            totalPosts: posts.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/instagram/status', async (req, res) => {
    try {
        const { sessionId } = req.query;
        const poster = sessions.get(sessionId) || instagramPoster;
        
        if (!poster || !poster.loggedIn) {
            return res.json({ loggedIn: false });
        }
        
        const userInfo = await poster.getUserInfo();
        res.json({
            loggedIn: true,
            user: userInfo
        });
    } catch (error) {
        res.json({ loggedIn: false });
    }
});

app.post('/instagram/logout', (req, res) => {
    const { sessionId } = req.body;
    
    if (sessionId) {
        sessions.delete(sessionId);
    }
    
    instagramPoster = null;
    res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message || 'Something went wrong'
    });
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Create sessions directory if it doesn't exist - only in non-serverless
if (process.env.VERCEL !== '1') {
    const sessionsDir = path.join(__dirname, 'sessions');
    fs.mkdir(sessionsDir, { recursive: true }).catch(console.error);
} else {
    const sessionsDir = '/tmp/sessions';
    fs.mkdir(sessionsDir, { recursive: true }).catch(() => {});
}

// Start server
if (require.main === module) {
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
        console.log('Environment:', process.env.NODE_ENV || 'development');
        if (!process.env.ANTHROPIC_API_KEY) {
            console.warn('Warning: ANTHROPIC_API_KEY not set');
        }
        if (!process.env.OPENAI_API_KEY) {
            console.warn('Warning: OPENAI_API_KEY not set');
        }
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        server.close(() => {
            console.log('Server closed');
        });
    });
}

// Export for serverless
module.exports = app;