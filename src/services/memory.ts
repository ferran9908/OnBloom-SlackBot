import { Redis } from '@upstash/redis';
import { env } from '../env.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ConversationHistory {
  messages: Message[];
  lastUpdated: number;
}

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const CONVERSATION_TTL = 48 * 60 * 60; // 48 hours in seconds
const MAX_MESSAGES = 20; // Keep last 20 messages for context

export class MemoryService {
  private getKey(userId: string, channelId?: string): string {
    return channelId ? `conversation:${channelId}:${userId}` : `conversation:dm:${userId}`;
  }

  async getConversationHistory(userId: string, channelId?: string): Promise<Message[]> {
    try {
      const key = this.getKey(userId, channelId);
      const data = await redis.get<ConversationHistory>(key);
      
      if (!data) {
        return [];
      }
      
      return data.messages;
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }
  }

  async addMessage(userId: string, message: Message, channelId?: string): Promise<void> {
    try {
      const key = this.getKey(userId, channelId);
      const existing = await redis.get<ConversationHistory>(key);
      
      const messages = existing?.messages || [];
      messages.push(message);
      
      // Keep only the last MAX_MESSAGES
      const trimmedMessages = messages.slice(-MAX_MESSAGES);
      
      const updatedHistory: ConversationHistory = {
        messages: trimmedMessages,
        lastUpdated: Date.now(),
      };
      
      await redis.setex(key, CONVERSATION_TTL, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Error saving message to history:', error);
    }
  }

  async clearConversation(userId: string, channelId?: string): Promise<void> {
    try {
      const key = this.getKey(userId, channelId);
      await redis.del(key);
    } catch (error) {
      console.error('Error clearing conversation:', error);
    }
  }

  formatMessagesForPrompt(messages: Message[]): string {
    if (messages.length === 0) return '';
    
    const formattedMessages = messages.map(msg => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      return `${role}: ${msg.content}`;
    }).join('\n');
    
    return `Previous conversation:\n${formattedMessages}\n\nCurrent message:`;
  }
}

export const memoryService = new MemoryService();