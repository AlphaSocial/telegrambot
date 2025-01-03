const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Create a bot instance
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Basic command - test if bot is working
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        await bot.sendMessage(chatId, 
            'Hello! 🚀 I am the Alpha Bananas Project Bot.\n\n' +
            'I am here to help manage your project information.\n' +
            'Type /help to see what I can do!'
        );
    } catch (error) {
        console.error('Error in start command:', error);
    }
});

// Help command
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        await bot.sendMessage(chatId,
            '🤖 Available Commands:\n\n' +
            '/start - Start the bot\n' +
            '/help - Show this help message\n' +
            '/status - Check your project status'
        );
    } catch (error) {
        console.error('Error in help command:', error);
    }
});

// Express route for webhook health check
app.get('/', (req, res) => {
    res.json({ status: 'Bot is running!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});