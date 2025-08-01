import { app } from './bot.js';
import { generateResponse } from '../ai/llm.js';
import { memoryService } from '../services/memory.js';

export function registerHandlers() {
  // Handle app mentions
  app.event('app_mention', async ({ event, say }) => {
    try {
      const evt = event as any;
      console.log(`Received mention from ${evt.user}: ${evt.text}`);
      
      // Remove the bot mention from the text
      const cleanText = evt.text.replace(/<@[A-Z0-9]+>/g, '').trim();
      
      if (!cleanText) {
        await say('Hi! How can I help you today?');
        return;
      }
      
      // Get conversation history
      const channelId = evt.channel;
      const history = await memoryService.getConversationHistory(evt.user, channelId);
      const conversationContext = memoryService.formatMessagesForPrompt(history);
      
      // Add user message to history
      await memoryService.addMessage(evt.user, {
        role: 'user',
        content: cleanText,
        timestamp: Date.now()
      }, channelId);
      
      // Generate AI response with context
      const response = await generateResponse(cleanText, conversationContext);
      
      // Add assistant response to history
      await memoryService.addMessage(evt.user, {
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      }, channelId);
      
      // Reply in thread if the mention was in a thread
      await say({
        text: response,
        thread_ts: evt.thread_ts || evt.ts,
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
      const userId = (message as any).user;
      console.log(`Received DM: ${text}`);
      
      // Get conversation history for DM
      const history = await memoryService.getConversationHistory(userId);
      const conversationContext = memoryService.formatMessagesForPrompt(history);
      
      // Add user message to history
      await memoryService.addMessage(userId, {
        role: 'user',
        content: text,
        timestamp: Date.now()
      });
      
      // Generate AI response with context
      const response = await generateResponse(text, conversationContext);
      
      // Add assistant response to history
      await memoryService.addMessage(userId, {
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });
      
      await say(response);
    } catch (error) {
      console.error('Error handling message:', error);
      await say('Sorry, I encountered an error processing your message.');
    }
  });
  
  console.log('Message handlers registered');
}