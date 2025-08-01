import { RecommendationEngine } from './recommendation-engine.js';
import { EntityCategory } from './qloo.js';
import { env } from '../env.js';

// Example usage of the Qloo recommendation engine

async function demonstrateRecommendationEngine() {
  // Initialize the recommendation engine
  const recommendationEngine = new RecommendationEngine(env.QLOO_API_KEY);

  // Example 1: Basic recommendation query
  console.log('Example 1: Basic music recommendation');
  const basicResponse = await recommendationEngine.getPersonalizedRecommendations({
    userQuery: 'I love Taylor Swift and want to discover similar artists',
    category: 'music',
  });
  console.log(basicResponse);
  console.log('\n---\n');

  // Example 2: Restaurant recommendations with location
  console.log('Example 2: Restaurant recommendations with location');
  const restaurantResponse = await recommendationEngine.getPersonalizedRecommendations({
    userQuery: 'Best Italian restaurants for a date night',
    category: 'dining',
    region: 'NYC',
    preferences: ['romantic', 'upscale', 'authentic'],
  });
  console.log(restaurantResponse);
  console.log('\n---\n');

  // Example 3: Movie recommendations with demographics
  console.log('Example 3: Movie recommendations with demographics');
  const movieResponse = await recommendationEngine.getPersonalizedRecommendations({
    userQuery: 'Action movies like John Wick',
    category: 'film',
    demographics: {
      age: 25,
      gender: 'male',
    },
  });
  console.log(movieResponse);
  console.log('\n---\n');

  // Example 4: Get similar items
  console.log('Example 4: Similar items (assuming you have an entity ID)');
  // You would get this entity ID from a previous search or recommendation
  const similarResponse = await recommendationEngine.getSimilarRecommendations(
    'example-entity-id', // Replace with actual entity ID
    'music'
  );
  console.log(similarResponse);
}

// Integration example for Slack bot
export async function handleSlackRecommendationQuery(userMessage: string): Promise<string> {
  const recommendationEngine = new RecommendationEngine(env.QLOO_API_KEY);

  // Parse the message to determine category and extract preferences
  const category = detectCategory(userMessage);
  const region = detectRegion(userMessage);

  // Get personalized recommendations
  const response = await recommendationEngine.getPersonalizedRecommendations({
    userQuery: userMessage,
    category,
    region,
  });

  return response;
}

// Helper function to detect category from user message
function detectCategory(message: string): EntityCategory | undefined {
  const lowerMessage = message.toLowerCase();
  
  const categoryKeywords: Record<EntityCategory, string[]> = {
    music: ['music', 'song', 'artist', 'band', 'album', 'concert', 'spotify'],
    film: ['movie', 'film', 'cinema', 'watch', 'netflix'],
    television: ['tv', 'show', 'series', 'episode', 'streaming'],
    dining: ['restaurant', 'food', 'eat', 'dinner', 'lunch', 'cuisine', 'meal'],
    nightlife: ['bar', 'club', 'nightlife', 'drinks', 'party'],
    fashion: ['fashion', 'clothing', 'style', 'wear', 'outfit', 'brand'],
    books: ['book', 'read', 'author', 'novel', 'literature'],
    travel: ['travel', 'vacation', 'trip', 'visit', 'destination', 'hotel'],
    brands: ['brand', 'product', 'company'],
    podcasts: ['podcast', 'listen', 'episode'],
    people: ['celebrity', 'influencer', 'person', 'who'],
    artist: ['artist', 'singer', 'musician', 'performer', 'band'],
    movie: ['movie', 'film', 'cinema', 'motion picture'],
    place: ['place', 'location', 'venue', 'spot', 'area'],
    brand: ['brand', 'label', 'trademark', 'company name'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return category as EntityCategory;
    }
  }

  return undefined;
}

// Helper function to detect region from user message
function detectRegion(message: string): string | undefined {
  const regionPatterns = [
    { pattern: /\b(NYC|New York|Manhattan)\b/i, region: 'NYC' },
    { pattern: /\b(LA|Los Angeles|Hollywood)\b/i, region: 'LA' },
    { pattern: /\b(SF|San Francisco|Bay Area)\b/i, region: 'SF' },
    { pattern: /\b(Chicago)\b/i, region: 'CHI' },
    { pattern: /\b(Miami)\b/i, region: 'MIA' },
    { pattern: /\b(Boston)\b/i, region: 'BOS' },
    { pattern: /\b(Seattle)\b/i, region: 'SEA' },
    { pattern: /\b(Austin)\b/i, region: 'AUS' },
  ];

  for (const { pattern, region } of regionPatterns) {
    if (pattern.test(message)) {
      return region;
    }
  }

  return undefined;
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateRecommendationEngine().catch(console.error);
}