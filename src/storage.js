import TelegramStorage from '@tupkalov/telegramthread-redis-storage';
import AIMessage from './AIMessage.js';

// Создаем экземпляр storage с настройками из переменных окружения
const storage = new TelegramStorage({
    redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
    prefix: process.env.REDIS_PREFIX || '',
    ttl: 60 * 60 * 24 * 7 // 7 дней
});

// Подключаемся к Redis при инициализации модуля
(async () => {
    try {
        await storage.connect();
    } catch (error) {
        console.error("Failed to connect to Redis:", error);
    }
})();

// Экспортируем адаптер для обратной совместимости
export default {
    async getChainFrom(origMessage, { maxCount = 10 } = {}) {
        const messages = await storage.getChainFrom(origMessage, { maxCount });
        // Преобразуем обратно в AIMessage объекты для совместимости
        return messages.map(msg => new AIMessage(msg));
    },

    async save(...messages) {
        await storage.save(messages);
    },

    async clearByChatId(chatId) {
        await storage.clearByChatId(chatId);
    }
}

// Экспортируем сам storage для расширенных возможностей (метаданные и т.д.)
export { storage };

