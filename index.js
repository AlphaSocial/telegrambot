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
};

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

// Connect command with history fetching
bot.onText(connectRegex, async (msg) => {
    try {
        channelData.chatId = msg.chat.id;
        
        // Get channel info
        const chat = await bot.getChat(msg.chat.id);
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
            const pinnedMessage = await bot.getPinnedMessage(msg.chat.id);
            if (pinnedMessage) {
                channelData.channelInfo.pinnedMessages.push(pinnedMessage);
            }
        } catch (error) {
            console.log('No pinned message found');
        }
        
        // Get recent messages
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
                
                // Track links
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const links = message.text.match(urlRegex);
                if (links) {
                    channelData.links.push(...links);
                }
                
                // Track updates
                if (isImportantUpdate(message.text)) {
                    channelData.updates.push({
                        text: message.text,
                        date: new Date(message.date * 1000)
                    });
                }

                // Look for website in messages
                if (!channelData.channelInfo.website && message.text.includes('website')) {
                    const possibleWebsite = message.text.match(urlRegex);
                    if (possibleWebsite) {
                        channelData.channelInfo.website = possibleWebsite[0];
                    }
                }
            }
        });

        bot.sendMessage(msg.chat.id,
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
        `Username: @${channelInfo.username}\n` +
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
    if (msg.chat.id === channelData.chatId && msg.text) {
        channelData.messageCount++;
        
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
                date: new Date()
            });
        }
    }
});

// Helper functions
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