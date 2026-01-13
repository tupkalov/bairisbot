import { ChatXAI } from "@langchain/xai";
import { defaultIntro } from "../defaults.js";
import { convertMessages } from "../utils/index.js"

export const model = "grok-3";

const llm = new ChatXAI({
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
                content: requestMessage.getText()
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