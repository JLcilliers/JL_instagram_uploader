const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const axios = require('axios');

// Lazy load instagram-private-api to avoid initialization issues in serverless
let IgApiClient;
try {
    const igModule = require('instagram-private-api');
    IgApiClient = igModule.IgApiClient;
} catch (error) {
    console.warn('Instagram Private API not available:', error.message);
}

class InstagramPoster {
    constructor() {
        if (IgApiClient) {
            this.ig = new IgApiClient();
        } else {
            this.ig = null;
            console.warn('Instagram API not initialized');
        }
        this.loggedIn = false;
        this.user = null;
    }

    // Login to Instagram
    async login(username, password) {
        try {
            if (!this.ig) {
                return {
                    success: false,
                    error: 'Instagram API not available in this environment'
                };
            }
            
            // Generate device ID from username
            this.ig.state.generateDevice(username);
            
            // Login
            const auth = await this.ig.account.login(username, password);
            this.user = auth;
            this.loggedIn = true;
            
            console.log(`Logged in as ${username}`);
            
            return {
                success: true,
                user: {
                    username: auth.username,
                    fullName: auth.full_name,
                    profilePicture: auth.profile_pic_url,
                    userId: auth.pk
                }
            };
        } catch (error) {
            console.error('Instagram login error:', error);
            
            // Handle specific Instagram errors
            if (error.name === 'IgCheckpointError') {
                return {
                    success: false,
                    error: 'Instagram checkpoint required. Please verify your account.',
                    requiresVerification: true
                };
            }
            
            if (error.name === 'IgLoginBadPasswordError') {
                return {
                    success: false,
                    error: 'Invalid username or password'
                };
            }
            
            return {
                success: false,
                error: error.message || 'Failed to login to Instagram'
            };
        }
    }

    // Handle two-factor authentication
    async handleTwoFactorAuth(code) {
        try {
            const auth = await this.ig.account.twoFactorLogin({
                username: this.ig.state.cookieStore.storage.username,
                verificationCode: code,
                twoFactorIdentifier: this.ig.state.cookieStore.storage.twoFactorIdentifier,
                verificationMethod: '1', // SMS
                trustThisDevice: '1'
            });
            
            this.user = auth;
            this.loggedIn = true;
            
            return {
                success: true,
                user: {
                    username: auth.username,
                    fullName: auth.full_name,
                    profilePicture: auth.profile_pic_url
                }
            };
        } catch (error) {
            return {
                success: false,
                error: 'Invalid verification code'
            };
        }
    }

    // Prepare image for Instagram (convert to JPEG, resize to Instagram dimensions)
    async prepareImage(imagePath) {
        try {
            // Read the image
            const imageBuffer = await fs.readFile(imagePath);
            
            // Get image metadata
            const metadata = await sharp(imageBuffer).metadata();
            
            // Instagram recommended dimensions
            const maxWidth = 1080;
            const maxHeight = 1350; // 4:5 aspect ratio max
            const minWidth = 320;
            const minHeight = 566;
            
            let width = metadata.width;
            let height = metadata.height;
            
            // Calculate aspect ratio
            const aspectRatio = width / height;
            
            // Resize if needed while maintaining aspect ratio
            if (width > maxWidth || height > maxHeight) {
                if (aspectRatio > maxWidth / maxHeight) {
                    width = maxWidth;
                    height = Math.round(maxWidth / aspectRatio);
                } else {
                    height = maxHeight;
                    width = Math.round(maxHeight * aspectRatio);
                }
            }
            
            // Ensure minimum dimensions
            if (width < minWidth || height < minHeight) {
                if (aspectRatio > minWidth / minHeight) {
                    height = minHeight;
                    width = Math.round(minHeight * aspectRatio);
                } else {
                    width = minWidth;
                    height = Math.round(minWidth / aspectRatio);
                }
            }
            
            // Process the image
            const processedImage = await sharp(imageBuffer)
                .resize(width, height, {
                    fit: 'inside',
                    withoutEnlargement: false
                })
                .jpeg({
                    quality: 95,
                    progressive: true
                })
                .toBuffer();
            
            return processedImage;
        } catch (error) {
            console.error('Error preparing image:', error);
            throw new Error('Failed to prepare image for Instagram');
        }
    }

    // Download image from URL
    async downloadImage(imageUrl) {
        try {
            // Handle relative URLs
            if (imageUrl.startsWith('/')) {
                imageUrl = `http://localhost:5000${imageUrl}`;
            }
            
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer'
            });
            
            return Buffer.from(response.data);
        } catch (error) {
            console.error('Error downloading image:', error);
            throw new Error('Failed to download image');
        }
    }

    // Post to Instagram
    async postToInstagram(post) {
        try {
            if (!this.loggedIn) {
                throw new Error('Not logged in to Instagram');
            }
            
            // Download and prepare the image
            let imageBuffer;
            if (post.imageUrl.startsWith('http') || post.imageUrl.startsWith('/')) {
                imageBuffer = await this.downloadImage(post.imageUrl);
            } else {
                imageBuffer = await fs.readFile(post.imageUrl);
            }
            
            // Prepare image for Instagram
            const preparedImage = await this.prepareImage(imageBuffer);
            
            // Combine caption and hashtags
            const fullCaption = `${post.caption}\n\n${post.hashtags}`;
            
            // Upload photo
            const publishResult = await this.ig.publish.photo({
                file: preparedImage,
                caption: fullCaption
            });
            
            console.log('Posted to Instagram successfully:', publishResult.media.code);
            
            return {
                success: true,
                postId: publishResult.media.id,
                postCode: publishResult.media.code,
                postUrl: `https://www.instagram.com/p/${publishResult.media.code}/`,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error posting to Instagram:', error);
            
            // Handle rate limiting
            if (error.name === 'IgActionSpamError') {
                return {
                    success: false,
                    error: 'Instagram rate limit reached. Please wait before posting again.',
                    rateLimited: true
                };
            }
            
            return {
                success: false,
                error: error.message || 'Failed to post to Instagram'
            };
        }
    }

    // Post multiple items with delay
    async postMultiple(posts, delayMinutes = 10) {
        const results = [];
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            console.log(`Posting ${i + 1} of ${posts.length}...`);
            
            const result = await this.postToInstagram(post);
            results.push({
                ...result,
                originalPost: post
            });
            
            // If not the last post and successful, wait before next post
            if (i < posts.length - 1 && result.success) {
                console.log(`Waiting ${delayMinutes} minutes before next post...`);
                await new Promise(resolve => setTimeout(resolve, delayMinutes * 60 * 1000));
            }
            
            // Stop if rate limited
            if (result.rateLimited) {
                console.log('Rate limited. Stopping batch posting.');
                break;
            }
        }
        
        return results;
    }

    // Save session for reuse
    async saveSession(filepath) {
        try {
            const state = await this.ig.state.serialize();
            delete state.constants; // Constants don't need to be saved
            await fs.writeFile(filepath, JSON.stringify(state), 'utf8');
            return true;
        } catch (error) {
            console.error('Error saving session:', error);
            return false;
        }
    }

    // Load saved session
    async loadSession(filepath) {
        try {
            const sessionData = await fs.readFile(filepath, 'utf8');
            const state = JSON.parse(sessionData);
            await this.ig.state.deserialize(state);
            this.loggedIn = true;
            return true;
        } catch (error) {
            console.error('Error loading session:', error);
            return false;
        }
    }

    // Get user info
    async getUserInfo() {
        try {
            if (!this.loggedIn) {
                throw new Error('Not logged in');
            }
            
            const pk = this.ig.state.cookieUserId;
            const user = await this.ig.user.info(pk);
            
            return {
                username: user.username,
                fullName: user.full_name,
                biography: user.biography,
                profilePicture: user.profile_pic_url,
                followersCount: user.follower_count,
                followingCount: user.following_count,
                postsCount: user.media_count,
                isVerified: user.is_verified,
                isPrivate: user.is_private
            };
        } catch (error) {
            console.error('Error getting user info:', error);
            throw error;
        }
    }
}

// Alternative implementation using Instagram Graph API for Business Accounts
class InstagramBusinessPoster {
    constructor(accessToken, instagramAccountId) {
        this.accessToken = accessToken;
        this.instagramAccountId = instagramAccountId;
        this.graphApiUrl = 'https://graph.facebook.com/v18.0';
    }

    // Create media container
    async createMediaContainer(imageUrl, caption) {
        try {
            const response = await axios.post(
                `${this.graphApiUrl}/${this.instagramAccountId}/media`,
                {
                    image_url: imageUrl,
                    caption: caption,
                    access_token: this.accessToken
                }
            );
            
            return response.data.id;
        } catch (error) {
            console.error('Error creating media container:', error.response?.data || error);
            throw error;
        }
    }

    // Publish media container
    async publishMedia(creationId) {
        try {
            const response = await axios.post(
                `${this.graphApiUrl}/${this.instagramAccountId}/media_publish`,
                {
                    creation_id: creationId,
                    access_token: this.accessToken
                }
            );
            
            return response.data.id;
        } catch (error) {
            console.error('Error publishing media:', error.response?.data || error);
            throw error;
        }
    }

    // Post to Instagram Business Account
    async postToInstagram(imageUrl, caption) {
        try {
            // Step 1: Create media container
            const creationId = await this.createMediaContainer(imageUrl, caption);
            
            // Step 2: Wait a bit for processing
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Step 3: Publish the media
            const mediaId = await this.publishMedia(creationId);
            
            return {
                success: true,
                mediaId: mediaId,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to post to Instagram'
            };
        }
    }
}

module.exports = {
    InstagramPoster,
    InstagramBusinessPoster
};