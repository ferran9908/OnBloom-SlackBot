import { startBot } from './slack/bot.js';
import { registerHandlers } from './slack/handlers.js';
import { createWebhookServer } from './api/webhooks.js';
import { env } from './env.js';

async function main() {
  try {
    // Register Slack event handlers
    registerHandlers();
    
    // Start the Slack bot
    await startBot();
    
    // Start webhook server if not in socket mode only
    if (env.NODE_ENV !== 'test') {
      const webhookApp = createWebhookServer();
      const webhookPort = env.PORT + 1;
      
      webhookApp.listen(webhookPort, () => {
        console.log(`📡 Webhook server running on port ${webhookPort}`);
      });
    }
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();