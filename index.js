const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
require('dotenv').config();

// Express setup
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Enhanced in-memory storage
const channelData = {
    chatId: null,
    messageCount: 0,
    links: {
        twitter: new Set(),
        reddit: new Set(),
        discord: new Set(),
        telegram: new Set(),
        facebook: new Set(),
        instagram: new Set(),
        chart: new Set(),
        website: new Set(),
        swap: new Set(),
        other: new Set()
    },
    updates: [],
    channelInfo: {
        title: null,
        description: null,
        photoUrl: null,
        pinnedMessageText: null
    }
};

// Bot instance
let bot = null;

// Function to process social links
function processSocialLink(url, platform) {
    try {
        const urlObj = new URL(url);
        
        switch(platform) {
            case 'twitter':
                if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
                    const username = urlObj.pathname.split('/')[1];
                    if (username && !['status', 'posts'].includes(username)) {
                        return `https://x.com/${username}`;
                    }
                }
                break;
                
            case 'reddit':
                if (urlObj.hostname.includes('reddit.com')) {
                    const parts = urlObj.pathname.split('/');
                    if (parts[1] === 'r') {
                        return `https://reddit.com/r/${parts[2]}`;
                    } else if (parts[1] === 'u') {
                        return `https://reddit.com/u/${parts[2]}`;
                    }
                }
                break;
                
            case 'discord':
                if (urlObj.hostname.includes('discord.com') || urlObj.hostname.includes('discord.gg')) {
                    return url;
                }
                break;
                
            case 'telegram':
                if (urlObj.hostname.includes('t.me')) {
                    const username = urlObj.pathname.split('/')[1];
                    return `https://t.me/${username}`;
                }
                break;
                
            case 'facebook':
                if (urlObj.hostname.includes('facebook.com')) {
                    const username = urlObj.pathname.split('/')[1];
                    return `https://facebook.com/${username}`;
                }
                break;
                
            case 'instagram':
                if (urlObj.hostname.includes('instagram.com')) {
                    const username = urlObj.pathname.split('/')[1];
                    return `https://instagram.com/${username}`;
                }
                break;
                
            case 'chart':
                const chartPlatforms = ['dextools.io', 'dexscreener.com', 'poocoin.app'];
                if (chartPlatforms.some(platform => urlObj.hostname.includes(platform))) {
                    return url;
                }
                break;
                
            case 'swap':
                const swapPlatforms = ['pancakeswap.finance', 'uniswap.org'];
                if (swapPlatforms.some(platform => urlObj.hostname.includes(platform))) {
                    return url;
                }
                break;
        }
    } catch (error) {
        console.error('Error processing URL:', error);
    }
    return null;
}

// Function to process message for links
function processMessageForLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const links = text.match(urlRegex);
    
    if (links) {
        links.forEach(link => {
            const twitterLink = processSocialLink(link, 'twitter');
            const redditLink = processSocialLink(link, 'reddit');
            const discordLink = processSocialLink(link, 'discord');
            const telegramLink = processSocialLink(link, 'telegram');
            const facebookLink = processSocialLink(link, 'facebook');
            const instagramLink = processSocialLink(link, 'instagram');
            const chartLink = processSocialLink(link, 'chart');
            const swapLink = processSocialLink(link, 'swap');
            
            if (twitterLink) channelData.links.twitter.add(twitterLink);
            else if (redditLink) channelData.links.reddit.add(redditLink);
            else if (discordLink) channelData.links.discord.add(discordLink);
            else if (telegramLink) channelData.links.telegram.add(telegramLink);
            else if (facebookLink) channelData.links.facebook.add(facebookLink);
            else if (instagramLink) channelData.links.instagram.add(instagramLink);
            else if (chartLink) channelData.links.chart.add(chartLink);
            else if (swapLink) channelData.links.swap.add(swapLink);
            else channelData.links.other.add(link);
        });
    }
}

// Function to create and initialize bot
function initializeBot() {
    if (bot) {
        try {
            bot.stopPolling();
        } catch (error) {
            console.log('Error stopping existing bot:', error);
        }
    }

    bot = new TelegramBot(process.env.BOT_TOKEN, {
        polling: {
            interval: 300,
            autoStart: true,
            params: {
                timeout: 10,
                allowed_updates: ['message', 'channel_post', 'edited_channel_post']
            }
        },
        filepath: false
    });

    // Command regex patterns
    const startRegex = /^\/start(@AlphaSocialV2Bot)?$/;
    const connectRegex = /^\/connect(@AlphaSocialV2Bot)?$/;
    const statusRegex = /^\/status(@AlphaSocialV2Bot)?$/;

    // Start command
    bot.onText(startRegex, (msg) => {
        bot.sendMessage(msg.chat.id, 
            '👋 Welcome to Alpha Social Bot!\n\n' +
            '🔸 Available Commands:\n' +
            '/start - Show this message\n' +
            '/connect - Connect your channel\n' +
            '/status - View captured data\n\n' +
            '📌 To get started:\n' +
            '1. Add me to your project channel\n' +
            '2. Make me an admin\n' +
            '3. Use /connect to start tracking'
        );
    });

    // Connect command
    bot.onText(connectRegex, async (msg) => {
        try {
            channelData.chatId = msg.chat.id;
            
            // Get channel info
            const chat = await bot.getChat(msg.chat.id);
            channelData.channelInfo.title = chat.title;
            
            // Auto-populate Telegram link
            if (chat.username) {
                channelData.links.telegram.add(`https://t.me/${chat.username}`);
            }
            
            // Get latest pinned message for description
            try {
                const pinnedMessage = await bot.getPinnedMessage(msg.chat.id);
                if (pinnedMessage && pinnedMessage.text) {
                    channelData.channelInfo.description = pinnedMessage.text;
                    channelData.channelInfo.pinnedMessageText = pinnedMessage.text;
                }
            } catch (error) {
                console.log('No pinned message found');
            }
            
            // Get current chat photo
            if (chat.photo) {
                try {
                    const photos = await bot.getUserProfilePhotos(msg.chat.id, 0, 1);
                    if (photos && photos.photos.length > 0) {
                        const photo = photos.photos[0][0];
                        const photoInfo = await bot.getFile(photo.file_id);
                        channelData.channelInfo.photoUrl = photoInfo.file_path;
                    }
                } catch (error) {
                    console.log('Error getting profile photo:', error);
                }
            }

            // Process recent messages
            let messages = [];
            try {
                const updates = await bot.getUpdates({
                    offset: -1,
                    limit: 100
                });
                messages = updates.map(update => update.message).filter(Boolean);
            } catch (error) {
                console.error('Error fetching history:', error);
            }

            // Process found messages
            messages.forEach(message => {
                if (message.text) {
                    channelData.messageCount++;
                    processMessageForLinks(message.text);
                }
            });

            bot.sendMessage(msg.chat.id,
                '✅ Channel connected!\n\n' +
                'I\'ve analyzed your channel and found:\n' +
                `• Channel: ${channelData.channelInfo.title}\n` +
                `• Description: ${channelData.channelInfo.description || 'From pinned: ' + (channelData.channelInfo.pinnedMessageText || 'Not set')}\n` +
                `• Telegram: ${Array.from(channelData.links.telegram)[0] || 'Not set'}\n` +
                `• Messages analyzed: ${channelData.messageCount}\n` +
                `• Links found: ${getTotalLinksCount()}\n` +
                `• Updates detected: ${channelData.updates.length}\n\n` +
                'Use /status to see detailed data!'
            );
        } catch (error) {
            console.error('Connection error:', error);
            bot.sendMessage(msg.chat.id, '❌ Error connecting to channel. Please try again.');
        }
    });

    // Status command
    bot.onText(statusRegex, (msg) => {
        if (channelData.chatId !== msg.chat.id) {
            bot.sendMessage(msg.chat.id,
                '❌ Channel not connected!\n\n' +
                'Please use /connect first to start tracking.'
            );
            return;
        }

        const channelInfo = channelData.channelInfo;
        bot.sendMessage(msg.chat.id,
            '📊 Channel Status:\n\n' +
            `Channel: ${channelInfo.title}\n` +
            `Description: ${channelInfo.description || 'Using pinned message'}\n` +
            `Telegram: ${Array.from(channelData.links.telegram)[0] || 'Not set'}\n\n` +
            `Messages Tracked: ${channelData.messageCount}\n` +
            `Links Found: ${getTotalLinksCount()}\n\n` +
            `Recent Links:\n${formatLinks(channelData.links)}\n\n` +
            `Recent Updates:\n${formatUpdates(channelData.updates)}`
        );
    });

    // Message tracking
    bot.on('message', (msg) => {
        if (msg.chat.id === channelData.chatId && msg.text) {
            channelData.messageCount++;
            processMessageForLinks(msg.text);
            
            if (isImportantUpdate(msg.text)) {
                channelData.updates.push({
                    text: msg.text,
                    date: new Date()
                });
            }
        }
    });

    // Error handlers
    bot.on('error', (error) => {
        console.error('Bot error:', error.message);
        if (error.code === 'ETELEGRAM' && error.response?.statusCode === 409) {
            console.log('Conflict detected, attempting to reconnect...');
            setTimeout(() => {
                initializeBot();
            }, 5000);
        }
    });

    bot.on('polling_error', (error) => {
        console.error('Polling error:', error.message);
        if (error.code === 'ETELEGRAM' && error.response?.statusCode === 409) {
            console.log('Polling conflict detected, attempting to reconnect...');
            setTimeout(() => {
                initializeBot();
            }, 5000);
        }
    });

    return bot;
}

// Helper functions
function getTotalLinksCount() {
    return Object.values(channelData.links).reduce((total, set) => total + set.size, 0);
}

function isImportantUpdate(text) {
    const keywords = ['launch', 'update', 'announcement', 'release'];
    return keywords.some(keyword => text.toLowerCase().includes(keyword));
}

function formatLinks(links) {
    let output = '';
    
    if (links.twitter.size) output += `\nTwitter: ${Array.from(links.twitter)[0]}`;
    if (links.reddit.size) output += `\nReddit: ${Array.from(links.reddit)[0]}`;
    if (links.discord.size) output += `\nDiscord: ${Array.from(links.discord)[0]}`;
    if (links.telegram.size) output += `\nTelegram: ${Array.from(links.telegram)[0]}`;
    if (links.facebook.size) output += `\nFacebook: ${Array.from(links.facebook)[0]}`;
    if (links.instagram.size) output += `\nInstagram: ${Array.from(links.instagram)[0]}`;
    if (links.chart.size) output += `\nChart: ${Array.from(links.chart)[0]}`;
    if (links.swap.size) output += `\nSwap: ${Array.from(links.swap)[0]}`;
    
    return output || 'No links yet';
}

function formatUpdates(updates) {
    return updates.slice(-3).map(update => `• ${update.text.substring(0, 50)}...`).join('\n') || 'No updates yet';
}

// Initialize bot on startup
initializeBot();

// Graceful shutdown
process.on('SIGINT', () => {
    if (bot) {
        console.log('Stopping bot polling...');
        bot.stopPolling();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (bot) {
        console.log('Stopping bot polling...');
        bot.stopPolling();
    }
    process.exit(0);
});