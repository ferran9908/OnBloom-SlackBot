import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { env } from '../env.js';
import { CommonalityFinder } from '../services/commonality-finder.js';
import { notionService } from '../services/notion.js';
import { app as slackApp } from '../slack/bot.js';
import { generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

interface Person {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  connectionType: string;
  relevanceToEmployee: string;
  reasoning?: string;
}

interface EnhancedPerson extends Person {
  qlooCommonalities: string[];
  qlooInsights: string;
  connectionScore: number;
}

// Helper function to generate personalized messages
async function generatePersonalizedMessage(
  employee: any,
  person: EnhancedPerson,
  qlooInsight: string
): Promise<string> {
  const openrouter = createOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
  });

  const prompt = `You're introducing ${employee.name} to ${person.name}. Write as if you're a colleague who knows both people well.

New employee: ${employee.name}, ${employee.role} in ${employee.department}, ${employee.location}
${employee.culturalHeritage ? `Cultural background: ${employee.culturalHeritage.join(', ')}` : ''}
Colleague: ${person.name}, ${person.role}

Connection insight: ${qlooInsight}
Commonalities: ${person.qlooCommonalities.join(', ')}

Write 2-3 sentences in this format: Start with something like "Hey [person name], wanted to introduce you to [employee name] who's joining..." Then mention specific personal interests they share (music, food, hobbies) along with any work synergies. Sound natural and conversational, like you're making a thoughtful introduction between two people who would genuinely click.

DO NOT include any preamble, quotes, or meta-text. Start the message directly.`;

  try {
    const { text } = await generateText({
      model: openrouter('meta-llama/llama-3.1-8b-instruct'),
      prompt,
      temperature: 0.8,
      maxOutputTokens: 200,
    });

    return text.trim();
  } catch (error) {
    console.error('Error generating personalized message:', error);
    return `Hey ${person.name}, wanted to introduce you to ${employee.name} who's joining as ${employee.role} in ${employee.department}. ${qlooInsight}`;
  }
}

export function createWebhookServer() {
  const app = express();

  // Enable CORS for all origins (you can restrict this later)
  app.use(cors({
    origin: 'http://localhost:3000', // Allow requests from your frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    console.log("HEALTH CHECK")
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Webhook endpoint for external integrations
  app.post('/introductions', async (req: Request, res: Response) => {
    try {
      console.log('Received introductions webhook');

      const { employee, people } = req.body;

      if (!employee || !people) {
        return res.status(400).json({ error: 'Missing employee or people data' });
      }

      console.log(`Finding commonalities for ${employee.name} with ${people.length} people`);

      // Initialize commonality finder
      const commonalityFinder = new CommonalityFinder();

      // Get additional employee data from Notion if available
      let enrichedEmployee = employee;
      try {
        const notionEmployee = await notionService.getEmployeeByEmail(employee.email);
        if (notionEmployee) {
          enrichedEmployee = {
            ...employee,
            culturalHeritage: notionEmployee.culturalHeritage || employee.culturalHeritage,
            ageRange: notionEmployee.ageRange || employee.ageRange,
            genderIdentity: notionEmployee.genderIdentity || employee.genderIdentity,
          };
        }
      } catch (error) {
        console.error('Error fetching employee from Notion:', error);
      }

      // Get additional data for each person from Notion
      const enrichedPeople = [];
      for (const person of people) {
        try {
          const notionPerson = await notionService.getEmployeeByEmail(person.email);
          if (notionPerson) {
            enrichedPeople.push({
              ...person,
              location: notionPerson.location,
              culturalHeritage: notionPerson.culturalHeritage,
              ageRange: notionPerson.ageRange,
              genderIdentity: notionPerson.genderIdentity,
            });
          } else {
            enrichedPeople.push(person);
          }
        } catch (error) {
          console.error(`Error fetching person ${person.name} from Notion:`, error);
          enrichedPeople.push(person);
        }
      }

      // Find commonalities using Qloo
      const commonalities = await commonalityFinder.findCommonalities(
        enrichedEmployee,
        enrichedPeople
      );

      // Enhance the response with Qloo insights
      const enhancedPeople: EnhancedPerson[] = people.map((person: Person) => {
        const commonality = commonalities.find(c => c.personId === person.id);
        return {
          ...person,
          qlooCommonalities: commonality?.commonalities || [],
          qlooInsights: commonality?.qlooInsights || '',
          connectionScore: commonality?.connectionScore || 0,
        };
      });

      // Sort people by connection score
      enhancedPeople.sort((a: EnhancedPerson, b: EnhancedPerson) => b.connectionScore - a.connectionScore);

      const response = {
        ...req.body,
        people: enhancedPeople,
        qlooEnhanced: true,
        enhancedAt: new Date().toISOString(),
      };

      console.log(`Found commonalities for ${employee.name}`);
      console.dir({ response }, { depth: null })

      // Send personalized messages to the top 3 people
      // Hardcoded Slack user IDs for DMs
      const slackUserIds = ['U08AXKYCG87', 'U08C10NAA0G', 'U08BQSPHAQH'];
      const defaultChannel = req.body.defaultChannel || '#founders'; // Fallback channel
      const top3People = enhancedPeople.slice(0, 3);

      // Try to send messages for each of the top 3 people
      const messageResults = [];

      for (let i = 0; i < top3People.length; i++) {
        const person = top3People[i];

        try {
          const personalizedMessage = await generatePersonalizedMessage(
            employee,
            person,
            person.qlooInsights
          );

          let messageSent = false;

          // Option 1: If we have a specific Slack user ID for this person
          if (slackUserIds[i]) {
            try {
              // Open a DM conversation with the user
              const conversation = await slackApp.client.conversations.open({
                users: slackUserIds[i]
              });

              if (conversation.channel?.id) {
                // Randomly select one of the hardcoded user IDs for the "Say Hi" button
                const randomUserId = slackUserIds[Math.floor(Math.random() * slackUserIds.length)];

                await slackApp.client.chat.postMessage({
                  channel: conversation.channel.id,
                  text: personalizedMessage,
                  blocks: [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: personalizedMessage
                      }
                    },
                    {
                      type: 'actions',
                      elements: [
                        {
                          type: 'button',
                          text: {
                            type: 'plain_text',
                            text: 'Say Hi',
                            emoji: true
                          },
                          url: `slack://user?team=${employee.teamId || 'T08B9B5BJDT'}&id=${randomUserId}`,
                          action_id: 'say_hi'
                        },
                        {
                          type: 'button',
                          text: {
                            type: 'plain_text',
                            text: 'Pick out a gift',
                            emoji: true
                          },
                          url: `https://www.uncommongoods.com/fun/by-recipient/gifts-for-coworkers?employee=${encodeURIComponent(employee.name)}&interests=${encodeURIComponent(person.qlooCommonalities.slice(0, 3).join(','))}`,
                          action_id: 'pick_gift',
                          style: 'primary'
                        }
                      ]
                    }
                  ]
                });

                console.log(`Sent DM to user ${slackUserIds[i]} for ${person.name}`);
                messageResults.push({
                  person: person.name,
                  channel: `DM to ${slackUserIds[i]}`,
                  status: 'sent',
                  message: personalizedMessage
                });
                messageSent = true;
              }
            } catch (dmError: any) {
              console.error(`Error sending DM to ${slackUserIds[i]}:`, dmError.message);
            }
          }

          // Option 2: Try to find user by email if we don't have their Slack ID
          if (!messageSent && person.email) {
            try {
              const userResult = await slackApp.client.users.lookupByEmail({
                email: person.email
              });

              if (userResult.user?.id) {
                const conversation = await slackApp.client.conversations.open({
                  users: userResult.user.id
                });

                if (conversation.channel?.id) {
                  // Randomly select one of the hardcoded user IDs for the "Say Hi" button
                  const randomUserId = slackUserIds[Math.floor(Math.random() * slackUserIds.length)];

                  await slackApp.client.chat.postMessage({
                    channel: conversation.channel.id,
                    text: personalizedMessage,
                    blocks: [
                      {
                        type: 'section',
                        text: {
                          type: 'mrkdwn',
                          text: personalizedMessage
                        }
                      },
                      {
                        type: 'actions',
                        elements: [
                          {
                            type: 'button',
                            text: {
                              type: 'plain_text',
                              text: 'Say Hi',
                              emoji: true
                            },
                            url: `slack://user?team=${employee.teamId || 'T08B9B5BJDT'}&id=${randomUserId}`,
                            action_id: 'say_hi'
                          },
                          {
                            type: 'button',
                            text: {
                              type: 'plain_text',
                              text: 'Pick out a gift',
                              emoji: true
                            },
                            url: `http://localhost:3000/hr/pick-gift`,
                            action_id: 'pick_gift',
                            style: 'primary'
                          }
                        ]
                      }
                    ]
                  });

                  console.log(`Sent DM to ${person.name} (${person.email})`);
                  messageResults.push({
                    person: person.name,
                    channel: `DM to ${person.email}`,
                    status: 'sent',
                    message: personalizedMessage
                  });
                  messageSent = true;
                }
              }
            } catch (emailError: any) {
              console.error(`Error finding user by email ${person.email}:`, emailError.message);
            }
          }

          // Option 3: Send to default channel if DM failed
          if (!messageSent && defaultChannel) {
            try {
              await slackApp.client.chat.postMessage({
                channel: defaultChannel,
                text: `Introduction message for ${person.name} (${person.role}):\n\n${personalizedMessage}`,
              });

              messageResults.push({
                person: person.name,
                channel: defaultChannel,
                status: 'sent_to_default',
                message: personalizedMessage
              });
            } catch (channelError) {
              console.error(`Error sending to default channel:`, channelError);
              messageResults.push({
                person: person.name,
                channel: 'none',
                status: 'failed',
                error: 'Could not send message via any method'
              });
            }
          } else if (!messageSent) {
            messageResults.push({
              person: person.name,
              channel: 'none',
              status: 'failed',
              error: 'No valid Slack user ID or email found'
            });
          }
        } catch (error: any) {
          console.error(`Error processing message for ${person.name}:`, error.message);
          messageResults.push({
            person: person.name,
            channel: 'none',
            status: 'failed',
            error: error.message
          });
        }
      }

      // Add message results to response
      response.slackMessages = messageResults;

      res.json(response);
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // New endpoint to send a message to one of three users
  app.post('/send-message', async (req: Request, res: Response) => {
    try {
      const { message, userId } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Missing message field' });
      }

      // Three hardcoded user IDs
      // const userIds = ['U08AXKYCG87', 'U08C10NAA0G', 'U08BQSPHAQH'];

      // Randomly select one of the three user IDs
      const selectedUserId = userId

      try {
        // Open a DM conversation with the selected user
        const conversation = await slackApp.client.conversations.open({
          users: selectedUserId
        });

        if (conversation.channel?.id) {
          // Send the message
          await slackApp.client.chat.postMessage({
            channel: conversation.channel.id,
            text: message
          });

          console.log(`Message sent to user ${selectedUserId}`);

          res.json({
            success: true,
            userId: selectedUserId,
            message: 'Message sent successfully'
          });
        } else {
          throw new Error('Could not open conversation');
        }
      } catch (error: any) {
        console.error(`Error sending message to ${selectedUserId}:`, error.message);
        res.status(500).json({
          error: 'Failed to send message',
          details: error.message
        });
      }
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
}
