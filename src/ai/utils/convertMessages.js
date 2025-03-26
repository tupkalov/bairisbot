import { Message } from 'telegramthread';

///////////////////////////////////////////
/// Convert messages
export default async function convertMessages(chatHistory, capabilities = {}) {
    // Определяем capabilities
    const { image: imageCapability = true } = capabilities;
    const output = [];

    for (const message of chatHistory) {
        

        if (!(message instanceof Message)) throw new AppError("Invalid typeof input message", { info: { message } });
        
        // Инпут текст
        if (message.isText()) {
            output.push({
                role: message.isBot() ? "assistant" : "user",
                content: message.getAIText()
            });
            continue;
        
        // Если это изображение
        } else if (message.isPhoto()) {
            if (message.isBot()) {
                const prompt = message.data.aiResponse?.prompt || message.data.metadata?.prompt;
                if (!prompt) throw new AppError("No prompt in bot message", { info: { message}});
                // Если картинка генерировалась моделью то вместо картинки добавляем промпт который генерил это
                output.push({
                    role: "assistant",
                    content: prompt
                });
                continue;

            } else {
                // Не все модели поддерживают инпут изображения
                if (!imageCapability) continue;
                const fileUrl = await message.bot.getFileLink(message.getFileId());

                const messageObject = {
                    role: "user",
                    content: [{
                        type: "image_url",
                        image_url: {
                            url: fileUrl
                        }
                    }]
                };

                // Добавляем описание если его добавляли
                const caption = message.getText();
                if (caption) messageObject.content.push({ type: "text", text: caption });

                output.push(messageObject);
                continue;
            }
        } else {
            throw new AppError("Invalid message type for text context", { info: { message } });
        }
    };
    return output;
};