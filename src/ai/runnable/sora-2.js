import OpenAI from "openai";
import { defaultIntro } from "../defaults.js";
import { convertMessages } from "../utils/index.js";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const model = "sora-2";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Схема для генерации промпта
const schema = z.object({
    prompt: z.string().describe("The prompt for generating a video in English")
});

// Модель для генерации промпта
const promptModel = new ChatOpenAI({
    model: "gpt-4o-mini",
}).withStructuredOutput(schema, {
    name: "videoPrompt",
    strict: true,
});

export default {
    request: async (requestMessage, { chatHistory, chat }) => {
        // Генерируем промпт для видео на основе контекста
        const { prompt } = await promptModel.invoke([
            {
                role: "system",
                content: defaultIntro
            },
            ...await convertMessages(chatHistory, { image: false }),
            {
                role: "system",
                content: "Ты генератор видео. На основе предыдущего контекста и последующего запроса сгенерируй краткий английский промпт для создания видео (максимум 2-3 предложения)."
            },
            {
                role: "user",
                content: requestMessage.getAIText()
            }
        ]);

        // Отправляем статусное сообщение
        const statusMessage = await chat.sendText(
            `[${model}] 🎬 Генерирую видео...\nПромпт: ${prompt}`,
            { replyTo: requestMessage }
        );

        // Начинаем генерацию видео
        const video = await openai.videos.create({
            prompt: prompt
        });

        // Функция для проверки статуса
        const checkStatus = async () => {
            const videoStatus = await openai.videos.retrieve(video.id);
            return videoStatus;
        };

        // Ждем завершения генерации
        let videoStatus = await checkStatus();
        let attempts = 0;
        const maxAttempts = 120; // Максимум 10 минут (120 * 5 секунд)

        while (videoStatus.status !== "completed" && videoStatus.status !== "failed" && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Ждем 5 секунд
            videoStatus = await checkStatus();
            attempts++;

            // Обновляем статус каждые 30 секунд
            if (attempts % 6 === 0) {
                await chat.editText(statusMessage, 
                    `[${model}] 🎬 Генерирую видео... (${Math.floor(attempts * 5 / 60)} мин)\nПромпт: ${prompt}\nСтатус: ${videoStatus.status}`
                );
            }
        }

        // Проверяем результат
        if (videoStatus.status === "failed") {
            await chat.editText(statusMessage, 
                `[${model}] ❌ Ошибка при генерации видео\nПромпт: ${prompt}`
            );
            throw new Error(`Video generation failed: ${videoStatus.error?.message || 'Unknown error'}`);
        }

        if (videoStatus.status !== "completed") {
            await chat.editText(statusMessage, 
                `[${model}] ⏱️ Превышено время ожидания\nПромпт: ${prompt}`
            );
            throw new Error("Video generation timeout");
        }

        // Удаляем статусное сообщение
        await chat.deleteMessage(statusMessage);

        // Возвращаем URL видео
        return {
            content: videoStatus.url || videoStatus.output?.url,
            type: "videoUrl",
            metadata: { 
                model,
                prompt,
                videoId: video.id
            }
        };
    },

    capabilities: {
        typeOfInputs: ["text"],
        typeOfOutputs: ["video"]
    },

    name: model
};
