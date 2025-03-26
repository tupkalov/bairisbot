import { aliases, typeOfInputs, typeOfOutputs, defaultModelName } from '../runnable/index.js';
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { MessageError } from 'telegramthread'; 
import { model } from '../runnable/gpt-4o-mini.js';
///////////////////////////////////////////
/// Detect type of response

// Может принимать только два значения: "text" или "image"
const responseTypeSchema = z.object({
    type: z.enum(["text", "image", "help"])
        .describe("The type of response")
});

const structuredLlm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0
}).withStructuredOutput(responseTypeSchema, {
    name: "responseType",
    strict: true,
});

export async function detectTypeOfResponse(requestMessage) {
    if (requestMessage.isPhoto()) return { type: "text" };

    const { type } = await structuredLlm.invoke([
        {
            role: "system",
            content: "Твоя задача определить какой тип ответа хочет получить пользователь." +
                "Если просит нарисовать, зарендерить, изобразить то твой ответ \"image\"." +
                "Если пользователь спрашивает как тобой пользоваться, какие модели у тебя есть, или любой справочный вопрос по работе с тобой, то \"help\"" +
                "В остальных случаях \"text\".",
        },
        {
            role: "user",
            content: requestMessage.getText(),
        }
    ]);
    if (type === "help") return { runnable: type };
    
    return { type };
}

///////////////////////////////////////////
// Определение модели из последних сообщений
export default async function detectModel(requestMessage, { chatHistory }) {
    const typeOfResponse = await detectTypeOfResponse(requestMessage);
    // 1. Модель могла определиться с ИИ. Например хелп.
    let { runnable } = typeOfResponse;
    if (runnable) return runnable;

    // 2. Ищем в запросе указание команды

    // Это понадобится для определения соответствия модели по типу входу и выходу
    const { type: typeofOutput } = typeOfResponse;
    const typeofInput = requestMessage.isPhoto() ? "image" : "text";

    if (requestMessage.isCommand()) {
        for (const command of requestMessage.getCommands()) {
            const unescaped = command.replace(/^\//, '');
            if (aliases[unescaped]) {
                runnable = aliases[unescaped];
                break;
            }
        }

        // Если сообщение фото, а модель не поддерживает инпут фото - то кидаем ошибку
        if (!typeOfInputs[typeofInput].includes(runnable)) {
            throw new AppError("Model does not support input " + typeofInput, {
                info: { runnable },
                clientMessage: "Модель не поддерживает этот тип на вход"
            });
        }
        
        return runnable
    }

    for (const message of [...chatHistory].reverse()) {
        if (!message.isBot()) continue;
        runnable = message.data.metadata?.model || message.data.aiResponse?.model;
        if (runnable 
            && typeOfOutputs[typeofOutput]?.includes(runnable) 
            && typeOfInputs[typeofInput]?.includes(runnable))
        return runnable;
    }

    runnable = defaultModelName[typeofInput][typeofOutput];
    if (!runnable) throw new MessageError("Model not found", { info: { typeofInput, typeofOutput }, clientMessage: "Модель не найдена" });
    return runnable;
}
