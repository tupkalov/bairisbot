export default class AppError extends Error {
    constructor(message, { error, info } = {}) {
        super(message);
        this.name = this.constructor.name;
        if (error) this.error = error;
        this.info = info || {};
    }
}
