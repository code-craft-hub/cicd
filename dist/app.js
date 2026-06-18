"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
function buildApp() {
    const app = (0, fastify_1.default)({ logger: true });
    app.get('/', async () => {
        return { message: 'Hello, world!' };
    });
    app.get('/health', async () => {
        return { status: 'ok' };
    });
    return app;
}
