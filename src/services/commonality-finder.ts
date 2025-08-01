import { createQlooService, QlooApiService, EntityCategory } from './qloo.js';
import { env } from '../env.js';
import { generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

interface Person {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
}

interface Employee {
  name: string;
  email: string;
  department: string;
  role: string;
  location: string;
  culturalHeritage?: string[];
  ageRange?: string;
  genderIdentity?: string;
}

interface CommonalityResult {
  personId: string;
  personName: string;
  commonalities: string[];
  qlooInsights: string;
  connectionScore: number;
}

export class CommonalityFinder {
  private qloo: QlooApiService;
  private openrouter;

  constructor() {
    this.qloo = createQlooService(env.QLOO_API_KEY);
    this.openrouter = createOpenRouter({
      apiKey: env.OPENROUTER_API_KEY,
    });
  }

  /**
   * Find commonalities between an employee and a list of people using Qloo
   */
  async findCommonalities(
    employee: Employee,
    people: Person[]
  ): Promise<CommonalityResult[]> {
    const results: CommonalityResult[] = [];

    // Process each person to find commonalities
    for (const person of people) {
      try {
        const commonalityResult = await this.findPersonCommonalities(employee, person);
        results.push(commonalityResult);
      } catch (error) {
        console.error(`Error finding commonalities for ${person.name}`);
        // Add a fallback result
        results.push({
          personId: person.id,
          personName: person.name,
          commonalities: ['Same company'],
          qlooInsights: 'Unable to fetch Qloo insights at this time',
          connectionScore: 0.1,
        });
      }
    }

    // Sort by connection score (highest first)
    return results.sort((a, b) => b.connectionScore - a.connectionScore);
  }

  /**
   * Find commonalities between employee and a specific person
   */
  private async findPersonCommonalities(
    employee: Employee,
    person: Person
  ): Promise<CommonalityResult> {
    // Find workplace commonalities
    const workplaceCommonalities = this.findWorkplaceCommonalities(employee, person);

    // Search for entities and tags related to each person
    const employeeData = await this.gatherPersonData(employee);
    const personData = await this.gatherPersonData(person);

    // Use Qloo APIs to find taste-based commonalities
    const qlooCommonalities = await this.findQlooCommonalities(
      employeeData,
      personData,
      employee,
      person
    );

    // Generate a natural language summary
    const qlooInsights = await this.generateQlooInsights(
      employee,
      person,
      qlooCommonalities,
      workplaceCommonalities
    );

    // Calculate connection score
    const connectionScore = this.calculateConnectionScore(
      qlooCommonalities,
      workplaceCommonalities
    );

    return {
      personId: person.id,
      personName: person.name,
      commonalities: [...workplaceCommonalities, ...qlooCommonalities.commonInterests],
      qlooInsights,
      connectionScore,
    };
  }

  /**
   * Gather entity and tag data for a person
   */
  private async gatherPersonData(person: Employee | Person): Promise<{
    entities: any[];
    tags: any[];
  }> {
    const entities: any[] = [];
    const tags: any[] = [];

    // Search for entities based on person's attributes
    const searchQueries = [
      person.name,
      person.role,
      person.department,
    ];

    if ('location' in person && person.location) {
      searchQueries.push(person.location);
    }

    if ('culturalHeritage' in person && person.culturalHeritage) {
      searchQueries.push(...person.culturalHeritage);
    }

    // Search for entities
    for (const query of searchQueries.slice(0, 3)) {
      try {
        const searchResponse = await this.qloo.search({
          query,
          limit: 5,
        });
        if (searchResponse.results) {
          entities.push(...searchResponse.results);
        }
      } catch (error) {
        // Error already logged in Qloo service
      }
    }

    // Search for relevant tags
    try {
      const interests = this.extractInterestKeywords(person);
      for (const interest of interests.slice(0, 3)) {
        const tagResponse = await this.qloo.searchTags({
          query: interest,
          take: 5,
        });
        if (tagResponse.results) {
          tags.push(...tagResponse.results);
        }
      }
    } catch (error) {
      // Error already logged in Qloo service
    }

    return { entities, tags };
  }

  /**
   * Extract interest keywords from person's profile
   */
  private extractInterestKeywords(person: Employee | Person): string[] {
    const keywords: string[] = [];

    // Extract from role
    if (person.role) {
      const roleWords = person.role.toLowerCase().split(' ');
      keywords.push(...roleWords);
    }

    // Extract from department
    if (person.department) {
      keywords.push(person.department.toLowerCase());
    }

    // Extract from cultural heritage if available
    if ('culturalHeritage' in person && person.culturalHeritage) {
      for (const heritage of person.culturalHeritage) {
        keywords.push(heritage.toLowerCase());
        // Add related cultural keywords
        if (heritage.includes('Asian')) {
          keywords.push('asian', 'cuisine', 'culture');
        }
        if (heritage.includes('Indigenous')) {
          keywords.push('indigenous', 'native', 'culture');
        }
      }
    }

    // Add location-based keywords
    if ('location' in person && person.location) {
      const locationParts = person.location.split(',')[0].toLowerCase();
      keywords.push(locationParts);
    }

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Use Qloo APIs to find taste-based commonalities
   */
  private async findQlooCommonalities(
    employeeData: { entities: any[]; tags: any[] },
    personData: { entities: any[]; tags: any[] },
    employee: Employee,
    person: Person
  ): Promise<{ commonInterests: string[]; affinityData: any[] }> {
    const commonInterests: string[] = [];
    const affinityData: any[] = [];

    try {
      // 1. Use Analysis Compare API if we have entities for both
      if (employeeData.entities.length > 0 && personData.entities.length > 0) {
        const employeeEntityIds = employeeData.entities
          .slice(0, 5)
          .map(e => e.id)
          .filter(id => id !== undefined && id !== null);
        const personEntityIds = personData.entities
          .slice(0, 5)
          .map(e => e.id)
          .filter(id => id !== undefined && id !== null);

        // Only call compare API if we have valid entity IDs for both
        if (employeeEntityIds.length > 0 && personEntityIds.length > 0) {
          try {
            const compareResult = await this.qloo.compareAnalysis({
              groupA: { entities: employeeEntityIds },
              groupB: { entities: personEntityIds },
            });

            if (compareResult.results && compareResult.results.length > 0) {
              // Extract common interests from comparison
              const topResults = compareResult.results.slice(0, 3);
              for (const result of topResults) {
                commonInterests.push(`Both might enjoy: ${result.name}`);
                affinityData.push(result);
              }
            }
          } catch (error) {
            console.error('Error in analysis compare');
          }
        }
      }

      // 2. Use Insights API with demographic and interest signals
      const validEntityIds = [
        ...employeeData.entities.slice(0, 3).map(e => e.id), 
        ...personData.entities.slice(0, 2).map(e => e.id)
      ].filter(id => id !== undefined && id !== null);

      const validTagIds = [
        ...employeeData.tags.slice(0, 3).map(t => t.id),
        ...personData.tags.slice(0, 2).map(t => t.id)
      ].filter(id => id !== undefined && id !== null);

      // Only make insights call if we have either valid entities or tags
      if (validEntityIds.length > 0 || validTagIds.length > 0) {
        const insightsParams: any = {
          filterType: 'urn:entity:brand', // Start with brands
          signal: {},
          feature: {
            explainability: true,
          },
          take: 10,
        };

        // Only add interests if we have valid IDs
        if (validEntityIds.length > 0 || validTagIds.length > 0) {
          insightsParams.signal.interests = {};
          if (validEntityIds.length > 0) {
            insightsParams.signal.interests.entities = validEntityIds;
          }
          if (validTagIds.length > 0) {
            insightsParams.signal.interests.tags = validTagIds;
          }
        }

        // Add demographic signals if available
        if (employee.ageRange) {
          insightsParams.signal.demographics = {
            age: this.mapAgeRange(employee.ageRange),
          };
        }
        if (employee.genderIdentity) {
          insightsParams.signal.demographics = {
            ...insightsParams.signal.demographics,
            gender: this.mapGenderToQloo(employee.genderIdentity),
          };
        }

        // Add location signal
        if (employee.location) {
          insightsParams.signal.location = employee.location;
        }

        const insightsResponse = await this.qloo.getInsights(insightsParams);
        
        if (insightsResponse.results && insightsResponse.results.length > 0) {
          const topInsights = insightsResponse.results.slice(0, 3);
          for (const insight of topInsights) {
            if (insight.affinity && insight.affinity > 0.5) {
              commonInterests.push(`Shared affinity for: ${insight.name}`);
              affinityData.push(insight);
            }
          }
        }
      }

      // 3. Find common categories from entities
      const employeeCategories = new Set(employeeData.entities.map(e => e.category));
      const personCategories = new Set(personData.entities.map(e => e.category));
      
      employeeCategories.forEach(cat => {
        if (personCategories.has(cat)) {
          commonInterests.push(`Shared interest in: ${cat}`);
        }
      });

      // 4. Find common tags
      const employeeTagNames = new Set(employeeData.tags.map(t => t.name));
      const personTagNames = new Set(personData.tags.map(t => t.name));
      
      employeeTagNames.forEach(tag => {
        if (personTagNames.has(tag)) {
          commonInterests.push(`Both associated with: ${tag}`);
        }
      });

    } catch (error) {
      console.error('Error finding Qloo commonalities');
    }

    return { 
      commonInterests: [...new Set(commonInterests)], // Remove duplicates
      affinityData 
    };
  }

  /**
   * Map age range to Qloo format
   */
  private mapAgeRange(ageRange: string): string {
    const ageMap: { [key: string]: string } = {
      '20-24': '18_to_24',
      '25-29': '25_to_35',
      '30-34': '25_to_35',
      '35-39': '36_to_55',
      '40-44': '36_to_55',
      '45-49': '36_to_55',
      '50-54': '36_to_55',
      '55+': '56_plus',
    };
    return ageMap[ageRange] || '25_to_35';
  }

  /**
   * Map gender identity to Qloo format (male/female only)
   */
  private mapGenderToQloo(genderIdentity: string): 'male' | 'female' {
    const lowerGender = genderIdentity.toLowerCase();
    
    // Direct mappings
    if (lowerGender === 'male' || lowerGender === 'man') return 'male';
    if (lowerGender === 'female' || lowerGender === 'woman') return 'female';
    
    // Other mappings
    if (lowerGender.includes('man') || lowerGender.includes('male')) return 'male';
    if (lowerGender.includes('woman') || lowerGender.includes('female')) return 'female';
    
    // Default to female for any other gender identity
    return 'female';
  }

  /**
   * Find workplace commonalities
   */
  private findWorkplaceCommonalities(employee: Employee, person: Person): string[] {
    const commonalities: string[] = [];

    // Same department
    if (employee.department === person.department) {
      commonalities.push(`Both work in ${employee.department}`);
    }

    // Similar roles
    if (this.areSimilarRoles(employee.role, person.role)) {
      commonalities.push('Similar leadership roles');
    }

    // Location-based (if person has location info)
    if (employee.location && employee.location.includes('London')) {
      commonalities.push('Both based in or work with London office');
    }

    return commonalities;
  }

  /**
   * Check if roles are similar
   */
  private areSimilarRoles(role1: string, role2: string): boolean {
    const leadershipKeywords = ['vp', 'director', 'head', 'chief', 'manager', 'lead'];
    
    const role1Lower = role1.toLowerCase();
    const role2Lower = role2.toLowerCase();

    const role1IsLeadership = leadershipKeywords.some(kw => role1Lower.includes(kw));
    const role2IsLeadership = leadershipKeywords.some(kw => role2Lower.includes(kw));

    return role1IsLeadership && role2IsLeadership;
  }

  /**
   * Generate natural language insights using LLM
   */
  private async generateQlooInsights(
    employee: Employee,
    person: Person,
    qlooCommonalities: { commonInterests: string[]; affinityData: any[] },
    workplaceCommonalities: string[]
  ): Promise<string> {
    const prompt = `Based on the following information, create a brief, natural insight about what ${employee.name} and ${person.name} might have in common or could connect over:

Employee: ${employee.name}
- Role: ${employee.role}
- Department: ${employee.department}
- Location: ${employee.location}
${employee.culturalHeritage ? `- Cultural Heritage: ${employee.culturalHeritage.join(', ')}` : ''}

Colleague: ${person.name}
- Role: ${person.role}
- Department: ${person.department}

Workplace commonalities: ${workplaceCommonalities.join('; ')}
Taste/Interest commonalities: ${qlooCommonalities.commonInterests.join('; ')}
${qlooCommonalities.affinityData.length > 0 ? `Affinity insights: ${qlooCommonalities.affinityData.slice(0, 2).map(a => `${a.name} (affinity: ${a.affinity || 'high'})`).join(', ')}` : ''}

Write a single sentence that highlights the most interesting connection point between these two people. Focus on shared interests, cultural connections, or professional synergies. Be specific and actionable.`;

    try {
      const { text } = await generateText({
        model: this.openrouter('meta-llama/llama-3.1-8b-instruct'),
        prompt,
        temperature: 0.7,
        maxOutputTokens: 100,
      });

      return text.trim();
    } catch (error) {
      console.error('Error generating insights:', error);
      return `${employee.name} and ${person.name} could connect over their ${workplaceCommonalities[0] || 'work at the company'}.`;
    }
  }

  /**
   * Calculate a connection score based on commonalities
   */
  private calculateConnectionScore(
    qlooCommonalities: { commonInterests: string[]; affinityData: any[] },
    workplaceCommonalities: string[]
  ): number {
    let score = 0;

    // Workplace commonalities
    score += workplaceCommonalities.length * 0.2;

    // Qloo commonalities
    score += qlooCommonalities.commonInterests.length * 0.3;

    // Affinity data
    score += Math.min(qlooCommonalities.affinityData.length * 0.1, 0.3);

    // Boost score if we have high affinity matches
    const highAffinityCount = qlooCommonalities.affinityData.filter(a => a.affinity > 0.7).length;
    score += highAffinityCount * 0.1;

    // Normalize to 0-1 range
    return Math.min(score, 1);
  }
}