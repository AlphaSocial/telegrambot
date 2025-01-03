const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Create bot with ONLY polling
const bot = new TelegramBot(process.env.BOT_TOKEN, { 
    polling: true,
    filepath: false // Disable file handling to improve performance
});

// Simple in-memory storage
const channelData = {
    chatId: null,
    messageCount: 0,
    links: [],
    updates: []
};

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
bot.onText(connectRegex, (msg) => {
    channelData.chatId = msg.chat.id;
    channelData.messageCount = 0;
    channelData.links = [];
    channelData.updates = [];
    
    bot.sendMessage(msg.chat.id,
        '✅ Channel connected!\n\n' +
        'I\'m now tracking:\n' +
        '• Project links & socials\n' +
        '• Important updates\n' +
        '• Community metrics\n\n' +
        'Use /status to see captured data!'
    );
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

    bot.sendMessage(msg.chat.id,
        '📊 Channel Status:\n\n' +
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