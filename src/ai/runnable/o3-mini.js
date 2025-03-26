import { ChatOpenAI } from "@langchain/openai";
import { defaultIntro } from "../defaults.js";
import { convertMessages } from "../utils/index.js"

export const model = "o3-mini";

const llm = new ChatOpenAI({
  model
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
        typeOfInputs: ["text"],
        typeOfOutputs: ["text"]
    },

    name: model
}