let processedPosts = [];
let instagramSessionId = null;
let isInstagramConnected = false;

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('excelFile');
    const processBtn = document.getElementById('processBtn');
    const fileName = document.getElementById('fileName');
    const fileLabel = document.querySelector('.file-label');
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileName.textContent = file.name;
            fileLabel.classList.add('has-file');
            processBtn.disabled = false;
        } else {
            fileName.textContent = 'Choose Excel file...';
            fileLabel.classList.remove('has-file');
            processBtn.disabled = true;
        }
    });
    
    processBtn.addEventListener('click', uploadFile);
    
    document.getElementById('downloadAll').addEventListener('click', downloadAllPosts);
    document.getElementById('clearResults').addEventListener('click', clearResults);
    
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('modal');
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Instagram login handlers
    document.getElementById('igLoginBtn').addEventListener('click', loginToInstagram);
    document.getElementById('igLogoutBtn').addEventListener('click', logoutInstagram);
    document.getElementById('verifyCodeBtn').addEventListener('click', verify2FA);
    document.getElementById('postAllBtn').addEventListener('click', postAllToInstagram);
    
    // Check Instagram status on load
    checkInstagramStatus();
});

async function uploadFile() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('Please select an Excel file', 'error');
        return;
    }
    
    const processBtn = document.getElementById('processBtn');
    const btnText = processBtn.querySelector('.btn-text');
    const spinner = processBtn.querySelector('.spinner');
    
    processBtn.disabled = true;
    btnText.textContent = 'Processing...';
    spinner.style.display = 'inline-block';
    
    document.getElementById('progressSection').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'none';
    
    const formData = new FormData();
    formData.append('excel', file);
    
    try {
        updateProgress(0, 'Starting process...');
        
        const response = await fetch('/process-urls', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            processedPosts = result.posts;
            displayResults(result.posts);
            
            if (result.errors && result.errors.length > 0) {
                displayErrors(result.errors);
            }
            
            updateProgress(100, `Completed! Processed ${result.successCount} of ${result.totalProcessed} URLs`);
            
            setTimeout(() => {
                document.getElementById('progressSection').style.display = 'none';
            }, 2000);
            
            showNotification(`Successfully generated ${result.successCount} posts!`, 'success');
            
            // Auto-post if connected and enabled
            if (isInstagramConnected && document.getElementById('autoPost').checked) {
                setTimeout(() => {
                    if (confirm(`Ready to post ${result.successCount} items to Instagram?`)) {
                        postAllToInstagram();
                    }
                }, 1000);
            }
        } else {
            throw new Error(result.error || 'Failed to process URLs');
        }
        
    } catch (error) {
        console.error('Error:', error);
        showNotification(error.message || 'Failed to process file', 'error');
        document.getElementById('progressSection').style.display = 'none';
    } finally {
        processBtn.disabled = false;
        btnText.textContent = 'Process URLs';
        spinner.style.display = 'none';
    }
}

function updateProgress(percentage, message) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressFill.style.width = `${percentage}%`;
    progressFill.textContent = `${Math.round(percentage)}%`;
    progressText.textContent = message;
}

function displayResults(posts) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsDiv = document.getElementById('results');
    
    resultsSection.style.display = 'block';
    resultsDiv.innerHTML = '';
    
    posts.forEach((post, index) => {
        const postCard = createPostCard(post, index);
        resultsDiv.appendChild(postCard);
    });
}

function createPostCard(post, index) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.index = index;
    
    const postActions = isInstagramConnected ? `
        <button class="btn-copy" onclick="copyContent(${index})">Copy Text</button>
        <button class="btn-download" onclick="downloadImage('${post.imageUrl}', ${index})">Download</button>
        <button class="btn-post" onclick="postToInstagram(${index})">Post Now</button>
    ` : `
        <button class="btn-copy" onclick="copyContent(${index})">Copy Text</button>
        <button class="btn-download" onclick="downloadImage('${post.imageUrl}', ${index})">Download</button>
        <button class="btn-schedule" onclick="showSchedulingInfo(${index})">Schedule</button>
    `;
    
    card.innerHTML = `
        <img src="${post.imageUrl}" alt="Instagram post ${index + 1}" class="post-image" onerror="this.src='/generated/placeholder.jpg'">
        <div class="post-content">
            <p class="post-caption" id="caption-${index}">${escapeHtml(post.caption)}</p>
            <p class="post-hashtags" id="hashtags-${index}">${escapeHtml(post.hashtags)}</p>
            <div class="post-actions">
                ${postActions}
            </div>
            <div class="post-status" id="status-${index}" style="display: none;">
                <span class="status-message"></span>
            </div>
            <div class="post-meta" style="margin-top: 10px; font-size: 0.85rem; color: #999;">
                Source: <a href="${post.url}" target="_blank" style="color: #667eea;">${truncateUrl(post.url)}</a>
            </div>
        </div>
    `;
    return card;
}

function copyContent(index) {
    const caption = document.getElementById(`caption-${index}`).textContent;
    const hashtags = document.getElementById(`hashtags-${index}`).textContent;
    const fullText = `${caption}\n\n${hashtags}`;
    
    navigator.clipboard.writeText(fullText).then(() => {
        showNotification('Caption and hashtags copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy text', 'error');
    });
}

async function downloadImage(imageUrl, index) {
    try {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `instagram_post_${index + 1}.jpg`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('Image download started!', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Failed to download image', 'error');
    }
}

function downloadAllPosts() {
    if (processedPosts.length === 0) {
        showNotification('No posts to download', 'warning');
        return;
    }
    
    const content = processedPosts.map((post, index) => {
        return `Post ${index + 1}
================
Source URL: ${post.url}

Caption:
${post.caption}

Hashtags:
${post.hashtags}

Image URL: ${window.location.origin}${post.imageUrl}

-----------------------------------
`;
    }).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `instagram_posts_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('All posts content downloaded!', 'success');
}

function showSchedulingInfo(index) {
    const post = processedPosts[index];
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = `
        <h2>Schedule Post ${index + 1}</h2>
        
        <div style="margin: 20px 0;">
            <h3>Export Options:</h3>
            <div style="display: flex; gap: 10px; margin: 15px 0;">
                <button class="btn btn-primary" onclick="exportAsCSV()">Export All as CSV</button>
                <button class="btn btn-secondary" onclick="exportAsHTML()">Export as HTML</button>
                <button class="btn btn-secondary" onclick="copyPostForScheduling(${index})">Copy This Post</button>
            </div>
        </div>
        
        <div class="warning-message">
            <strong>Scheduling Options:</strong>
        </div>
        
        <div style="margin: 20px 0;">
            <ul style="line-height: 2;">
                <li><strong>Meta Creator Studio</strong> (Recommended) - <a href="https://business.facebook.com/creatorstudio" target="_blank">Official Instagram Scheduler</a></li>
                <li><strong>Later</strong> - <a href="https://later.com" target="_blank">Visual Planning Tool</a> (Import CSV)</li>
                <li><strong>Hootsuite</strong> - <a href="https://hootsuite.com" target="_blank">Enterprise Solution</a> (Bulk Upload)</li>
                <li><strong>Manual Posting</strong> - Download images and copy captions</li>
            </ul>
        </div>
        
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4>✅ Best Practice:</h4>
            <p>Export as CSV for bulk scheduling in Later or Hootsuite, or use Meta Creator Studio for native Instagram scheduling.</p>
        </div>
        
        <div style="margin-top: 20px;">
            <h4>Post Preview:</h4>
            <div style="max-height: 200px; overflow-y: auto; background: white; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                <p style="margin-bottom: 10px;">${escapeHtml(post.caption)}</p>
                <p style="color: #1e88e5;">${escapeHtml(post.hashtags)}</p>
            </div>
        </div>
    `;
    
    openModal();
}

function copyPostForScheduling(index) {
    const post = processedPosts[index];
    const fullText = `${post.caption}\n\n${post.hashtags}`;
    
    navigator.clipboard.writeText(fullText).then(() => {
        showNotification('Post content copied! Paste it into your scheduling tool.', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy text', 'error');
    });
}

async function exportAsCSV() {
    if (processedPosts.length === 0) {
        showNotification('No posts to export', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/export-posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ posts: processedPosts, format: 'csv' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const blob = new Blob([result.content], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = result.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            showNotification('CSV exported! Import this into Later or Hootsuite.', 'success');
            closeModal();
        }
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Failed to export CSV', 'error');
    }
}

async function exportAsHTML() {
    if (processedPosts.length === 0) {
        showNotification('No posts to export', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/export-posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ posts: processedPosts, format: 'html' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const blob = new Blob([result.content], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = result.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            showNotification('HTML export complete! Open the file to view all posts.', 'success');
            closeModal();
        }
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Failed to export HTML', 'error');
    }
}

function displayErrors(errors) {
    const errorSection = document.getElementById('errorSection');
    const errorList = document.getElementById('errorList');
    
    errorSection.style.display = 'block';
    errorList.innerHTML = '';
    
    errors.forEach(error => {
        const errorItem = document.createElement('div');
        errorItem.className = 'error-item';
        errorItem.innerHTML = `
            <div class="error-url">${escapeHtml(error.url)}</div>
            <div class="error-message">${escapeHtml(error.error)}</div>
        `;
        errorList.appendChild(errorItem);
    });
}

function clearResults() {
    if (confirm('Are you sure you want to clear all results?')) {
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('errorSection').style.display = 'none';
        document.getElementById('results').innerHTML = '';
        document.getElementById('errorList').innerHTML = '';
        processedPosts = [];
        
        document.getElementById('excelFile').value = '';
        document.getElementById('fileName').textContent = 'Choose Excel file...';
        document.querySelector('.file-label').classList.remove('has-file');
        document.getElementById('processBtn').disabled = true;
        
        showNotification('Results cleared', 'success');
    }
}

function openModal() {
    document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 2000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    notification.style.background = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateUrl(url) {
    if (url.length > 50) {
        return url.substring(0, 47) + '...';
    }
    return url;
}

// Instagram Functions
async function loginToInstagram() {
    const username = document.getElementById('igUsername').value;
    const password = document.getElementById('igPassword').value;
    
    if (!username || !password) {
        showNotification('Please enter username and password', 'error');
        return;
    }
    
    try {
        const response = await fetch('/instagram/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            instagramSessionId = result.sessionId;
            isInstagramConnected = true;
            showConnectedAccount(result.user);
            showNotification('Successfully connected to Instagram!', 'success');
            
            // Refresh post cards to show "Post Now" button
            if (processedPosts.length > 0) {
                displayResults(processedPosts);
            }
        } else if (result.requiresVerification) {
            document.getElementById('twoFactorSection').style.display = 'block';
            showNotification('Please enter the verification code', 'warning');
        } else {
            showNotification(result.error || 'Failed to login', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Failed to connect to Instagram', 'error');
    }
}

async function verify2FA() {
    const code = document.getElementById('twoFactorCode').value;
    
    if (!code) {
        showNotification('Please enter the verification code', 'error');
        return;
    }
    
    try {
        const response = await fetch('/instagram/verify-2fa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, sessionId: instagramSessionId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            isInstagramConnected = true;
            document.getElementById('twoFactorSection').style.display = 'none';
            showConnectedAccount(result.user);
            showNotification('Successfully verified!', 'success');
        } else {
            showNotification(result.error || 'Invalid code', 'error');
        }
    } catch (error) {
        showNotification('Verification failed', 'error');
    }
}

async function logoutInstagram() {
    try {
        await fetch('/instagram/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: instagramSessionId })
        });
        
        instagramSessionId = null;
        isInstagramConnected = false;
        
        document.getElementById('instagramLogin').style.display = 'block';
        document.getElementById('instagramConnected').style.display = 'none';
        document.getElementById('igUsername').value = '';
        document.getElementById('igPassword').value = '';
        
        // Refresh post cards to show "Schedule" button
        if (processedPosts.length > 0) {
            displayResults(processedPosts);
        }
        
        showNotification('Disconnected from Instagram', 'success');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function checkInstagramStatus() {
    try {
        const response = await fetch(`/instagram/status?sessionId=${instagramSessionId || ''}`);
        const result = await response.json();
        
        if (result.loggedIn) {
            isInstagramConnected = true;
            showConnectedAccount(result.user);
        }
    } catch (error) {
        console.error('Status check error:', error);
    }
}

function showConnectedAccount(user) {
    document.getElementById('instagramLogin').style.display = 'none';
    document.getElementById('instagramConnected').style.display = 'block';
    
    if (user.profilePicture) {
        document.getElementById('igProfilePic').src = user.profilePicture;
    }
    document.getElementById('igFullName').textContent = user.fullName || user.username;
    document.getElementById('igUsername2').textContent = `@${user.username}`;
    
    // Show Post All button if posts exist
    if (processedPosts.length > 0) {
        document.getElementById('postAllBtn').style.display = 'inline-block';
    }
}

async function postToInstagram(index) {
    const post = processedPosts[index];
    
    if (!isInstagramConnected) {
        showNotification('Please connect your Instagram account first', 'error');
        return;
    }
    
    const statusDiv = document.getElementById(`status-${index}`);
    const statusMessage = statusDiv.querySelector('.status-message');
    
    statusDiv.style.display = 'block';
    statusMessage.textContent = 'Posting to Instagram...';
    statusMessage.style.color = '#ffc107';
    
    try {
        const response = await fetch('/instagram/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                post, 
                sessionId: instagramSessionId 
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            statusMessage.textContent = '✅ Posted successfully!';
            statusMessage.style.color = '#28a745';
            
            // Add link to the post
            const postLink = document.createElement('a');
            postLink.href = result.postUrl;
            postLink.target = '_blank';
            postLink.textContent = ' View Post';
            postLink.style.marginLeft = '10px';
            statusDiv.appendChild(postLink);
            
            showNotification(`Post ${index + 1} published to Instagram!`, 'success');
            
            // Disable the post button
            const postBtn = document.querySelector(`[data-index="${index}"] .btn-post`);
            if (postBtn) {
                postBtn.disabled = true;
                postBtn.textContent = 'Posted';
            }
        } else {
            statusMessage.textContent = '❌ Failed to post';
            statusMessage.style.color = '#dc3545';
            
            if (result.rateLimited) {
                showNotification('Instagram rate limit reached. Please wait before posting again.', 'warning');
            } else {
                showNotification(result.error || 'Failed to post', 'error');
            }
        }
    } catch (error) {
        console.error('Post error:', error);
        statusMessage.textContent = '❌ Error posting';
        statusMessage.style.color = '#dc3545';
        showNotification('Failed to post to Instagram', 'error');
    }
}

async function postAllToInstagram() {
    if (!isInstagramConnected) {
        showNotification('Please connect your Instagram account first', 'error');
        return;
    }
    
    const autoPost = document.getElementById('autoPost').checked;
    if (!autoPost) {
        showNotification('Auto-post is disabled in settings', 'warning');
        return;
    }
    
    const delayMinutes = parseInt(document.getElementById('postDelay').value) || 10;
    
    const confirmPost = confirm(`This will post ${processedPosts.length} items to Instagram with ${delayMinutes} minute delays between posts. Continue?`);
    if (!confirmPost) return;
    
    try {
        const response = await fetch('/instagram/post-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                posts: processedPosts, 
                delayMinutes,
                sessionId: instagramSessionId 
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(result.message, 'success');
        } else {
            showNotification(result.error || 'Failed to start batch posting', 'error');
        }
    } catch (error) {
        console.error('Batch post error:', error);
        showNotification('Failed to start batch posting', 'error');
    }
}

// Add button styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .btn-post {
        background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
        color: white;
        font-weight: 600;
    }
    
    .btn-post:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(224, 103, 60, 0.4);
    }
    
    .btn-post:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .post-status {
        margin-top: 10px;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 6px;
        font-size: 0.9rem;
    }
`;
document.head.appendChild(style);