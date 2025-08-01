import { generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createQlooService, QlooApiService, QlooEntity, EntityCategory } from './qloo.js';
import { env } from '../env.js';

interface RecommendationContext {
  userQuery: string;
  category?: EntityCategory;
  preferences?: string[];
  region?: string;
  demographics?: {
    age?: number;
    gender?: 'male' | 'female' | 'other';
    location?: string;
  };
}

interface EnhancedRecommendation {
  entity: QlooEntity;
  reason: string;
  relevanceScore: number;
}

export class RecommendationEngine {
  private qloo: QlooApiService;
  private openrouter;

  constructor(qlooApiKey: string) {
    this.qloo = createQlooService(qlooApiKey);
    this.openrouter = createOpenRouter({
      apiKey: env.OPENROUTER_API_KEY,
    });
  }

  /**
   * Main method to get personalized recommendations with LLM-crafted responses
   */
  async getPersonalizedRecommendations(context: RecommendationContext): Promise<string> {
    try {
      // Step 1: Search for entities based on user query
      const searchResults = await this.searchEntities(context);
      
      if (!searchResults || searchResults.length === 0) {
        return await this.generateFallbackResponse(context.userQuery);
      }

      // Step 2: Get recommendations based on search results
      const recommendations = await this.getRecommendations(searchResults, context);

      // Step 3: Get additional insights if available
      const insights = await this.getInsights(recommendations.slice(0, 3));

      // Step 4: Craft personalized response using LLM
      const response = await this.craftPersonalizedResponse(
        context,
        searchResults,
        recommendations,
        insights
      );

      return response;
    } catch (error) {
      console.error('Error in recommendation engine:', error);
      return await this.generateErrorResponse(context.userQuery);
    }
  }

  /**
   * Search for entities based on user query and context
   */
  private async searchEntities(context: RecommendationContext): Promise<QlooEntity[]> {
    try {
      const searchResponse = await this.qloo.search({
        query: context.userQuery,
        types: context.category ? [context.category] : undefined,
        filter: {
          location: context.region,
        },
        limit: 10,
      });

      return searchResponse.results;
    } catch (error) {
      console.error('Error searching entities:', error);
      return [];
    }
  }

  /**
   * Get recommendations based on seed entities using insights API
   */
  private async getRecommendations(
    seedEntities: QlooEntity[],
    context: RecommendationContext
  ): Promise<QlooEntity[]> {
    try {
      const entityIds = seedEntities.slice(0, 3).map(e => e.id);
      
      const insightsResponse = await this.qloo.getInsights({
        filterType: context.category ? `urn:entity:${context.category}` : 'urn:entity:brand',
        signal: {
          interests: {
            entities: entityIds,
          },
          demographics: context.demographics ? {
            age: context.demographics.age ? this.mapAge(context.demographics.age) : undefined,
            gender: context.demographics.gender === 'other' ? undefined : context.demographics.gender,
          } : undefined,
          location: context.region,
        },
        feature: {
          explainability: true,
        },
        take: 10,
      });

      return insightsResponse.results || [];
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }

  private mapAge(age: number): string {
    if (age < 25) return '18_to_24';
    if (age < 36) return '25_to_35';
    if (age < 56) return '36_to_55';
    return '56_plus';
  }

  /**
   * Analyze entities to get insights
   */
  private async getInsights(entities: QlooEntity[]): Promise<any> {
    try {
      if (entities.length === 0) return null;

      const entityIds = entities.map(e => e.id);
      
      const analysis = await this.qloo.analyzeEntities(entityIds);

      return analysis;
    } catch (error) {
      console.error('Error getting insights:', error);
      return null;
    }
  }

  /**
   * Craft personalized response using LLM with Qloo data
   */
  private async craftPersonalizedResponse(
    context: RecommendationContext,
    searchResults: QlooEntity[],
    recommendations: QlooEntity[],
    insights: any
  ): Promise<string> {
    const prompt = this.buildPrompt(context, searchResults, recommendations, insights);

    try {
      const { text } = await generateText({
        model: this.openrouter('meta-llama/llama-3.1-8b-instruct'),
        prompt,
        temperature: 0.7,
        maxOutputTokens: 500,
      });

      return text;
    } catch (error) {
      console.error('Error generating LLM response:', error);
      return this.generateFallbackResponse(context.userQuery);
    }
  }

  /**
   * Build prompt for LLM with Qloo data
   */
  private buildPrompt(
    context: RecommendationContext,
    searchResults: QlooEntity[],
    recommendations: QlooEntity[],
    insights: any
  ): string {
    let prompt = `You are a knowledgeable recommendation assistant. Based on the user's query and the following data from our recommendation engine, provide a helpful and personalized response.

User Query: "${context.userQuery}"
`;

    if (context.preferences && context.preferences.length > 0) {
      prompt += `User Preferences: ${context.preferences.join(', ')}\n`;
    }

    if (context.region) {
      prompt += `Region: ${context.region}\n`;
    }

    prompt += `\nSearch Results (entities matching the query):\n`;
    searchResults.slice(0, 5).forEach((entity, index) => {
      prompt += `${index + 1}. ${entity.name} (${entity.category})`;
      if (entity.popularity) {
        prompt += ` - Popularity: ${entity.popularity.toFixed(2)}`;
      }
      prompt += '\n';
    });

    prompt += `\nPersonalized Recommendations:\n`;
    recommendations.slice(0, 5).forEach((entity, index) => {
      prompt += `${index + 1}. ${entity.name} (${entity.category})`;
      if (entity.metadata?.description) {
        prompt += ` - ${entity.metadata.description}`;
      }
      prompt += '\n';
    });

    if (insights && insights.insights) {
      prompt += `\nKey Insights:\n`;
      insights.insights.forEach((insight: any) => {
        prompt += `- ${insight.metric}: ${insight.value}`;
        if (insight.trend) {
          prompt += ` (trend: ${insight.trend})`;
        }
        prompt += '\n';
      });
    }

    prompt += `\nInstructions:
1. Provide a conversational response that directly addresses the user's query
2. Naturally incorporate 2-3 specific recommendations with brief explanations
3. If relevant, mention any interesting trends or insights
4. Keep the response concise but informative (2-3 paragraphs)
5. Be enthusiastic but not overly promotional
6. If the data seems limited or not perfectly matching, acknowledge this naturally

Response:`;

    return prompt;
  }

  /**
   * Generate fallback response when no data is available
   */
  private async generateFallbackResponse(userQuery: string): Promise<string> {
    const { text } = await generateText({
      model: this.openrouter('meta-llama/llama-3.1-8b-instruct'),
      prompt: `The user asked: "${userQuery}". We couldn't find specific recommendations in our database. Please provide a helpful response acknowledging this limitation while still being helpful and suggesting they might try rephrasing their query or asking about a different topic.`,
      temperature: 0.7,
      maxOutputTokens: 200,
    });

    return text;
  }

  /**
   * Generate error response
   */
  private async generateErrorResponse(userQuery: string): Promise<string> {
    return "I apologize, but I'm having trouble accessing recommendation data at the moment. Please try again later or rephrase your query.";
  }

  /**
   * Get similar recommendations using insights API
   */
  async getSimilarRecommendations(entityId: string, category?: EntityCategory): Promise<string> {
    try {
      // Use insights API with the entity as a signal
      const insightsResponse = await this.qloo.getInsights({
        filterType: category ? `urn:entity:${category}` : 'urn:entity:brand',
        signal: {
          interests: {
            entities: [entityId],
          },
        },
        take: 10,
      });
      
      const similarEntities = insightsResponse.results || [];
      
      if (!similarEntities || similarEntities.length === 0) {
        return "I couldn't find similar recommendations at this time.";
      }

      const prompt = `Based on the following similar items, craft a natural response suggesting these alternatives:
${similarEntities.map((e: any, i: number) => `${i + 1}. ${e.name} (${e.category || 'recommendation'})`).join('\n')}

Provide a brief, conversational response mentioning 2-3 of these suggestions:`;

      const { text } = await generateText({
        model: this.openrouter('meta-llama/llama-3.1-8b-instruct'),
        prompt,
        temperature: 0.7,
        maxOutputTokens: 200,
      });

      return text;
    } catch (error) {
      console.error('Error getting similar recommendations:', error);
      return "I'm having trouble finding similar recommendations right now. Please try again later.";
    }
  }
}