import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Base configuration
export interface QlooConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

// Entity types based on Qloo's knowledge graph
export type EntityCategory =
  | 'music'
  | 'film'
  | 'television'
  | 'dining'
  | 'nightlife'
  | 'fashion'
  | 'books'
  | 'travel'
  | 'brands'
  | 'podcasts'
  | 'people';

// Base entity interface
export interface QlooEntity {
  id: string;
  name: string;
  category: EntityCategory;
  metadata?: Record<string, any>;
  popularity?: number;
  geo?: {
    lat: number;
    lng: number;
    region?: string;
  };
}

// Search parameters
export interface SearchParams {
  query: string;
  types?: string[];
  limit?: number;
  page?: number;
  filter?: {
    location?: string;
    radius?: number;
    tags?: string[];
    rating?: number;
    popularity?: number;
  };
  sort_by?: 'match' | 'distance' | 'popularity';
}

// Search response
export interface SearchResponse {
  results: QlooEntity[];
  pagination?: {
    page: number;
    total: number;
    hasMore: boolean;
  };
}

// Insights parameters
export interface InsightsParams {
  filterType: string; // e.g., 'urn:entity:artist'
  signal?: {
    demographics?: {
      age?: string; // e.g., '36_to_55'
      gender?: 'male' | 'female';
      audiences?: string[];
    };
    interests?: {
      entities?: string[];
      tags?: string[];
    };
    location?: string;
  };
  filter?: {
    address?: string;
    geocode?: {
      name?: string;
      country_code?: string;
    };
    tags?: string[];
  };
  feature?: {
    explainability?: boolean;
  };
  bias?: {
    trends?: 'off' | 'low' | 'medium' | 'high';
  };
  page?: number;
  take?: number;
}

// Insights response
export interface InsightsResponse {
  results: Array<QlooEntity & {
    affinity?: number;
    explainability?: {
      signals?: Array<{
        type: string;
        value: string;
        weight: number;
      }>;
    };
  }>;
}

// Analysis Compare parameters
export interface AnalysisCompareParams {
  groupA: {
    entities: string[];
  };
  groupB: {
    entities: string[];
  };
  filterType?: string[];
  page?: number;
  take?: number;
}

// Tags search parameters
export interface TagsSearchParams {
  query?: string;
  types?: string[];
  popularity?: {
    min?: number;
    max?: number;
  };
  page?: number;
  take?: number;
}

// Tag interface
export interface QlooTag {
  id: string;
  name: string;
  type: string;
  popularity?: number;
}


// Error interface
export interface QlooError {
  code: string;
  message: string;
  details?: any;
}

// Main Qloo API Service Class
export class QlooApiService {
  private client: AxiosInstance;
  private config: QlooConfig;

  constructor(config: QlooConfig) {
    this.config = {
      baseUrl: 'https://hackathon.api.qloo.com',
      timeout: 30000,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.config.apiKey,
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        throw this.handleError(error);
      }
    );
  }

  /**
   * Search for entities in Qloo's knowledge graph
   */
  async search(params: SearchParams): Promise<SearchResponse> {
    try {
      const queryParams: any = {
        query: params.query,
      };

      if (params.types) {
        queryParams.types = params.types;
      }
      if (params.limit) {
        queryParams.take = params.limit;
      }
      if (params.page) {
        queryParams.page = params.page;
      }
      if (params.filter?.location) {
        queryParams['filter.location'] = params.filter.location;
      }
      if (params.filter?.radius) {
        queryParams['filter.radius'] = params.filter.radius;
      }
      if (params.filter?.tags) {
        queryParams['filter.tags'] = params.filter.tags;
      }
      if (params.filter?.rating) {
        queryParams['filter.rating'] = params.filter.rating;
      }
      if (params.filter?.popularity) {
        queryParams['filter.popularity'] = params.filter.popularity;
      }
      if (params.sort_by) {
        queryParams.sort_by = params.sort_by;
      }

      const response: AxiosResponse = await this.client.get('/search', {
        params: queryParams,
      });

      return this.transformSearchResponse(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get insights based on various signals
   */
  async getInsights(params: InsightsParams): Promise<InsightsResponse> {
    try {
      const queryParams: any = {
        'filter.type': params.filterType,
      };

      // Add demographic signals
      if (params.signal?.demographics?.age) {
        queryParams['signal.demographics.age'] = params.signal.demographics.age;
      }
      if (params.signal?.demographics?.gender) {
        queryParams['signal.demographics.gender'] = params.signal.demographics.gender;
      }
      if (params.signal?.demographics?.audiences) {
        queryParams['signal.demographics.audiences'] = params.signal.demographics.audiences;
      }

      // Add interest signals
      if (params.signal?.interests?.entities) {
        queryParams['signal.interests.entities'] = params.signal.interests.entities;
      }
      if (params.signal?.interests?.tags) {
        queryParams['signal.interests.tags'] = params.signal.interests.tags;
      }

      // Add location signal
      if (params.signal?.location) {
        queryParams['signal.location'] = params.signal.location;
      }

      // Add filters
      if (params.filter?.address) {
        queryParams['filter.address'] = params.filter.address;
      }
      if (params.filter?.geocode?.name) {
        queryParams['filter.geocode.name'] = params.filter.geocode.name;
      }
      if (params.filter?.geocode?.country_code) {
        queryParams['filter.geocode.country_code'] = params.filter.geocode.country_code;
      }
      if (params.filter?.tags) {
        queryParams['filter.tags'] = params.filter.tags;
      }

      // Add features
      if (params.feature?.explainability) {
        queryParams['feature.explainability'] = params.feature.explainability;
      }

      // Add bias
      if (params.bias?.trends) {
        queryParams['bias.trends'] = params.bias.trends;
      }

      // Pagination
      if (params.page) {
        queryParams.page = params.page;
      }
      if (params.take) {
        queryParams.take = params.take;
      }

      const response: AxiosResponse = await this.client.get('/v2/insights', {
        params: queryParams,
      });

      return {
        results: response.data || [],
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Compare two groups of entities
   */
  async compareAnalysis(params: AnalysisCompareParams): Promise<InsightsResponse> {
    try {
      const queryParams: any = {
        'a.signal.interests.entities': params.groupA.entities,
        'b.signal.interests.entities': params.groupB.entities,
      };

      if (params.filterType) {
        queryParams['filter.type'] = params.filterType;
      }
      if (params.page) {
        queryParams.page = params.page;
      }
      if (params.take) {
        queryParams.take = params.take;
      }

      const response: AxiosResponse = await this.client.get('/v2/insights/compare', {
        params: queryParams,
      });

      return {
        results: response.data || [],
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Search for tags
   */
  async searchTags(params: TagsSearchParams): Promise<{ results: QlooTag[] }> {
    try {
      const queryParams: any = {};

      if (params.query) {
        queryParams['filter.query'] = params.query;
      }
      if (params.types) {
        queryParams['filter.tag.types'] = params.types;
      }
      if (params.popularity?.min) {
        queryParams['filter.popularity.min'] = params.popularity.min;
      }
      if (params.popularity?.max) {
        queryParams['filter.popularity.max'] = params.popularity.max;
      }
      if (params.page) {
        queryParams.page = params.page;
      }
      if (params.take) {
        queryParams.take = params.take;
      }

      const response: AxiosResponse = await this.client.get('/v2/tags', {
        params: queryParams,
      });

      return {
        results: response.data || [],
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Analyze a group of entities
   */
  async analyzeEntities(entityIds: string[]): Promise<any> {
    try {
      const response: AxiosResponse = await this.client.get('/analysis', {
        params: {
          entity_ids: entityIds,
        },
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }


  /**
   * Get entities by IDs
   */
  async getEntities(entityIds: string[]): Promise<QlooEntity[]> {
    try {
      const response: AxiosResponse = await this.client.get('/entities', {
        params: {
          entity_ids: entityIds,
        },
      });

      return response.data || [];
    } catch (error) {
      throw this.handleError(error);
    }
  }


  // Private helper methods
  private transformSearchResponse(data: any): SearchResponse {
    return {
      results: data.results || data || [],
      pagination: data.pagination,
    };
  }

  private handleError(error: any): QlooError {
    if (error.response) {
      console.error(`Qloo API Error - Status: ${error.response.status}`);
      console.error(`Failed URL: ${error.config?.url}`);
      console.error(`Failed Method: ${error.config?.method?.toUpperCase()}`);
      console.error(`Failed Params:`, error.config?.params);
      console.error('Full error response:');
      console.dir(error.response.data, { depth: null });
      
      return {
        code: error.response.status.toString(),
        message: error.response.data?.message || error.message,
        details: error.response.data,
      };
    } else if (error.request) {
      console.error('Qloo API Network Error');
      console.error(`Failed URL: ${error.config?.url}`);
      console.dir(error.request, { depth: null });
      
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error occurred',
        details: error.request,
      };
    } else {
      console.error('Qloo API Unknown Error');
      console.error('Full error:');
      console.dir(error, { depth: null });
      
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message || 'An unknown error occurred',
        details: error,
      };
    }
  }
}

// Utility functions
export class QlooUtils {
  /**
   * Helper to create demographic filters
   */
  static createDemographics(age?: number, gender?: string, location?: string) {
    return {
      age,
      gender: gender as 'male' | 'female' | 'other',
      location,
    };
  }

  /**
   * Helper to validate entity IDs
   */
  static validateEntityIds(ids: string[]): boolean {
    return ids.every(id => typeof id === 'string' && id.length > 0);
  }

  /**
   * Helper to batch requests
   */
  static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// Factory function for easy instantiation
export function createQlooService(apiKey: string, options?: Partial<QlooConfig>): QlooApiService {
  return new QlooApiService({
    apiKey,
    ...options,
  });
}
