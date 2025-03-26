import { createClient } from 'redis';
import AIMessage from './AIMessage.js';

const PREFIX = process.env.REDIS_PREFIX ? process.env.REDIS_PREFIX + "_" : "";
var client;
(async () => {
    client = await createClient({ url: "redis://redis:6379" })
        .on("error", error => {
            console.error("Redis error: " + error);
        })
        .connect();
        
})()

export default {
    async getChainFrom (origMessage, { maxCount = 10 } = {}) {
        var message = origMessage;
        const messages = [];
        const onlyReply = origMessage.chat.data.type === "supergroup";

        while (maxCount--) {
            let messageId;
            if (message.isReply() || onlyReply) {
                messageId = message.getReplyId();
            } else {
                ;[messageId] = await client.sendCommand(["ZRANGE", `${PREFIX}messages:{${origMessage.chat.id}}`, `${message.date - 1}`, "0", "BYSCORE", "REV", "LIMIT", "0", "1"]);
            }

            if (!messageId) break;

            const messageData = await client.GET(`${PREFIX}message:{${origMessage.chat.id}}:${messageId}`);
            
            if (!messageData) break;
            message = new AIMessage(JSON.parse(messageData));
            messages.push(message);
        }
        
        return messages;
    },

    async save(...messages) {
        for (const message of messages) {
            await client.SET(`${PREFIX}message:{${message.chat.id}}:${message.id}`, JSON.stringify(message), 'EX', 60 * 60 * 24 * 7);
            await client.ZADD(`${PREFIX}messages:{${message.chat.id}}`, [ { score: message.date, value: message.id.toString() } ]);
        }
    },

    async clearByChatId(chatId) {
        const messageIds = await client.ZRANGE(`${PREFIX}messages:{${chatId}}`, 0, -1);
        for (const messageId of messageIds) {
            await client.DEL(`${PREFIX}message:{${chatId}}:${messageId}`);
        }
        await client.DEL(`${PREFIX}messages:{${chatId}}`);
    }
}

