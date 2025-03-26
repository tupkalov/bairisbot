import { ChatDeepSeek } from "@langchain/deepseek";
import { defaultIntro } from "../defaults.js";
import { convertMessages } from "../utils/index.js"

export const model = "deepseek-chat";

const llm = new ChatDeepSeek({
  model,
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
        typeOfInputs: ["text"],
        typeOfOutputs: ["text"]
    },

    name: model
}