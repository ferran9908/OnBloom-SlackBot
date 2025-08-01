import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_APP_TOKEN: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  QLOO_API_KEY: z.string().min(1),
  NOTION_API_KEY: z.string().min(1),
  NOTION_DATABASE_ID: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().min(1),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;