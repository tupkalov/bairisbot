import { Bot } from 'telegramthread';
import restrictedUsers from './config/restrictedUsers.js';
import Storage from './storage.js';
import AI from './ai/ai.js';
import AIMessage from './AIMessage.js';
import { AppError } from './ai/utils/index.js';
import storage from './storage.js';
import { createMessageRouter } from './messageRouter.js';

const TELEGRAM_MESSAGE_LIMIT = 3000;

function splitTextForTelegram(text, limit = TELEGRAM_MESSAGE_LIMIT) {
    if (!text) return [''];
    if (text.length <= limit) return [text];

    const chunks = [];
    let remaining = text;

    while (remaining.length > limit) {
        let chunk = remaining.slice(0, limit);
        const newlineIndex = chunk.lastIndexOf('\n');
        const spaceIndex = chunk.lastIndexOf(' ');
        const splitIndex = Math.max(newlineIndex, spaceIndex);

        if (splitIndex >= Math.floor(limit / 2)) {
            chunk = chunk.slice(0, splitIndex + 1);
        }

        chunks.push(chunk);
        remaining = remaining.slice(chunk.length);
    }

    if (remaining.length) {
        chunks.push(remaining);
    }

    return chunks;
}

async function sendLongText(chat, text, options) {
    const messages = [];
    const chunks = splitTextForTelegram(text);

    for (let index = 0; index < chunks.length; index += 1) {
        const chunkOptions = index === 0 ? options : { ...options, replyTo: undefined };
        // Telegram rejects messages longer than 4096 characters, so send sequential chunks instead.
        messages.push(await chat.sendText(chunks[index], chunkOptions));
    }

    return messages;
}


global.bot = new Bot({
    MessageClass: AIMessage
});
global.bot.start();

const router = createMessageRouter({
    restrictedUsers,
    storage,
    Storage,
    AI,
    AppError,
    sendLongText,
    flushMs: process.env.MEDIA_GROUP_FLUSH_MS
});

process.on("SIGTERM", () => {
    process.exit();
})

global.bot.onMessage(async (message, chat) => {
    return await router.onMessage(message, chat);
});
