import gpt4oMini from './gpt-4o-mini.js';
import dallE3 from './dall-e-3.js';
import grok2 from './grok-2.js';
import grok3 from './grok-3.js';
import grok3Mini from './grok-3-mini.js';
import gpt4o from './gpt-4o.js';

import o3Mini from './o3-mini.js';

import deepseekChat from './deepseek-chat.js';

import gpt52 from './gpt-5.2.js';
import gpt52Search from './gpt-5.2-search.js';

import sora2 from './sora-2.js';
import gemini3ProImagePreview from './gemini-3-pro-image-preview.js';

export const models = {
    'gpt-4o-mini': gpt4oMini,
    'gpt-4o': gpt4o,
    'dall-e-3': dallE3,
    'grok-2': grok2,
    'grok-3': grok3,
    'grok-3-mini': grok3Mini,
    'o3-mini': o3Mini,
    'deepseek-chat': deepseekChat,
    'gpt-5.2': gpt52,
    'gpt-5.2-search': gpt52Search,
    'sora-2': sora2,
    'gemini-3-pro-image-preview': gemini3ProImagePreview
}

export const aliases = Object.entries({
    'gpt-4o-mini': ['gpt4omini', 'gpt', 'openai', '4omini', 'mini'],
    'dall-e-3': ['dalle3', 'dalle', 'dall3'],
    'gemini-3-pro-image-preview': ['image', 'nano', 'banana', 'nanobanana', 'geminiimage', 'gemini-3-pro-image-preview'],
    'grok-2': ['grok2', 'grok2', 'elon', 'elonmusk'],
    'grok-3': ['grok3', 'grok3'],
    'grok-3-mini': ['grok3mini', 'grok'],
    'gpt-4o': ['gpt4o', 'gpt4', 'gpt4o', '4o', '4'],
    'o3-mini': ['o3', 'o3mini'],
    'deepseek-chat': ['deepseekchat', 'deepseek', 'deep', 'seek'],
    'gpt-5.2': ['gpt5', 'gpt52', 'gpt-5.2', '5.2'],
    'gpt-5.2-search': ['gpt52search', 'gpt-5.2-search', 'search'],
    'sora-2': ['sora2', 'sora', 'video']
}).reduce((acc, [key, values]) => {
    values.forEach(value => acc[value] = key);
    return acc;
}, {});

export const typeOfOutputs = ["text", "image", "video"].reduce((acc, type) => {
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
        "text": "gpt-5.2",
        "video": "sora-2"
    },
    "image": {
        "text": "gpt-5.2"
    }
}