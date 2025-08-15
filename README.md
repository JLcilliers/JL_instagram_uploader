# Instagram Post Generator

An automated tool that transforms URLs from Excel files into engaging Instagram posts with AI-generated content and images.

## Features

- Upload Excel files containing URLs
- Automatic web scraping to extract content
- AI-powered Instagram caption generation using Claude API
- Automatic image generation using DALL-E 3
- Bulk processing of multiple URLs
- Download generated posts for scheduling
- Integration-ready with Instagram scheduling services

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- API Keys:
  - Anthropic Claude API key
  - OpenAI API key (for DALL-E image generation)
  - Optional: Buffer/Later/Hootsuite API keys for scheduling

## Installation

1. Clone the repository or download the files

2. Install dependencies:
```bash
npm install
```

3. Configure your API keys in the `.env` file:
```
ANTHROPIC_API_KEY=your_claude_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

1. Start the server:
```bash
node server.js
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Prepare your Excel file:
   - Create an Excel file (.xlsx or .xls)
   - Add URLs in the first column
   - Column header can be: URL, url, Url, Link, or link

4. Upload and process:
   - Click "Choose Excel file" and select your file
   - Configure settings (post style, emojis, hashtag count)
   - Click "Process URLs"
   - Wait for the AI to generate posts

5. Use the generated content:
   - Copy captions and hashtags
   - Download generated images
   - Use the scheduling information to post on Instagram

## Excel File Format

Your Excel file should have URLs in the first column:

| URL |
|-----|
| https://example.com/article1 |
| https://example.com/article2 |
| https://example.com/article3 |

## Scheduling Posts on Instagram

Since Instagram's API doesn't allow direct feed posting, use one of these services:

- **Buffer** (https://buffer.com) - Simple scheduling interface
- **Later** (https://later.com) - Visual content calendar
- **Hootsuite** (https://hootsuite.com) - Enterprise solution
- **Meta Creator Studio** (https://business.facebook.com/creatorstudio) - Official tool

## API Rate Limits

- Claude API: Check your Anthropic account for limits
- OpenAI DALL-E: Standard rate limits apply
- The tool includes automatic delays between requests to avoid hitting limits

## Troubleshooting

### Common Issues:

1. **"Failed to process Excel file"**
   - Ensure your Excel file has URLs in the first column
   - Check that URLs are properly formatted (include http:// or https://)

2. **"Failed to scrape webpage"**
   - Some websites may block automated access
   - Check if the URL is accessible in your browser
   - The site may require authentication

3. **"Failed to generate image"**
   - Verify your OpenAI API key is valid
   - Check your OpenAI account credits
   - A placeholder image will be used as fallback

4. **Server won't start**
   - Ensure port 3000 is not in use
   - Check that all dependencies are installed
   - Verify Node.js is installed correctly

## Security Notes

- Never commit your `.env` file to version control
- Keep your API keys secure
- Use environment variables for production deployment
- The tool stores uploaded files temporarily in the `uploads/` directory

## Project Structure

```
instagram-tool/
├── server.js           # Main server file
├── package.json        # Dependencies
├── .env               # API keys (not committed)
├── .gitignore         # Git ignore file
├── public/            # Frontend files
│   ├── index.html     # Main interface
│   ├── style.css      # Styling
│   ├── script.js      # Client-side logic
│   └── generated/     # Generated images
└── uploads/           # Temporary Excel files
```

## License

This tool is for educational and personal use. Ensure you comply with:
- Instagram's Terms of Service
- Website's robots.txt and terms when scraping
- API usage guidelines for Claude and OpenAI

## Support

For issues or questions:
1. Check the troubleshooting section
2. Verify API keys are correctly configured
3. Ensure all dependencies are installed
4. Check browser console for client-side errors
5. Check server console for backend errors