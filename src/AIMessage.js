import { Message } from 'telegramthread';

export default class AIMessage extends Message {
    getAIText() {
        var result = this.data.metadata?.content || this.data.aiResponse?.content || this.getTextWithoutCommands() || ' ';
        result = result.replace(/^\[[A-Za-z0-9_\-]+\]/, '').trim();
        return result;
    }
}