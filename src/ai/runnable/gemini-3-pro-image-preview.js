import AppError from "../utils/AppError.js";

const model = "gemini-3-pro-image-preview";

function getGoogleApiKey() {
    return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
}

function pickInlineData(part) {
    return part?.inlineData || part?.inline_data;
}

function ensureMimeType(mimeType) {
    if (mimeType && typeof mimeType === 'string') return mimeType;
    return 'image/jpeg';
}

function normalizeMimeType(mimeType) {
    const value = ensureMimeType(mimeType);
    return value.split(';')[0].trim();
}

function detectImageMimeFromBuffer(buffer) {
    if (!buffer || buffer.length < 12) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
        buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
    ) return 'image/png';

    // GIF: "GIF8"
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return 'image/gif';

    // WEBP: "RIFF" .... "WEBP"
    if (
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) return 'image/webp';

    return null;
}

async function downloadAsBase64(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new AppError("Failed to download image", {
            info: { url, status: res.status },
            clientMessage: "Не удалось скачать изображение из Telegram"
        });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    let contentType = normalizeMimeType(res.headers.get('content-type'));

    // Telegram иногда отвечает application/octet-stream, но Gemini требует image/*
    if (!contentType.startsWith('image/')) {
        contentType = detectImageMimeFromBuffer(buffer) || 'image/jpeg';
    }

    return { base64: buffer.toString('base64'), mimeType: contentType };
}

function collectRecentUserImages(chatHistory, requestMessage, { maxImages = 6 } = {}) {
    const all = [...chatHistory, requestMessage];
    const images = [];

    for (let i = all.length - 1; i >= 0; i -= 1) {
        const msg = all[i];
        if (msg?.isBot?.()) break;
        if (msg?.isPhoto?.()) images.push(msg);
    }

    images.reverse();
    return images.slice(-maxImages);
}

export default {
    request: async (requestMessage, { chatHistory, chat }) => {
        const apiKey = getGoogleApiKey();
        if (!apiKey) {
            throw new AppError("GOOGLE_API_KEY is not set", {
                clientMessage: "Не задан GOOGLE_API_KEY (или GEMINI_API_KEY) для Google Gemini"
            });
        }

        const instruction = requestMessage.getAIText?.() || requestMessage.getTextWithoutCommands?.() || '';

        const imageMessages = collectRecentUserImages(chatHistory, requestMessage, { maxImages: 6 });
        if (!instruction && imageMessages.length === 0) {
            throw new AppError("Empty /image request", {
                clientMessage: "Пришлите текстовую инструкцию и/или одно или несколько изображений"
            });
        }

        await chat.startTyping('upload_photo');

        const imageParts = [];
        for (const msg of imageMessages) {
            const fileUrl = await msg.bot.getFileLink(msg.getFileId());
            const { base64, mimeType } = await downloadAsBase64(fileUrl);
            // Gemini REST API обычно ожидает snake_case: inline_data / mime_type
            imageParts.push({
                inline_data: {
                    mime_type: mimeType,
                    data: base64
                }
            });
        }

        const parts = [
            ...imageParts,
            { text: instruction || " " }
        ];

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const body = {
            contents: [{ role: "user", parts }],
            // В Gemini Developer API поле response_mime_type ограничено текстовыми MIME.
            // Для выдачи изображения достаточно запросить response_modalities: ["IMAGE"].
            generation_config: {
                response_modalities: ["IMAGE"]
            }
        };

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
            const msg = data?.error?.message || `Gemini API error (${res.status})`;
            console.log(data);
            throw new AppError("Gemini request failed", {
                info: { status: res.status, msg, data },
                clientMessage: "Ошибка Google Gemini при генерации изображения"
            });
        }

        const candidateParts = data?.candidates?.[0]?.content?.parts || [];
        const imagePart = candidateParts.find(p => {
            const inline = pickInlineData(p);
            return inline?.data && (inline?.mimeType || inline?.mime_type || '').startsWith('image/');
        });

        const inline = pickInlineData(imagePart);
        if (!inline?.data) {
            throw new AppError("Gemini did not return image", {
                info: { data },
                clientMessage: "Google Gemini не вернул изображение в ответ"
            });
        }

        const outputBuffer = Buffer.from(inline.data, 'base64');

        return {
            content: outputBuffer,
            type: "imageUrl",
            metadata: {
                model,
                prompt: instruction,
                images: imageMessages.length
            }
        };
    },

    capabilities: {
        typeOfInputs: ["text", "image"],
        typeOfOutputs: ["image"]
    },

    name: model
};
