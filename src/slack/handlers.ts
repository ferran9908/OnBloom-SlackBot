import { app } from './bot.js';
import { generateResponse } from '../ai/llm.js';

export function registerHandlers() {
  // Handle app mentions
  app.event('app_mention', async ({ event, say }) => {
    try {
      console.log(`Received mention from ${event.user}: ${event.text}`);
      
      // Remove the bot mention from the text
      const cleanText = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
      
      if (!cleanText) {
        await say('Hi! How can I help you today?');
        return;
      }
      
      // Generate AI response
      const response = await generateResponse(cleanText);
      
      // Reply in thread if the mention was in a thread
      await say({
        text: response,
        thread_ts: event.thread_ts || event.ts,
      });
    } catch (error) {
      console.error('Error handling app mention:', error);
      await say('Sorry, I encountered an error processing your request.');
    }
  });
  
  // Handle direct messages
  app.message(async ({ message, say }) => {
    // Skip if message is from a bot or in a channel
    if (message.subtype || message.channel_type !== 'im') return;
    
    try {
      const text = (message as any).text;
      console.log(`Received DM: ${text}`);
      
      const response = await generateResponse(text);
      await say(response);
    } catch (error) {
      console.error('Error handling message:', error);
      await say('Sorry, I encountered an error processing your message.');
    }
  });
  
  console.log('Message handlers registered');
}