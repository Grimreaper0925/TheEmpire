import { logger } from '../utils/logger.js';
import { startChatResetScheduler } from '../services/chatResetService.js';
import { loadTicketCache, startTicketScheduler } from '../services/ticketSystem.js';
import { autoClose } from '../services/ticketFlows.js';
import { startAutomodScheduler } from '../services/automodService.js';
import { startAnnouncementScheduler } from '../services/scheduledAnnouncements.js';

export default {
    name: 'ready',
    once: true,
    async execute(client) {
        logger.info(`Logged in as ${client.user.tag}!`);

        startChatResetScheduler(client);
        await loadTicketCache(client);
        startTicketScheduler(client, { autoClose });
        startAutomodScheduler(client);
        startAnnouncementScheduler(client);
    }
};
