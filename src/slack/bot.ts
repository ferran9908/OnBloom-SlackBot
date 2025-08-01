import pkg from '@slack/bolt';
const { App } = pkg;
import { env } from '../env.js';

export const app = new App({
  token: env.SLACK_BOT_TOKEN,
  signingSecret: env.SLACK_SIGNING_SECRET,
  appToken: env.SLACK_APP_TOKEN,
  socketMode: true,
  port: env.PORT,
});

export async function startBot() {
  await app.start();
  console.log('⚡️ Bolt app is running!');
}