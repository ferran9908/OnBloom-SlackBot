import axios from 'axios';
import { env } from '../env.js';

export interface EmployeeCulturalProfile {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  department: string;
  role: string;
  startDate: string;
  location: string;
  timeZone: string;
  ageRange: string;
  genderIdentity: string;
  culturalHeritage: string[];
  tags?: string[];
}

class NotionService {
  private headers: Record<string, string>;

  constructor() {
    this.headers = {
      'Authorization': `Bearer ${env.NOTION_API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    };
  }

  private getPropertyValue(properties: any, propertyName: string): any {
    const property = properties[propertyName];
    if (!property) return null;

    switch (property.type) {
      case 'title':
        return property.title?.[0]?.plain_text || '';
      case 'rich_text':
        return property.rich_text?.[0]?.plain_text || '';
      case 'email':
        return property.email || '';
      case 'select':
        return property.select?.name || '';
      case 'multi_select':
        return property.multi_select?.map((item: any) => item.name) || [];
      case 'date':
        return property.date?.start || '';
      case 'number':
        return property.number || 0;
      case 'checkbox':
        return property.checkbox || false;
      case 'url':
        return property.url || '';
      default:
        return null;
    }
  }

  private notionPageToEmployee(page: any): EmployeeCulturalProfile {
    const { properties } = page;
    
    return {
      id: page.id,
      name: this.getPropertyValue(properties, 'Name'),
      email: this.getPropertyValue(properties, 'Email'),
      employeeId: this.getPropertyValue(properties, 'Employee ID'),
      department: this.getPropertyValue(properties, 'Department'),
      role: this.getPropertyValue(properties, 'Role'),
      startDate: this.getPropertyValue(properties, 'Start Date'),
      location: this.getPropertyValue(properties, 'Location'),
      timeZone: this.getPropertyValue(properties, 'Time Zone'),
      ageRange: this.getPropertyValue(properties, 'Age Range'),
      genderIdentity: this.getPropertyValue(properties, 'Gender Identity'),
      culturalHeritage: this.getPropertyValue(properties, 'Cultural Heritage'),
      tags: this.getPropertyValue(properties, 'Tags'),
    };
  }

  async searchEmployees(query: string): Promise<EmployeeCulturalProfile[]> {
    try {
      const databaseId = env.NOTION_DATABASE_ID;
      
      const response = await axios.post(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        {
          filter: {
            or: [
              {
                property: 'Name',
                title: {
                  contains: query,
                },
              },
              {
                property: 'Email',
                email: {
                  contains: query,
                },
              },
            ],
          },
        },
        { headers: this.headers }
      );

      return response.data.results.map((page: any) => this.notionPageToEmployee(page));
    } catch (error) {
      console.error('Error searching employees:', error);
      throw new Error(`Failed to search employees: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getEmployeeByEmail(email: string): Promise<EmployeeCulturalProfile | null> {
    try {
      const results = await this.searchEmployees(email);
      return results.find(emp => emp.email === email) || null;
    } catch (error) {
      console.error(`Error fetching employee by email ${email}:`, error);
      return null;
    }
  }

  async getEmployeeByName(name: string): Promise<EmployeeCulturalProfile | null> {
    try {
      const results = await this.searchEmployees(name);
      return results.find(emp => emp.name.toLowerCase() === name.toLowerCase()) || null;
    } catch (error) {
      console.error(`Error fetching employee by name ${name}:`, error);
      return null;
    }
  }

  async getEmployeesByEmails(emails: string[]): Promise<EmployeeCulturalProfile[]> {
    const employees: EmployeeCulturalProfile[] = [];
    
    // Batch process emails to avoid too many API calls
    for (const email of emails) {
      try {
        const employee = await this.getEmployeeByEmail(email);
        if (employee) {
          employees.push(employee);
        }
      } catch (error) {
        console.error(`Error fetching employee with email ${email}:`, error);
      }
    }

    return employees;
  }
}

export const notionService = new NotionService();