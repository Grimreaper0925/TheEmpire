import { logger } from '../utils/logger.js';

export default {
    name: 'ready',
    once: true,
    async execute(client) {
        logger.success(`Logged in as ${client.user.tag}!`);
    }
};
