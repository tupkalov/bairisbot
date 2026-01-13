export function createMessageRouter({
    restrictedUsers,
    storage,
    Storage,
    AI,
    AppError,
    sendLongText,
    flushMs
}) {
    const MEDIA_GROUP_FLUSH_MS = Number(flushMs || 650);
    const mediaGroupBuffer = new Map();

    function getMediaGroupId(message) {
        try {
            if (typeof message.getMediaGroupId === 'function') return message.getMediaGroupId();
        } catch (_) {
            // ignore
        }

        return (
            message?.data?.media_group_id ||
            message?.data?.message?.media_group_id ||
            message?.data?.update?.message?.media_group_id ||
            message?.data?.update?.channel_post?.media_group_id ||
            message?.data?.raw?.media_group_id ||
            message?.raw?.media_group_id
        );
    }

    async function handleIncoming(message, chat) {
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
                            return await sendLongText(chat, `[${metadata.model}] ${content}`, options);

                        case 'imageUrl':
                            return [await chat.sendPhoto(content, { ...options, caption: `[${metadata.model}]` })];

                        case 'videoUrl':
                            return [await chat.sendVideo(content, { ...options, caption: `[${metadata.model}]` })];

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
    }

    function enqueueMediaGroup(message, chat) {
        const mediaGroupId = getMediaGroupId(message);
        if (!mediaGroupId) return false;

        const key = `${message.chat.id}:${mediaGroupId}`;
        const record = mediaGroupBuffer.get(key) || { messages: [], timer: null, chat };
        record.chat = chat;
        record.messages.push(message);

        if (record.timer) clearTimeout(record.timer);
        record.timer = setTimeout(async () => {
            mediaGroupBuffer.delete(key);
            const messages = record.messages;
            if (!messages.length) return;

            // Выбираем сообщение с подписью (caption) как основное, обычно это первое фото в альбоме.
            const primary = messages.find(m => (m.getText?.() || '').trim().length > 0) || messages[0];
            const albumFileIds = messages
                .map(m => {
                    try { return m.getFileId?.(); } catch (_) { return null; }
                })
                .filter(Boolean);

            // Прокидываем список file_id в primary, чтобы ИИ видел альбом как одно сообщение.
            primary.data = {
                ...(primary.data || {}),
                albumFileIds,
                albumCount: albumFileIds.length,
                mediaGroupId
            };

            await handleIncoming(primary, record.chat);
        }, MEDIA_GROUP_FLUSH_MS);

        mediaGroupBuffer.set(key, record);
        return true;
    }

    async function onMessage(message, chat) {
        // Telegram присылает альбом как несколько сообщений с media_group_id.
        // Буферизуем и отправляем в ИИ один раз (со списком фото).
        if (message?.isPhoto?.() && enqueueMediaGroup(message, chat)) {
            return;
        }

        return await handleIncoming(message, chat);
    }

    return { onMessage };
}
