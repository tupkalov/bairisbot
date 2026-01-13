import { ChatOpenAI } from "@langchain/openai";
import { defaultIntro } from "../defaults.js";
import { convertMessages } from "../utils/index.js";

export const model = "gpt-5-mini";

const llm = new ChatOpenAI({
  model: model
  // temperature не поддерживается для gpt-5-mini, используется значение по умолчанию (1)
})

export default {
    request: async (requestMessage, { chatHistory }) => {
        const response = await llm.invoke([
            {
                role: "system",
                content: defaultIntro
            },
            ...await convertMessages([...chatHistory, requestMessage])
        ])

        return {
            content: response.content,
            type: "text",
            metadata: { model }
        }
    },

    capabilities: {
        typeOfInputs: ["text", "image"],
        typeOfOutputs: ["text"]
    },

    name: model
}
