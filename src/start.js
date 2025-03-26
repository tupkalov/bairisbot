import { Bot } from 'telegramthread';
import restrictedUsers from './config/restrictedUsers.js';
import Storage from './storage.js';
import AI from './ai/ai.js';
import AIMessage from './AIMessage.js';
import { AppError } from './ai/utils/index.js';
import storage from './storage.js';


global.bot = new Bot({
    MessageClass: AIMessage
});
global.bot.start();

process.on("SIGTERM", () => {
    process.exit();
})

global.bot.onMessage(async (message, chat) => {
    if (message.isReply()) {
        // Не отвечаем где в реплае не бот
        if (!message.getReply().isBot()) return;
    }

    if (!restrictedUsers.includes(message.from.id)) {
        return chat.sendText('You are not allowed to use this bot');
    }

    if (message.is('/clearcache')) {
        storage.clearByChatId(message.chat.id);
        return chat.sendText('Кэш очищен');
    }

    if (message.is('/help')) {
        message.data.text = '/help Расскажи как пользоваться тобой';
    }

    if (message.isCommand() && message.getTextWithoutCommands() === '') {
        return chat.sendText('?');
    }
    
    if (message.isText() || message.isPhoto()) {
        await chat.startTyping();

        try {
            // Получаем цепочку сообщений
            const chatHistory = (await Storage.getChainFrom(message)).reverse();

            const aiResponse = await AI.request(message, {
                chatHistory,
                chat
            })
            
            const replyMessages = await (async () => {
                const { content, metadata } = aiResponse;
                var options = { extend: { metadata }, replyTo: message };
                const send = async () => {
                    switch (aiResponse.type) {
                    case 'text':
                        return await chat.sendText(`[${metadata.model}] ${content}`, {
                            ...options,
                            split: true // Вернет массив сообщений
                        });
                        
                    case 'imageUrl':
                        return [await chat.sendPhoto(content, { ...options, caption: `[${metadata.model}]` })];
                    default:
                        throw new AppError('Response type not supported', { info: { aiResponse } });
                    }
                };
                return await send()
                    .catch(error => {
                        // Если сообщение на которое отвечаем не найдено, то отправляем сообщение без реплая
                        if (error.message.includes("message to be replied not found")) {
                            options = { ...options, replyTo: undefined };
                            return send();
                        }
                        throw error;
                    });
            })();
            

            await Storage.save(message, ...replyMessages).catch(error => {
                console.error("Error storing message: " + error.name + ": " + error.message, error.stack)
            })

        } finally {
            await chat?.stopTyping()
        }
        return;
    }

    throw new AppError("Unsupported message type", { info: { message } });
});
