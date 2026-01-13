# @tokencap/proxy

LLM proxy server with **pre-execution cost prediction** and **budget enforcement**.

## Features

- **Pre-execution cost prediction**: Know exactly how much a request will cost BEFORE it runs
- **Budget enforcement**: Set hard spending limits that automatically reject over-budget requests
- **Multi-provider support**: Works with OpenAI and Anthropic APIs
- **Drop-in replacement**: Just change your base URL - no code changes required
- **Usage tracking**: Full SQLite-based logging of all requests and costs
- **Streaming support**: Works with both streaming and non-streaming requests

## Installation

```bash
npm install @tokencap/proxy
```

Or run directly:

```bash
npx @tokencap/proxy
```

## Quick Start

### 1. Start the proxy server

```bash
# Set your API keys
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Start the server
npm start
```

The server starts on `http://localhost:3456` by default.

### 2. Use with OpenAI SDK

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3456/v1', // Point to Tokencap proxy
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Cost info is in response headers (access via raw response)
```

### 3. Use with Anthropic SDK

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  baseURL: 'http://localhost:3456/v1', // Point to Tokencap proxy
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### 4. Use with cURL

```bash
# OpenAI
curl http://localhost:3456/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Anthropic
curl http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Budget Management

### Set a budget

```bash
curl -X POST http://localhost:3456/v1/budget \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-project",
    "limitUsd": 10.00,
    "periodDays": 30
  }'
```

### Check budget status

```bash
curl http://localhost:3456/v1/budget \
  -H "X-Tokencap-Project-Id: my-project"
```

### Reset budget

```bash
curl -X POST http://localhost:3456/v1/budget/reset \
  -H "X-Tokencap-Project-Id: my-project"
```

### Delete budget

```bash
curl -X DELETE http://localhost:3456/v1/budget \
  -H "X-Tokencap-Project-Id: my-project"
```

## Usage Tracking

### Get usage summary

```bash
curl http://localhost:3456/v1/usage \
  -H "X-Tokencap-Project-Id: my-project"
```

Response:
```json
{
  "usage": {
    "projectId": "my-project",
    "totalRequests": 42,
    "totalInputTokens": 15000,
    "totalOutputTokens": 8500,
    "totalCostUsd": 0.235,
    "budgetLimitUsd": 10.00,
    "budgetRemainingUsd": 9.765,
    "budgetUtilizationPercent": 2.35
  }
}
```

### Get usage history

```bash
curl "http://localhost:3456/v1/usage/history?limit=50" \
  -H "X-Tokencap-Project-Id: my-project"
```

## Response Headers

Every proxied response includes these headers:

| Header | Description |
|--------|-------------|
| `X-Tokencap-Input-Tokens` | Exact input token count |
| `X-Tokencap-Output-Tokens` | Actual output token count |
| `X-Tokencap-Estimated-Output-Tokens` | Pre-execution output estimate |
| `X-Tokencap-Cost-USD` | Actual cost in USD |
| `X-Tokencap-Estimated-Cost-USD` | Pre-execution cost estimate |
| `X-Tokencap-Budget-Remaining` | Remaining budget in USD |
| `X-Tokencap-Confidence` | Estimate confidence (high/medium/low) |
| `X-Tokencap-Request-Id` | Unique request identifier |

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3456` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `DB_PATH` | `./tokencap.db` | SQLite database path |
| `OPENAI_API_KEY` | - | Default OpenAI API key |
| `ANTHROPIC_API_KEY` | - | Default Anthropic API key |
| `DEFAULT_PROJECT_ID` | `default` | Default project for requests |
| `DEFAULT_MAX_TOKENS` | `4096` | Default max tokens estimate |

## Project Identification

Requests can be associated with projects using:

1. **Header**: `X-Tokencap-Project-Id: my-project`
2. **Query param**: `?project_id=my-project`
3. **Default**: Uses `DEFAULT_PROJECT_ID` env var

## API Reference

### Proxy Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/chat/completions` | OpenAI Chat Completions proxy |
| `POST` | `/v1/messages` | Anthropic Messages proxy |

### Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/usage` | Get usage summary |
| `GET` | `/v1/usage/history` | Get usage records |
| `GET` | `/v1/budget` | Get budget status |
| `POST` | `/v1/budget` | Set budget limit |
| `POST` | `/v1/budget/reset` | Reset spent amount |
| `DELETE` | `/v1/budget` | Delete budget |

### Health Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Server info |
| `GET` | `/health` | Health check |

## Budget Exceeded Response

When a request would exceed the budget, the proxy returns:

```json
{
  "error": {
    "type": "budget_exceeded",
    "message": "Request would exceed budget. Estimated cost: $0.005000, Remaining budget: $0.002000",
    "details": {
      "currentSpendUsd": 9.998,
      "limitUsd": 10.00,
      "estimatedCostUsd": 0.005,
      "remainingBudgetUsd": 0.002
    }
  }
}
```

HTTP Status: `402 Payment Required`

## Supported Models

The proxy includes pricing data for 100+ models from:

- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-4, GPT-3.5-turbo, o1, o1-mini, o3, o3-mini
- **Anthropic**: Claude 4.5 Opus/Sonnet/Haiku, Claude 3.5 Sonnet/Haiku, Claude 3 Opus/Sonnet/Haiku
- **Google**: Gemini 2.5/2.0/1.5 Pro/Flash
- **Mistral**: Mistral Large/Medium/Small, Ministral, Codestral
- **Meta**: Llama 3.1/3.2/3.3 (via various providers)

Unknown models fall back to GPT-4o pricing as a conservative estimate.

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│   Tokencap   │────▶│  OpenAI /   │
│  (OpenAI/   │◀────│    Proxy     │◀────│  Anthropic  │
│  Anthropic) │     └──────────────┘     └─────────────┘
└─────────────┘            │
                           ▼
                    ┌──────────────┐
                    │   SQLite DB  │
                    │  (usage log) │
                    └──────────────┘
```

## How Cost Prediction Works

1. **Input tokens**: Counted exactly using tiktoken (OpenAI) or approximation (Anthropic)
2. **Output tokens**: Estimated based on `max_tokens` parameter or model defaults
3. **Cost calculation**: Uses real-time pricing data for 100+ models
4. **Confidence levels**:
   - `high`: max_tokens specified, output estimate is 75% of limit
   - `medium`: no max_tokens, using model default (50% estimate)
   - `low`: complex scenarios with high variance

## License

MIT
