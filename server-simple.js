const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static('public'));

// File upload configuration
const upload = multer({ 
    dest: '/tmp/uploads/',
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.xlsx' || ext === '.xls') {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'));
        }
    }
});

// Simple Excel processing
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

// Simplified content generation (without external dependencies)
async function generateInstagramPost(url) {
    try {
        // For Vercel deployment, return mock data
        // In production, this would call your AI APIs
        return {
            caption: `Check out this amazing content from ${url}! 🌟 Don't miss out on the latest updates and insights. Follow for more! #instagram #content #socialmedia`,
            hashtags: '#instagram #socialmedia #content #marketing #digital',
            imageUrl: '/generated/placeholder.jpg'
        };
    } catch (error) {
        console.error('Error generating post:', error);
        throw error;
    }
}

// Main processing endpoint
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
        
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            try {
                console.log(`Processing URL ${i + 1}/${urls.length}: ${url}`);
                
                const postContent = await generateInstagramPost(url);
                
                posts.push({
                    id: i + 1,
                    url,
                    caption: postContent.caption,
                    hashtags: postContent.hashtags,
                    imageUrl: postContent.imageUrl,
                    status: 'ready'
                });
                
            } catch (error) {
                console.error(`Error processing ${url}:`, error);
            }
        }
        
        // Clean up uploaded file
        await fs.unlink(req.file.path).catch(console.error);
        
        res.json({ 
            success: true, 
            posts,
            totalProcessed: urls.length,
            successCount: posts.length
        });
        
    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to process URLs'
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL ? 'vercel' : 'local'
    });
});

// Instagram endpoints (return mock responses for Vercel)
app.post('/instagram/login', (req, res) => {
    res.json({
        success: false,
        error: 'Instagram direct posting is not available in the demo version. Please use the export features.',
        demo: true
    });
});

app.get('/instagram/status', (req, res) => {
    res.json({ loggedIn: false, demo: true });
});

// Export endpoint
app.post('/export-posts', async (req, res) => {
    try {
        const { posts, format } = req.body;
        
        if (!posts || posts.length === 0) {
            return res.status(400).json({ error: 'No posts to export' });
        }
        
        let content = '';
        
        if (format === 'csv') {
            const headers = ['URL', 'Caption', 'Hashtags'];
            const rows = posts.map(post => [
                post.url,
                `"${post.caption.replace(/"/g, '""')}"`,
                post.hashtags
            ]);
            content = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        } else {
            content = JSON.stringify(posts, null, 2);
        }
        
        res.json({
            success: true,
            format: format,
            content: content,
            filename: `instagram_posts_${Date.now()}.${format === 'csv' ? 'csv' : 'json'}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server only if not in Vercel
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;