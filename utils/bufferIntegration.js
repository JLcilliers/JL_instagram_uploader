const axios = require('axios');

class BufferIntegration {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.baseUrl = 'https://api.bufferapp.com/1';
    }

    async getProfiles() {
        try {
            const response = await axios.get(`${this.baseUrl}/profiles.json`, {
                params: { access_token: this.accessToken }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching Buffer profiles:', error);
            throw error;
        }
    }

    async createPost(profileId, text, imageUrl, scheduledAt = null) {
        try {
            const postData = {
                profile_ids: [profileId],
                text: text,
                media: {
                    photo: imageUrl,
                    thumbnail: imageUrl
                },
                shorten: true,
                now: scheduledAt ? false : true
            };

            if (scheduledAt) {
                postData.scheduled_at = scheduledAt;
            }

            const response = await axios.post(
                `${this.baseUrl}/updates/create.json`,
                null,
                {
                    params: {
                        access_token: this.accessToken,
                        ...postData
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error creating Buffer post:', error);
            throw error;
        }
    }

    async scheduleInstagramPost(post, profileId, scheduledTime = null) {
        try {
            const fullText = `${post.caption}\n\n${post.hashtags}`;
            
            const result = await this.createPost(
                profileId,
                fullText,
                post.imageUrl,
                scheduledTime
            );

            return {
                success: true,
                bufferId: result.buffer_id,
                message: 'Post scheduled successfully on Buffer',
                scheduledTime: scheduledTime || 'Immediate',
                profileId: profileId
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Failed to schedule post on Buffer'
            };
        }
    }
}

module.exports = BufferIntegration;