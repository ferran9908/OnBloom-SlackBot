# OnBloom Slackbot

An intelligent Slack bot that enhances employee engagement through AI-powered conversations and cultural intelligence-based workplace connections.

## Features

### 🤖 Conversational AI Assistant

- Natural language interactions with memory persistence
- Context-aware responses using conversation history
- Multi-channel support (DMs, channels, threads)
- Built-in commands: `clear`, `reset`, `help`

### 🏠 Interactive Housing Recommendations

- Location-based neighborhood suggestions
- Personalized recommendations using cultural intelligence
- Multi-stage conversational flow
- Integration with Qloo's taste intelligence API

### 🤝 Smart Employee Connections

- Automated employee introductions based on shared interests
- Cultural and demographic matching
- Personalized connection insights
- Gift recommendations based on common preferences

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js + Slack Bolt SDK
- **AI/LLM**: OpenRouter (Llama 3.1 8B, Gemini 2.5 Flash)
- **Intelligence**: Qloo API for cultural insights
- **Storage**: Upstash Redis, Notion API
- **Deployment**: Railway

## Prerequisites

- Node.js 18+
- npm or yarn
- Slack workspace with admin access
- API keys for all services (see Environment Variables)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/onbloom-slackbot.git
cd onbloom-slackbot
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables (see Configuration section)

4. Build the project:

```bash
npm run build
```

5. Start the bot:

```bash
npm start
```

## Configuration

Create a `.env` file with the following variables:

```env
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# AI/LLM Configuration
OPENROUTER_API_KEY=your-openrouter-key

# Qloo API Configuration
QLOO_API_KEY=your-qloo-api-key

# Storage Configuration
NOTION_API_KEY=your-notion-api-key
NOTION_DATABASE_ID=your-database-id
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Server Configuration (optional)
PORT=3000
NODE_ENV=development
```

## Slack App Setup

1. Create a new Slack app at [api.slack.com/apps](https://api.slack.com/apps)

2. Enable Socket Mode:

   - Go to Socket Mode → Enable Socket Mode
   - Generate an app-level token with `connections:write` scope

3. Configure OAuth & Permissions:

   - Add Bot Token Scopes:
     - `app_mentions:read`
     - `channels:history`
     - `channels:read`
     - `chat:write`
     - `im:history`
     - `im:read`
     - `im:write`
     - `users:read`

4. Enable Event Subscriptions:

   - Subscribe to bot events:
     - `app_mention`
     - `message.channels`
     - `message.im`

5. Install the app to your workspace

## Available Scripts

```bash
npm run dev         # Start in development mode with hot reload
npm run build       # Build TypeScript to JavaScript
npm start          # Start production server
npm run format     # Format code with Prettier
```

## Usage

### General Chat

- Mention the bot in any channel: `@OnBloom how are you?`
- Send a direct message for private conversations
- Use threading for context-aware responses

### Commands

- `clear` or `reset` - Clear conversation history
- `help` - Display available commands

### Housing Recommendations

Simply mention housing-related keywords in your message:

- "I'm looking for housing recommendations"
- "Where should I live in San Francisco?"
- "I need help finding a neighborhood"

### Employee Introductions (Webhook)

Send a POST request to `/introductions` with employee data to trigger automated introductions.

## API Endpoints

### Health Check

```
GET /health
```

### Employee Introductions

```
POST /introductions
Content-Type: application/json

{
  "employee": {
    "name": "John Doe",
    "slackHandle": "john.doe",
    "notionUserId": "notion-user-id"
  },
  "colleagues": [
    {
      "name": "Jane Smith",
      "slackHandle": "jane.smith",
      "notionUserId": "notion-user-id"
    }
  ]
}
```

## Architecture

```
src/
├── ai/              # AI response generation
├── api/             # Webhook endpoints
├── services/        # Core business logic
│   ├── memory.ts    # Conversation persistence
│   ├── housing.ts   # Housing recommendations
│   ├── qloo.ts      # Qloo API integration
│   └── notion.ts    # Employee data management
├── slack/           # Slack bot handlers
└── index.ts         # Application entry point
```

## Deployment

The bot is configured for deployment on Railway:

1. Connect your GitHub repository
2. Set all environment variables
3. Deploy with automatic builds

The bot runs on the primary port (default 3000) with webhooks on port + 1 (3001).
