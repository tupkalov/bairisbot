import { DallEAPIWrapper, ChatOpenAI } from "@langchain/openai";
import { defaultIntro } from "../defaults.js";
import { convertMessages } from "../utils/index.js";
import { z } from "zod";

const model = "dall-e-2";
const imageModel = new DallEAPIWrapper({
  model,
  n: 1
});

// Модель для генерации промпта
// Может принимать только два значения: "text" или "image"
const schema = z.object({
    prompt: z.string().describe("The prompt for generating an image")
});

const promptModel = new ChatOpenAI({
    model: "gpt-4o-mini",
}).withStructuredOutput(schema, {
    name: "imagePrompt",
    strict: true,
});

export default {
    request: async (requestMessage, { chatHistory, chat }) => {
        // Определяем короткий промпт для генерации запроса в dall-e-2
        const { prompt } = await promptModel.invoke([
            {
                role: "system",
                content: defaultIntro
            },
            ...await convertMessages(chatHistory, { image: false }),
            {
                role: "system",
                content: "Ты генератор изображений. На основе предыдущего контекста и последующего промпта сгенери изображение"
            },
            {
                role: "user",
                content: requestMessage.getAIText()
            }
        ])

        await chat.startTyping('upload_photo');

        const imageUrl = await imageModel.invoke(prompt);

        return {
            content: imageUrl,
            type: "imageUrl",
            metadata: { model, prompt }
        };
    },

    capabilities: {
        typeOfInputs: ["text"],
        typeOfOutputs: ["image"]
    },

    name: model
}