import { detectModel } from './utils/index.js';
import { models } from './runnable/index.js';

export default {
    async request() {
        const modelName = await detectModel(...arguments);
        return await models[modelName].request(...arguments);
    }
}
