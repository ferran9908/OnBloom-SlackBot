import { app } from './bot.js';
import { generateResponse } from '../ai/llm.js';
import { memoryService } from '../services/memory.js';
import { HousingService } from '../services/housing.js';
import { conversationStateService } from '../services/conversation-state.js';
import { env } from '../env.js';

// Initialize housing service
const housingService = new HousingService(env.QLOO_API_KEY);

// Command detection
function detectCommand(message: string): string | null {
  const lowerMessage = message.toLowerCase().trim();
  
  // Check for clear/reset commands
  if (lowerMessage === 'clear' || 
      lowerMessage === 'reset' || 
      lowerMessage === 'new chat' || 
      lowerMessage === 'start over' ||
      lowerMessage === 'clear chat' ||
      lowerMessage === 'reset conversation') {
    return 'clear';
  }
  
  // Check for help command
  if (lowerMessage === 'help' || lowerMessage === '/help') {
    return 'help';
  }
  
  return null;
}

async function handleHousingInteraction(
  userId: string,
  userMessage: string,
  channelId?: string
): Promise<{ response: string | null; isHousingFlow: boolean }> {
  try {
    const result = await housingService.handleHousingConversation(
      userId,
      userMessage,
      channelId
    );

    if (result.response) {
      return { response: result.response, isHousingFlow: true };
    }

    return { response: null, isHousingFlow: false };
  } catch (error) {
    console.error('Error in housing interaction:', error);
    return { response: null, isHousingFlow: false };
  }
}

export function registerHandlers() {
  // Handle app mentions
  app.event('app_mention', async ({ event, say }) => {
    try {
      const evt = event as any;
      console.log(`Received mention from ${evt.user}: ${evt.text}`);
      
      // Remove the bot mention from the text
      const cleanText = evt.text.replace(/<@[A-Z0-9]+>/g, '').trim();
      
      if (!cleanText) {
        await say({
          text: 'Hi! How can I help you today? Type "help" to see what I can do!',
          thread_ts: evt.thread_ts || evt.ts,
        });
        return;
      }
      
      // Check for commands first
      const command = detectCommand(cleanText);
      
      if (command === 'clear') {
        const channelId = evt.channel;
        await memoryService.clearConversation(evt.user, channelId);
        await conversationStateService.clearHousingState(evt.user, channelId);
        await say({
          text: "✨ I've cleared our conversation history. Let's start fresh! How can I help you today?",
          thread_ts: evt.thread_ts || evt.ts,
        });
        return;
      }
      
      if (command === 'help') {
        await say({
          text: `Here's what I can help you with:

💬 **General conversation** - Just chat with me naturally!
🏠 **Housing recommendations** - Ask me about neighborhoods, where to live, or housing options
🔄 **Clear conversation** - Say "clear", "reset", or "new chat" to start fresh
💡 **Get recommendations** - Ask about restaurants, movies, music, and more

Just mention me and ask away!`,
          thread_ts: evt.thread_ts || evt.ts,
        });
        return;
      }
      
      // Check if this is part of a housing conversation flow
      const channelId = evt.channel;
      const housingResult = await handleHousingInteraction(evt.user, cleanText, channelId);
      
      let response: string;
      if (housingResult.response) {
        response = housingResult.response;
      } else {
        // Get conversation history for standard flow
        const history = await memoryService.getConversationHistory(evt.user, channelId);
        const conversationContext = memoryService.formatMessagesForPrompt(history);
        
        // Generate standard AI response with context
        response = await generateResponse(cleanText, conversationContext);
      }
      
      // Add user message to history
      await memoryService.addMessage(evt.user, {
        role: 'user',
        content: cleanText,
        timestamp: Date.now()
      }, channelId);
      
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
      
      // Check for commands first
      const command = detectCommand(text);
      
      if (command === 'clear') {
        await memoryService.clearConversation(userId);
        await conversationStateService.clearHousingState(userId);
        await say("✨ I've cleared our conversation history. Let's start fresh! How can I help you today?");
        return;
      }
      
      if (command === 'help') {
        await say(`Here's what I can help you with:

💬 **General conversation** - Just chat with me naturally!
🏠 **Housing recommendations** - Ask me about neighborhoods, where to live, or housing options
🔄 **Clear conversation** - Say "clear", "reset", or "new chat" to start fresh
💡 **Get recommendations** - Ask about restaurants, movies, music, and more

What would you like to know?`);
        return;
      }
      
      // Check if this is part of a housing conversation flow
      const housingResult = await handleHousingInteraction(userId, text);
      
      let response: string;
      if (housingResult.response) {
        response = housingResult.response;
      } else {
        // Get conversation history for standard flow
        const history = await memoryService.getConversationHistory(userId);
        const conversationContext = memoryService.formatMessagesForPrompt(history);
        
        // Generate standard AI response with context
        response = await generateResponse(text, conversationContext);
      }
      
      // Add user message to history
      await memoryService.addMessage(userId, {
        role: 'user',
        content: text,
        timestamp: Date.now()
      });
      
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