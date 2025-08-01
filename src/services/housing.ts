import { generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createQlooService, QlooApiService, InsightsParams, AgeGroup } from './qloo.js';
import { env } from '../env.js';
import { conversationStateService, HousingConversationState } from './conversation-state.js';

export interface HousingQueryParams {
  location?: string;
  currentArea?: string; // WKT format
  ageRange?: string; // e.g., "25-35"
  ethnicity?: string;
  preferences?: string[];
  budget?: {
    min?: number;
    max?: number;
  };
}

export interface ParsedHousingQuery {
  isHousingQuery: boolean;
  location?: string;
  demographics?: {
    age?: string;
    ethnicity?: string;
  };
  preferences?: string[];
}

export class HousingService {
  private qloo: QlooApiService;
  private openrouter;

  constructor(qlooApiKey: string) {
    this.qloo = createQlooService(qlooApiKey);
    this.openrouter = createOpenRouter({
      apiKey: env.OPENROUTER_API_KEY,
    });
  }

  /**
   * Handle the interactive housing conversation flow
   */
  async handleHousingConversation(
    userId: string,
    message: string,
    channelId?: string
  ): Promise<{ response: string; continueFlow: boolean }> {
    // Get current conversation state
    const state = await conversationStateService.getHousingState(userId, channelId);
    
    // If no state, check if this is a housing query
    if (!state) {
      const parsedQuery = this.parseHousingQuery(message);
      if (!parsedQuery.isHousingQuery) {
        return { response: '', continueFlow: false };
      }

      // Initialize housing conversation
      await conversationStateService.setHousingState(userId, {
        stage: 'detected',
        timestamp: Date.now(),
      }, channelId);

      return {
        response: "I'd be happy to help you find housing information! Where are you looking to move to? Please share your city or region.",
        continueFlow: true,
      };
    }

    // Handle different stages of the conversation
    switch (state.stage) {
      case 'detected':
        return this.handleLocationStage(userId, message, state, channelId);
      
      case 'awaiting_location':
        return this.handleLocationStage(userId, message, state, channelId);
      
      case 'awaiting_preferences':
        return this.handlePreferencesStage(userId, message, state, channelId);
      
      default:
        return { response: '', continueFlow: false };
    }
  }

  private async handleLocationStage(
    userId: string,
    message: string,
    state: HousingConversationState,
    channelId?: string
  ): Promise<{ response: string; continueFlow: boolean }> {
    // Extract location from message
    const location = this.extractLocation(message);
    
    if (!location) {
      return {
        response: "I didn't catch the location. Could you please tell me which city or area you're interested in? For example: 'New York', 'San Francisco Bay Area', or 'Chicago'.",
        continueFlow: true,
      };
    }

    // Extract demographics if mentioned
    const demographics = this.extractDemographics(message);

    // Update state with location and immediately process with hardcoded values
    await conversationStateService.updateHousingState(userId, {
      stage: 'complete',
      location,
      demographics: { age: '25' },
      preferences: ['vibrant'],
    }, channelId);

    try {
      // Now make the Qloo API call with hardcoded information
      const params: HousingQueryParams = {
        location: location,
        ageRange: '25-29',
        preferences: ['vibrant'],
      };

      const qlooData = await this.getHousingRecommendations(params);
      const response = await this.generateHousingResponse(
        `Looking for housing in ${location}`,
        params,
        qlooData
      );

      // Clear the state after successful completion
      await conversationStateService.clearHousingState(userId, channelId);

      return {
        response,
        continueFlow: false,
      };
    } catch (error) {
      console.error('Error generating housing recommendations:', error);
      await conversationStateService.clearHousingState(userId, channelId);
      
      return {
        response: "I apologize, but I had trouble getting housing recommendations. Let me try to help you with general advice about finding housing in " + location + ".",
        continueFlow: false,
      };
    }
  }

  private async handlePreferencesStage(
    userId: string,
    message: string,
    state: HousingConversationState,
    channelId?: string
  ): Promise<{ response: string; continueFlow: boolean }> {
    // Hardcode age to 25 and preference to vibrant
    const demographics = {
      age: '25',
    };
    const preferences = ['vibrant'];

    // Merge with existing state
    const finalDemographics = {
      ...state.demographics,
      ...demographics,
    };

    const finalPreferences = [
      ...(state.preferences || []),
      ...preferences,
    ];

    // Update state to complete
    await conversationStateService.updateHousingState(userId, {
      stage: 'complete',
      demographics: finalDemographics,
      preferences: finalPreferences,
    }, channelId);

    try {
      // Now make the Qloo API call with all gathered information
      const params: HousingQueryParams = {
        location: state.location,
        ageRange: finalDemographics.age,
        ethnicity: finalDemographics.ethnicity,
        preferences: finalPreferences.length > 0 ? finalPreferences : undefined,
      };

      const qlooData = await this.getHousingRecommendations(params);
      const response = await this.generateHousingResponse(
        `Looking for housing in ${state.location}`,
        params,
        qlooData
      );

      // Clear the state after successful completion
      await conversationStateService.clearHousingState(userId, channelId);

      return {
        response,
        continueFlow: false,
      };
    } catch (error) {
      console.error('Error generating housing recommendations:', error);
      await conversationStateService.clearHousingState(userId, channelId);
      
      return {
        response: "I apologize, but I had trouble getting housing recommendations. Let me try to help you with general advice about finding housing in " + state.location + ".",
        continueFlow: false,
      };
    }
  }

  private extractLocation(message: string): string | undefined {
    // Common location patterns
    const patterns = [
      /(?:in|at|near|around|to|from)\s+([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)/i,
      /([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)\s*$/i, // Location at end of sentence
      /^([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)/i, // Location at start
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const location = match[1].trim();
        // Filter out common false positives
        if (!['I', 'Im', 'My', 'The', 'A', 'An'].includes(location)) {
          return location;
        }
      }
    }

    // Check for known city names
    const knownCities = [
      'New York', 'NYC', 'Los Angeles', 'LA', 'Chicago', 'Houston', 'Phoenix',
      'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
      'Austin', 'Jacksonville', 'San Francisco', 'SF', 'Boston', 'Seattle',
      'Denver', 'Washington DC', 'DC', 'Miami', 'Atlanta', 'Oakland',
      'Portland', 'Las Vegas', 'Detroit', 'Memphis', 'Nashville'
    ];

    const lowerMessage = message.toLowerCase();
    for (const city of knownCities) {
      if (lowerMessage.includes(city.toLowerCase())) {
        return city;
      }
    }

    return undefined;
  }

  private extractPreferences(message: string): string[] {
    const lowerMessage = message.toLowerCase();
    const preferenceKeywords = [
      'quiet', 'vibrant', 'family-friendly', 'family friendly', 'urban', 'suburban', 
      'rural', 'walkable', 'safe', 'affordable', 'upscale', 'diverse', 'cultural',
      'nightlife', 'restaurants', 'parks', 'schools', 'transit', 'trendy',
      'historic', 'modern', 'green', 'artsy', 'professional', 'student-friendly',
      'pet-friendly', 'lively', 'peaceful'
    ];

    return preferenceKeywords.filter(pref => {
      // Handle multi-word preferences
      return lowerMessage.includes(pref.replace('-', ' ')) || lowerMessage.includes(pref);
    });
  }

  /**
   * Parse user message to detect housing-related queries
   */
  parseHousingQuery(message: string): ParsedHousingQuery {
    const lowerMessage = message.toLowerCase();
    
    // Housing-related keywords
    const housingKeywords = [
      'where', 'live', 'living', 'housing', 'home', 'house', 'apartment', 
      'rent', 'neighborhood', 'area', 'move', 'moving', 'relocate',
      'from', 'based', 'located', 'stay', 'reside', 'residence'
    ];

    const isHousingQuery = housingKeywords.some(keyword => lowerMessage.includes(keyword));

    if (!isHousingQuery) {
      return { isHousingQuery: false };
    }

    // Extract location if mentioned
    const locationPatterns = [
      { pattern: /(?:in|to|near|around)\s+([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)/i, group: 1 },
      { pattern: /([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)\s+(?:area|neighborhood|region)/i, group: 1 },
    ];

    let location: string | undefined;
    for (const { pattern, group } of locationPatterns) {
      const match = message.match(pattern);
      if (match) {
        location = match[group].trim();
        break;
      }
    }

    // Extract demographics if mentioned
    const ageMatch = message.match(/\b(\d{2})\s*(?:-|to)?\s*(\d{2})?\s*(?:years?\s*old|yr)/i);
    const age = ageMatch ? (ageMatch[2] ? `${ageMatch[1]}-${ageMatch[2]}` : ageMatch[1]) : undefined;

    // Extract ethnicity if mentioned
    const ethnicities = ['asian', 'hispanic', 'latino', 'black', 'african american', 'white', 'caucasian'];
    const ethnicity = ethnicities.find(e => lowerMessage.includes(e));

    // Extract preferences
    const preferenceKeywords = ['quiet', 'vibrant', 'family-friendly', 'urban', 'suburban', 'rural', 
                               'walkable', 'safe', 'affordable', 'upscale', 'diverse', 'cultural'];
    const preferences = preferenceKeywords.filter(pref => lowerMessage.includes(pref));

    return {
      isHousingQuery: true,
      location,
      demographics: (age || ethnicity) ? { age, ethnicity } : undefined,
      preferences: preferences.length > 0 ? preferences : undefined,
    };
  }

  /**
   * Convert location name to WKT point format using LLM
   */
  private async convertLocationToWKT(location: string): Promise<string | undefined> {
    try {
      const prompt = `Convert the following location to WKT POINT format (longitude latitude). 
Only respond with the WKT point string, nothing else.
Examples:
- New York City -> POINT(-74.006 40.7128)
- San Francisco -> POINT(-122.4194 37.7749)
- Chicago -> POINT(-87.6298 41.8781)

Location: ${location}`;

      const { text } = await generateText({
        model: this.openrouter('google/gemini-2.5-flash'),
        prompt,
        temperature: 0.1,
        maxOutputTokens: 50,
      });

      // Extract WKT POINT from response
      const wktMatch = text.match(/POINT\([^)]+\)/);
      return wktMatch ? wktMatch[0] : undefined;
    } catch (error) {
      console.error('Error converting location to WKT:', error);
      return undefined;
    }
  }

  /**
   * Get housing recommendations using Qloo insights
   */
  async getHousingRecommendations(params: HousingQueryParams): Promise<any> {
    try {
      // Convert location to WKT format
      const wktLocation = params.location ? await this.convertLocationToWKT(params.location) : undefined;
      if (wktLocation) {
        console.log(`Converted location "${params.location}" to WKT: ${wktLocation}`);
      }
      
      // Convert age range to Qloo age group
      const ageGroup = this.convertToAgeGroup(params.ageRange);

      // Build insights parameters without tags
      const insightsParams: InsightsParams = {
        filterType: 'urn:entity:place', // Using place entity for neighborhoods
        signal: {
          demographics: {
            age: ageGroup,
            audiences: params.ethnicity ? [params.ethnicity] : undefined,
          },
          location: wktLocation || params.currentArea, // Use WKT format
        },
        filter: {
          // Remove address filter as we're using WKT location in signal
          // Note: tags parameter expects Qloo tag IDs, not preference strings
          // Preferences will be incorporated into the search query instead
        },
        feature: {
          explainability: true,
        },
        take: 20,
      };

      const recommendations = await this.qloo.getInsights(insightsParams);
      
      // Build search query with preferences included
      const preferencesText = params.preferences?.join(' ') || '';
      const searchQuery = `${params.location || ''} neighborhoods residential areas ${preferencesText}`.trim();
      
      // Search for relevant places/neighborhoods
      const searchResults = await this.qloo.search({
        query: searchQuery,
        types: ['place'],
        filter: {
          // Remove location filter to avoid WKT issues in search
          // The search query already contains the location
        },
        limit: 15,
      });

      return {
        recommendations: recommendations.results,
        searchResults: searchResults.results,
        preferences: params.preferences, // Pass preferences to be used in LLM prompt
      };
    } catch (error) {
      console.error('Error getting housing recommendations:', error);
      throw error;
    }
  }

  /**
   * Generate housing recommendations response using Gemini
   */
  async generateHousingResponse(
    userQuery: string,
    params: HousingQueryParams,
    qlooData: any
  ): Promise<string> {
    const prompt = this.buildHousingPrompt(userQuery, params, qlooData);

    try {
      const { text } = await generateText({
        model: this.openrouter('google/gemini-2.5-flash'),
        prompt,
        temperature: 0.8,
        maxOutputTokens: 600,
      });

      return text;
    } catch (error) {
      console.error('Error generating housing response:', error);
      // Fallback to another model if Gemini fails
      return this.generateFallbackResponse(userQuery, params);
    }
  }

  /**
   * Build prompt for housing recommendations
   */
  private buildHousingPrompt(
    userQuery: string,
    params: HousingQueryParams,
    qlooData: any
  ): string {
    let prompt = `You are a knowledgeable housing and neighborhood advisor. Based on the user's query and demographic data, provide personalized housing recommendations.

User Query: "${userQuery}"
`;

    if (params.location) {
      prompt += `Target Location: ${params.location}\n`;
    }

    if (params.ageRange) {
      prompt += `Age Range: ${params.ageRange}\n`;
    }

    if (params.ethnicity) {
      prompt += `Ethnicity/Cultural Background: ${params.ethnicity}\n`;
    }

    if (params.preferences && params.preferences.length > 0) {
      prompt += `Preferences: ${params.preferences.join(', ')}\n`;
    }

    if (params.budget) {
      prompt += `Budget: $${params.budget.min || 0} - $${params.budget.max || 'unlimited'}\n`;
    }

    prompt += `\nNeighborhood Data:\n`;

    if (qlooData.recommendations && qlooData.recommendations.length > 0) {
      prompt += `Recommended Areas Based on Demographics:\n`;
      qlooData.recommendations.slice(0, 10).forEach((place: any, index: number) => {
        prompt += `${index + 1}. ${place.name}`;
        if (place.metadata?.description) {
          prompt += ` - ${place.metadata.description}`;
        }
        if (place.affinity) {
          prompt += ` (Affinity Score: ${(place.affinity * 100).toFixed(0)}%)`;
        }
        prompt += '\n';
      });
    }

    if (qlooData.searchResults && qlooData.searchResults.length > 0) {
      prompt += `\nAdditional Neighborhood Options:\n`;
      qlooData.searchResults.slice(0, 5).forEach((place: any, index: number) => {
        prompt += `${index + 1}. ${place.name}`;
        if (place.metadata?.neighborhood_features) {
          prompt += ` - Features: ${place.metadata.neighborhood_features}`;
        }
        prompt += '\n';
      });
    }

    // Add note about user preferences that should guide recommendations
    if (qlooData.preferences && qlooData.preferences.length > 0) {
      prompt += `\nUser specifically mentioned preferences for: ${qlooData.preferences.join(', ')}\n`;
    }

    prompt += `\nInstructions:
1. Provide a warm, conversational response that directly addresses their housing query
2. If they asked where you're from, politely redirect to helping them find housing
3. Recommend 3-4 specific neighborhoods or areas with brief explanations
4. Consider their demographics (age, ethnicity) to suggest culturally relevant areas
5. Mention practical factors like commute, amenities, and community features
6. Be helpful and encouraging about their housing search
7. If data is limited, acknowledge this and provide general advice
8. Keep the response concise but informative (3-4 paragraphs)

Response:`;

    return prompt;
  }

  /**
   * Generate fallback response when Gemini is not available
   */
  private async generateFallbackResponse(
    userQuery: string,
    params: HousingQueryParams
  ): Promise<string> {
    let response = "I'd be happy to help you find housing information";

    if (params.location) {
      response += ` in ${params.location}`;
    }

    response += ". While I'm having trouble accessing specific neighborhood data at the moment, ";

    if (params.preferences && params.preferences.length > 0) {
      response += `based on your preferences for ${params.preferences.join(', ')} areas, `;
    }

    response += "I recommend researching neighborhoods that match your lifestyle needs. Consider factors like commute time, local amenities, ";

    if (params.ethnicity) {
      response += "cultural communities, ";
    }

    response += "and housing costs. Would you like me to help you with any specific questions about finding housing?";

    return response;
  }

  /**
   * Convert age range to Qloo age group
   */
  private convertToAgeGroup(ageRange?: string): AgeGroup | undefined {
    if (!ageRange) return undefined;

    // Handle specific age ranges that Qloo expects
    if (ageRange === '25-29' || ageRange === '25') return '25_to_29' as any;
    
    const age = parseInt(ageRange.split('-')[0]);
    
    if (age <= 24) return '24_and_younger' as any;
    if (age >= 25 && age <= 29) return '25_to_29' as any;
    if (age >= 30 && age <= 34) return '30_to_34' as any;
    if (age >= 35 && age <= 44) return '35_to_44' as any;
    if (age >= 45 && age <= 54) return '45_to_54' as any;
    if (age >= 55) return '55_and_older' as any;
    
    // Default to young adult if can't determine
    return '25_to_29' as any;
  }

  /**
   * Extract demographics from conversation
   */
  extractDemographics(message: string): { age?: string; ethnicity?: string } {
    const demographics: { age?: string; ethnicity?: string } = {};

    // Age extraction
    const ageMatch = message.match(/\b(\d{1,2})\s*(?:years?\s*old|yo)\b/i);
    if (ageMatch) {
      demographics.age = ageMatch[1];
    }

    // Ethnicity extraction (be respectful and inclusive)
    const ethnicityKeywords = {
      'asian': ['asian', 'chinese', 'japanese', 'korean', 'indian', 'filipino'],
      'hispanic': ['hispanic', 'latino', 'latina', 'latinx', 'mexican', 'spanish'],
      'black': ['black', 'african american', 'african'],
      'white': ['white', 'caucasian', 'european'],
      'middle eastern': ['middle eastern', 'arab', 'persian'],
      'pacific islander': ['pacific islander', 'hawaiian', 'polynesian'],
    };

    const lowerMessage = message.toLowerCase();
    for (const [ethnicity, keywords] of Object.entries(ethnicityKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        demographics.ethnicity = ethnicity;
        break;
      }
    }

    return demographics;
  }
}