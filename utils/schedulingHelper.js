// Scheduling Helper for Instagram Posts
// Since direct Instagram API posting and Buffer API are restricted,
// this helper provides alternative methods for scheduling posts

class SchedulingHelper {
    constructor() {
        this.schedulingOptions = {
            later: {
                name: 'Later',
                url: 'https://later.com',
                method: 'CSV Export',
                instructions: 'Export posts as CSV and import into Later'
            },
            creator_studio: {
                name: 'Meta Creator Studio',
                url: 'https://business.facebook.com/creatorstudio',
                method: 'Manual scheduling through Meta',
                instructions: 'Use Creator Studio for native Instagram scheduling'
            },
            hootsuite: {
                name: 'Hootsuite',
                url: 'https://hootsuite.com',
                method: 'Bulk CSV upload',
                instructions: 'Use Hootsuite\'s bulk scheduler with CSV import'
            },
            download: {
                name: 'Manual Posting',
                method: 'Download content and post manually',
                instructions: 'Save all content locally and post directly to Instagram'
            }
        };
    }

    // Generate CSV file for bulk scheduling tools
    generateCSV(posts) {
        const headers = ['Date', 'Time', 'Caption', 'Hashtags', 'Image URL', 'Source URL'];
        const rows = posts.map(post => {
            const scheduledDate = this.getOptimalPostingTime();
            return [
                scheduledDate.date,
                scheduledDate.time,
                `"${post.caption.replace(/"/g, '""')}"`, // Escape quotes in caption
                post.hashtags,
                post.imageUrl,
                post.sourceUrl || post.url
            ];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        return csvContent;
    }

    // Generate optimal posting times based on best practices
    getOptimalPostingTime(dayOffset = 0) {
        const date = new Date();
        date.setDate(date.getDate() + dayOffset);
        
        // Best Instagram posting times: 11 AM, 2 PM, 5 PM
        const optimalHours = [11, 14, 17];
        const randomHour = optimalHours[Math.floor(Math.random() * optimalHours.length)];
        
        return {
            date: date.toISOString().split('T')[0],
            time: `${randomHour}:00`,
            datetime: new Date(date.setHours(randomHour, 0, 0, 0))
        };
    }

    // Generate a posting schedule for multiple posts
    generatePostingSchedule(posts) {
        const schedule = [];
        let dayOffset = 0;
        let postsPerDay = 0;
        const maxPostsPerDay = 3;

        posts.forEach((post, index) => {
            if (postsPerDay >= maxPostsPerDay) {
                dayOffset++;
                postsPerDay = 0;
            }

            const timing = this.getOptimalPostingTime(dayOffset);
            schedule.push({
                ...post,
                scheduledDate: timing.date,
                scheduledTime: timing.time,
                scheduledDateTime: timing.datetime
            });

            postsPerDay++;
        });

        return schedule;
    }

    // Generate instructions for manual posting
    generateManualInstructions(posts) {
        const instructions = [];
        const schedule = this.generatePostingSchedule(posts);

        schedule.forEach((post, index) => {
            instructions.push({
                step: index + 1,
                date: post.scheduledDate,
                time: post.scheduledTime,
                actions: [
                    'Download the image',
                    'Copy the caption and hashtags',
                    'Open Instagram app',
                    'Create new post',
                    'Upload the image',
                    'Paste the caption',
                    'Add location if relevant',
                    'Share the post'
                ],
                content: {
                    caption: post.caption,
                    hashtags: post.hashtags,
                    imageUrl: post.imageUrl
                }
            });
        });

        return instructions;
    }

    // Export posts in various formats
    exportPosts(posts, format = 'json') {
        switch (format) {
            case 'csv':
                return this.generateCSV(posts);
            
            case 'json':
                return JSON.stringify(posts, null, 2);
            
            case 'html':
                return this.generateHTMLExport(posts);
            
            case 'markdown':
                return this.generateMarkdownExport(posts);
            
            default:
                return posts;
        }
    }

    // Generate HTML export for easy viewing
    generateHTMLExport(posts) {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Instagram Posts Export</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .post { border: 1px solid #ddd; padding: 20px; margin-bottom: 20px; border-radius: 8px; }
                .post img { max-width: 100%; height: auto; }
                .caption { margin: 15px 0; line-height: 1.6; }
                .hashtags { color: #1e88e5; }
                .meta { color: #666; font-size: 0.9em; }
            </style>
        </head>
        <body>
            <h1>Instagram Posts - ${new Date().toLocaleDateString()}</h1>
            ${posts.map((post, i) => `
                <div class="post">
                    <h2>Post ${i + 1}</h2>
                    <img src="${post.imageUrl}" alt="Post ${i + 1}">
                    <div class="caption">${post.caption}</div>
                    <div class="hashtags">${post.hashtags}</div>
                    <div class="meta">Source: ${post.url}</div>
                </div>
            `).join('')}
        </body>
        </html>`;
        return html;
    }

    // Generate Markdown export
    generateMarkdownExport(posts) {
        const markdown = posts.map((post, i) => `
## Post ${i + 1}

**Caption:**
${post.caption}

**Hashtags:**
${post.hashtags}

**Image:** [View Image](${post.imageUrl})

**Source:** ${post.url}

---
        `).join('\n');
        
        return `# Instagram Posts Export\n\nGenerated: ${new Date().toLocaleDateString()}\n\n${markdown}`;
    }
}

module.exports = SchedulingHelper;