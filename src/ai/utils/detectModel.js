import { aliases, typeOfInputs, typeOfOutputs, defaultModelName } from '../runnable/index.js';
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { MessageError } from 'telegramthread'; 
import convertMessages from './convertMessages.js';
import AppError from './AppError.js';

///////////////////////////////////////////
/// Detect type of response

// Может принимать только три значения: "text", "image" или "video"
const responseTypeSchema = z.object({
    type: z.enum(["text", "image", "video"])
        .describe("The type of response")
});

const structuredLlm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0
}).withStructuredOutput(responseTypeSchema, {
    name: "responseType",
    strict: true,
});

export async function detectTypeOfResponse(requestMessage, { chatHistory }) {
    if (requestMessage.isPhoto()) return { type: "text" };

    const { type } = await structuredLlm.invoke([
        ...await convertMessages(chatHistory),
        {
            role: "system",
            content: "Твоя задача определить какой тип ответа хочет получить пользователь." +
                "Если просит нарисовать, зарендерить, изобразить то твой ответ \"image\"." +
                "Если просит создать видео, анимацию, ролик то твой ответ \"video\"." +
                "В остальных случаях \"text\".",
        },
        {
            role: "user",
            content: requestMessage.getText(),
        }
    ]);
    
    return { type };
}

///////////////////////////////////////////
// Определение модели из последних сообщений
export default async function detectModel(requestMessage, { chatHistory }) {
    const typeofInput = requestMessage.isPhoto() ? "image" : "text";

    const modelFromBracketPrefix = (text) => {
        if (!text || typeof text !== 'string') return null;
        const match = text.trim().match(/^\[([^\]]+)\]/);
        if (!match) return null;
        return match[1].trim();
    };

    const getRepliedModel = (replyMessage) => {
        if (!replyMessage) return null;
        // 1) Если это AIMessage из storage (редко в Telegram reply), у него может быть metadata
        const fromMetadata = replyMessage.data?.metadata?.model || replyMessage.data?.aiResponse?.model;
        if (fromMetadata) return fromMetadata;
        // 2) Fallback: мы отправляем caption вида [model], её можно распарсить
        const fromText = modelFromBracketPrefix(replyMessage.getText?.());
        if (fromText) return fromText;
        return null;
    };

    const commandsFromText = (text) => {
        if (!text) return [];
        // Telegram в caption у фото кладет команды в caption_entities, а Message.isCommand()
        // у нас смотрит только на text/entities. Поэтому дополнительно парсим команды из текста.
        const matches = text.match(/(?:^|\s)\/[^\x00-\x20\s]+/g);
        if (!matches) return [];
        return matches.map(s => s.trim());
    };

    const declaredCommands = requestMessage.isCommand()
        ? requestMessage.getCommands()
        : commandsFromText(requestMessage.getText?.());

    // 1) Если пользователь явно указал команду — она важнее reply/истории.
    if (declaredCommands.length) {
        let runnable;

        for (const command of declaredCommands) {
            const unescaped = command.replace(/^\//, '');
            if (aliases[unescaped]) {
                runnable = aliases[unescaped];
                break;
            }
        }

        if (runnable) {
            // Если сообщение фото, а модель не поддерживает инпут фото - то кидаем ошибку
            if (!typeOfInputs[typeofInput].includes(runnable)) {
                throw new AppError("Model does not support input " + typeofInput, {
                    info: { runnable },
                    clientMessage: "Модель не поддерживает этот тип на вход"
                });
            }
            return runnable;
        }
    }

    // 2) Если это reply на картинку, сгенерированную image-моделью, продолжаем той же моделью.
    // Это позволяет делать "продолжение" генерации/вариации без повторной команды /image.
    if (requestMessage.isReply?.()) {
        const reply = requestMessage.getReply?.();
        if (reply?.isBot?.()) {
            const replyModel = getRepliedModel(reply);
            if (
                replyModel &&
                typeOfOutputs.image?.includes(replyModel) &&
                typeOfInputs[typeofInput]?.includes(replyModel)
            ) {
                return replyModel;
            }
        }
    }

    const typeOfResponse = await detectTypeOfResponse(...arguments);
    // 3. Модель могла определиться с ИИ. Например хелп.
    let { runnable } = typeOfResponse;
    if (runnable) return runnable;

    // 4. Ищем в запросе указание команды

    // Это понадобится для определения соответствия модели по типу входу и выходу
    const { type: typeofOutput } = typeOfResponse;

    if (declaredCommands.length) {
        for (const command of declaredCommands) {
            const unescaped = command.replace(/^\//, '');
            if (aliases[unescaped]) {
                runnable = aliases[unescaped];
                break;
            }
        }

        // Если команда не распознана как алиас модели — игнорируем и идём дальше.
        if (!runnable) {
            // no-op
        } else {

            // Если сообщение фото, а модель не поддерживает инпут фото - то кидаем ошибку
            if (!typeOfInputs[typeofInput].includes(runnable)) {
                throw new AppError("Model does not support input " + typeofInput, {
                    info: { runnable },
                    clientMessage: "Модель не поддерживает этот тип на вход"
                });
            }
            
            return runnable
        }
    }

    for (const message of [...chatHistory].reverse()) {
        if (!message.isBot()) continue;
        runnable = message.data.metadata?.model || message.data.aiResponse?.model;
        
        // Если предыдущая модель была видео-генератор (sora-2), 
        // и пользователь не указал явно команду для видео,
        // то используем текстовую модель по умолчанию
        if (runnable === 'sora-2' && typeofOutput !== 'video') {
            runnable = defaultModelName[typeofInput]["text"];
        }
        
        if (runnable 
            && typeOfOutputs[typeofOutput]?.includes(runnable) 
            && typeOfInputs[typeofInput]?.includes(runnable))
        return runnable;
    }

    runnable = defaultModelName[typeofInput][typeofOutput];
    if (!runnable) throw new MessageError("Model not found", { info: { typeofInput, typeofOutput }, clientMessage: "Модель не найдена" });
    return runnable;
}
