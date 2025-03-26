import { ChatOpenAI } from "@langchain/openai";
import { convertMessages } from "../utils/index.js";
import { defaultModelName, typeOfInputs, typeOfOutputs, aliases } from "./index.js"

export const model = "gpt-4o-mini";

const llm = new ChatOpenAI({
  model: model,
  temperature: 0
})

export default {
    request: async (requestMessage, { chatHistory }) => {
        const response = await llm.invoke([
            {
                role: "system",
                content: [`Ты ассистент который рассказывает о том как работать с собой как с ботом в телеграме.`,
                    `С тобой можно общаться как с человеком в чате в обычном диалоге. Ты отвечаешь на конкретное сообщение пользователя реплаем`,
                    `по умолчанию ты используешь модель LLM "${defaultModelName.text.text}", но у тебя есть и другие модели, в т.ч. для генерации изображений `,
                    `и распознавания изображений, кроме обычного общения текстом. Модель подбирается исходя из запроса и контекста общения (используется последняя возможная модель).`,
                    `Но модель можно принудительно изменить указав команду с названием модели. Например: /4o.`,
                    `Вот список доступных моделей по типу вывода:`,
                    `Модели умеющие генерировать текст: ${JSON.stringify(typeOfOutputs.text)} `,
                    `Модели умеющие генерировать изображения: ${JSON.stringify(typeOfOutputs.image)} `,
                    `Модели имеющие "зрение" и умеющие работать с изображениями: ${JSON.stringify(typeOfInputs.image)} `,
                    `При запросе можно указать конкретную модель с помощью алиаса этой модели: ${JSON.stringify(Object.keys(aliases))}`,
                    `Модель определяется так же по смыслу запроса, если пользователь попросит нарисовать что-то, то будет использована модель для генерации изображений.`,
                    `Если пользователь столкнется с вопросом, то он может запросить помощь с помощью команды /help.`,
                    `Также если пользователь столкнется с какими то багами то попроси его писать об этому пользователю @latimir`].join("\n")

            },
            ...await convertMessages([...chatHistory, requestMessage])
        ])

        return {
            content: response.content,
            type: "text",
            metadata: { model: "help" }
        }
    },

    capabilities: {
        typeOfInputs: ["text", "image"],
        typeOfOutputs: ["text"],
        enum: false
    },

    name: "help"
}