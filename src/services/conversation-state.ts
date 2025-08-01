import { Redis } from '@upstash/redis';
import { env } from '../env.js';

export interface HousingConversationState {
  stage: 'detected' | 'awaiting_location' | 'awaiting_preferences' | 'complete';
  location?: string;
  demographics?: {
    age?: string;
    ethnicity?: string;
  };
  preferences?: string[];
  timestamp: number;
}

export class ConversationStateService {
  private redis: Redis;
  private STATE_TTL = 10 * 60; // 10 minutes for state TTL

  constructor() {
    this.redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  private getStateKey(userId: string, channelId?: string): string {
    return channelId 
      ? `state:housing:${channelId}:${userId}` 
      : `state:housing:dm:${userId}`;
  }

  async getHousingState(userId: string, channelId?: string): Promise<HousingConversationState | null> {
    try {
      const key = this.getStateKey(userId, channelId);
      const state = await this.redis.get<HousingConversationState>(key);
      
      if (!state) return null;
      
      // Check if state is too old (more than 10 minutes)
      if (Date.now() - state.timestamp > this.STATE_TTL * 1000) {
        await this.clearHousingState(userId, channelId);
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Error getting housing state:', error);
      return null;
    }
  }

  async setHousingState(
    userId: string, 
    state: HousingConversationState, 
    channelId?: string
  ): Promise<void> {
    try {
      const key = this.getStateKey(userId, channelId);
      await this.redis.setex(key, this.STATE_TTL, JSON.stringify(state));
    } catch (error) {
      console.error('Error setting housing state:', error);
    }
  }

  async updateHousingState(
    userId: string,
    updates: Partial<HousingConversationState>,
    channelId?: string
  ): Promise<HousingConversationState | null> {
    try {
      const currentState = await this.getHousingState(userId, channelId);
      if (!currentState) return null;
      
      const newState: HousingConversationState = {
        ...currentState,
        ...updates,
        timestamp: Date.now(),
      };
      
      await this.setHousingState(userId, newState, channelId);
      return newState;
    } catch (error) {
      console.error('Error updating housing state:', error);
      return null;
    }
  }

  async clearHousingState(userId: string, channelId?: string): Promise<void> {
    try {
      const key = this.getStateKey(userId, channelId);
      await this.redis.del(key);
    } catch (error) {
      console.error('Error clearing housing state:', error);
    }
  }

  isStateExpired(state: HousingConversationState): boolean {
    return Date.now() - state.timestamp > this.STATE_TTL * 1000;
  }
}

export const conversationStateService = new ConversationStateService();