import { logger } from '../utils/logger.js';
import { startChatResetScheduler } from '../services/chatResetService.js';

export default {
    name: 'ready',
    once: true,
    async execute(client) {
        logger.info(`Logged in as ${client.user.tag}!`);

        startChatResetScheduler(client);
    }
};
