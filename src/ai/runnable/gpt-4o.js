import { ChatOpenAI } from "@langchain/openai";
import { defaultIntro } from "../defaults.js";
import { convertMessages } from "../utils/index.js"

export const model = "gpt-4o";

const llm = new ChatOpenAI({
  model: model,
  temperature: 0.6
})

export default {
    request: async (requestMessage, { chatHistory }) => {
        const response = await llm.invoke([
            {
                role: "system",
                content: defaultIntro
            },
            ...await convertMessages(chatHistory),
            {
                role: "user",
                content: requestMessage.getTextWithoutCommands()
            }
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