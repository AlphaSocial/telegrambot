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

// Enhanced in-memory storage with multiple channels
const channelsData = new Map();

// Create bot with enhanced polling options
const bot = new TelegramBot(process.env.BOT_TOKEN, {
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
bot.onText(startRegex, async (msg) => {
    try {
        const chatId = msg.chat.id;
        const chatType = msg.chat.type;

        if (chatType === 'private') {
            bot.sendMessage(chatId, 
                '👋 Welcome to Alpha Social Bot!\n\n' +
                '🔸 To use me:\n' +
                '1. Add me to your channel\n' +
                '2. Make me an admin\n' +
                '3. Send /connect in the channel\n\n' +
                '📌 Available Commands:\n' +
                '/start - Show this message\n' +
                '/connect - Connect a channel\n' +
                '/status - View channel data'
            );
        } else {
            // For channels and groups
            const botMember = await bot.getChatMember(chatId, bot.token.split(':')[0]);
            if (!botMember.can_post_messages) {
                bot.sendMessage(chatId, '❌ Please make me an admin with posting permissions first!');
                return;
            }
            
            bot.sendMessage(chatId,
                '👋 Hello! Use /connect to start tracking this channel/group.'
            );
        }
    } catch (error) {
        console.error('Start command error:', error);
    }
});

// Connect command
bot.onText(connectRegex, async (msg) => {
    try {
        const chatId = msg.chat.id;

        // Check bot permissions
        const botMember = await bot.getChatMember(chatId, bot.token.split(':')[0]);
        if (!botMember.can_post_messages) {
            bot.sendMessage(chatId, '❌ Please make me an admin with posting permissions first!');
            return;
        }

        // Initialize channel data structure
        channelsData.set(chatId, {
            messageCount: 0,
            links: [],
            updates: [],
            channelInfo: {
                title: null,
                username: null,
                description: null,
                photoUrl: null,
                website: null,
                pinnedMessages: []
            }
        });

        const channelData = channelsData.get(chatId);
        
        // Get channel info
        const chat = await bot.getChat(chatId);
        channelData.channelInfo.title = chat.title;
        channelData.channelInfo.username = chat.username;
        channelData.channelInfo.description = chat.description;
        
        // Get channel photo if available
        if (chat.photo) {
            const photoFile = await bot.getFile(chat.photo.big_file_id);
            channelData.channelInfo.photoUrl = photoFile.file_path;
        }
        
        // Get pinned messages
        try {
            const pinnedMessage = await bot.getPinnedMessage(chatId);
            if (pinnedMessage) {
                channelData.channelInfo.pinnedMessages.push(pinnedMessage);
            }
        } catch (error) {
            console.log('No pinned message found');
        }

        // Process existing messages
        try {
            const messages = await getChannelMessages(chatId);
            processMessages(messages, channelData);
        } catch (error) {
            console.error('Error processing messages:', error);
        }

        bot.sendMessage(chatId,
            '✅ Channel connected!\n\n' +
            'I\'ve analyzed your channel and found:\n' +
            `• Channel: ${channelData.channelInfo.title}\n` +
            `• Description: ${channelData.channelInfo.description || 'Not set'}\n` +
            `• Messages analyzed: ${channelData.messageCount}\n` +
            `• Links found: ${channelData.links.length}\n` +
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
    const chatId = msg.chat.id;
    const channelData = channelsData.get(chatId);

    if (!channelData) {
        bot.sendMessage(chatId,
            '❌ Channel not connected!\n\n' +
            'Please use /connect first to start tracking.'
        );
        return;
    }

    const channelInfo = channelData.channelInfo;
    bot.sendMessage(chatId,
        '📊 Channel Status:\n\n' +
        `Channel: ${channelInfo.title}\n` +
        `Username: ${channelInfo.username ? '@' + channelInfo.username : 'Not set'}\n` +
        `Website: ${channelInfo.website || 'Not found'}\n\n` +
        `Messages Tracked: ${channelData.messageCount}\n` +
        `Links Found: ${channelData.links.length}\n` +
        `Updates Detected: ${channelData.updates.length}\n\n` +
        `Recent Links:\n${formatLinks(channelData.links)}\n\n` +
        `Recent Updates:\n${formatUpdates(channelData.updates)}`
    );
});

// Message tracking
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const channelData = channelsData.get(chatId);
    
    if (channelData && msg.text) {
        processMessage(msg, channelData);
    }
});

// Helper functions
async function getChannelMessages(chatId) {
    // This is a placeholder - Telegram doesn't provide direct API for message history
    // You might need to implement alternative methods to get historical messages
    return [];
}

function processMessage(msg, channelData) {
    channelData.messageCount++;
    
    if (msg.text) {
        // Track links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const links = msg.text.match(urlRegex);
        if (links) {
            channelData.links.push(...links);
        }
        
        // Track updates
        if (isImportantUpdate(msg.text)) {
            channelData.updates.push({
                text: msg.text,
                date: new Date(msg.date * 1000)
            });
        }

        // Look for website
        if (!channelData.channelInfo.website && msg.text.includes('website')) {
            const possibleWebsite = msg.text.match(urlRegex);
            if (possibleWebsite) {
                channelData.channelInfo.website = possibleWebsite[0];
            }
        }
    }
}

function processMessages(messages, channelData) {
    messages.forEach(msg => processMessage(msg, channelData));
}

function isImportantUpdate(text) {
    const keywords = ['launch', 'update', 'announcement', 'release'];
    return keywords.some(keyword => text.toLowerCase().includes(keyword));
}

function formatLinks(links) {
    return links.slice(-3).map(link => `• ${link}`).join('\n') || 'No links yet';
}

function formatUpdates(updates) {
    return updates.slice(-3).map(update => `• ${update.text.substring(0, 50)}...`).join('\n') || 'No updates yet';
}

// Error handlers
bot.on('error', (error) => {
    console.error('Bot error:', error.message);
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
});