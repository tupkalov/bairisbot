import gpt4oMini from './gpt-4o-mini.js';
import dallE2 from './dall-e-2.js';
import dallE3 from './dall-e-3.js';
import grok2 from './grok-2.js';
import gpt4o from './gpt-4o.js';

import o3Mini from './o3-mini.js';

import deepseekChat from './deepseek-chat.js';

import help from './help.js';

export const models = {
    'gpt-4o-mini': gpt4oMini,
    'gpt-4o': gpt4o,
    'dall-e-2': dallE2,
    'dall-e-3': dallE3,
    'grok-2': grok2,
    'o3-mini': o3Mini,
    'deepseek-chat': deepseekChat,
    help
}

export const aliases = Object.entries({
    'gpt-4o-mini': ['gpt4omini', 'gpt', 'openai', '4omini', 'mini'],
    'dall-e-2': ['dalle2'],
    'dall-e-3': ['dalle3', 'image', 'dalle', 'dall3'],
    'grok-2': ['grok2', 'grok', 'xai', 'grok2', 'elon', 'elonmusk'],
    'gpt-4o': ['gpt4o', 'gpt4', 'gpt4o', '4o', '4'],
    'o3-mini': ['o3', 'o3mini'],
    'deepseek-chat': ['deepseekchat', 'deepseek', 'deep', 'seek', 'deepseek'],
    'help': ['help']
}).reduce((acc, [key, values]) => {
    values.forEach(value => acc[value] = key);
    return acc;
}, {});

export const typeOfOutputs = ["text", "image"].reduce((acc, type) => {
    acc[type] = Object.values(models).filter(model => model.capabilities.typeOfOutputs?.includes(type) && model.capabilities.enum !== false).map(model => model.name);
    return acc;
}, {});

export const typeOfInputs = ["text", "image"].reduce((acc, type) => {
    acc[type] = Object.values(models).filter(model => model.capabilities.typeOfInputs?.includes(type) && model.capabilities.enum !== false).map(model => model.name);
    return acc;
}, {});

export const defaultModelName = {
    "text": {
        "image": "dall-e-3",
        "text": "gpt-4o-mini"
    },
    "image": {
        "text": "gpt-4o-mini"
    }
}