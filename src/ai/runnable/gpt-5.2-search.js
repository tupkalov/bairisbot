import OpenAI from "openai";
import { defaultIntro } from "../defaults.js";
import { convertMessages } from "../utils/index.js";

export const model = "gpt-5.2-chat-latest";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export default {
    request: async (requestMessage, { chatHistory }) => {
        const messages = [
            {
                role: "system",
                content: defaultIntro
            },
            ...await convertMessages([...chatHistory, requestMessage])
        ];

        const input = messages.map(msg => {
            if (msg.role === "system") {
                return `System: ${msg.content}`;
            }
            return `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`;
        }).join("\n\n");

        const response = await openai.responses.create({
            model,
            tools: [
                { type: "web_search" }
            ],
            input
        });

        const textContent = response.output_text;
        if (!textContent) {
            throw new Error("No text content found in response");
        }

        return {
            content: textContent,
            type: "text",
            metadata: {
                model: "gpt-52-search",
                annotations: response.output?.[0]?.content?.[0]?.annotations || []
            }
        };
    },

    capabilities: {
        typeOfInputs: ["text"],
        typeOfOutputs: ["text"]
    },

    name: "gpt-5.2-search"
};
