# @tokencap/sdk

Lightweight LLM cost optimization with **pre-execution prediction**. Zero dependencies.

```typescript
// One line change to add cost tracking
const openai = tokencap(new OpenAI({ apiKey }), {
  budget: 10.00,
  onCost: (cost) => console.log(`$${cost.totalCost.toFixed(4)}`)
});
```

## Features

- **Pre-flight cost estimates** - Know the cost before you run
- **Budget enforcement** - Hard caps with automatic blocking
- **Per-request callbacks** - Track every API call
- **Zero dependencies** - Just TypeScript
- **Works with OpenAI & Anthropic** - Drop-in wrapper

## Installation

```bash
npm install @tokencap/sdk
```

## Quick Start

### Wrap your SDK client

```typescript
import OpenAI from 'openai';
import { tokencap } from '@tokencap/sdk';

// Create your client as usual
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Wrap it with tokencap
const client = tokencap(openai, {
  budget: 10.00,                    // $10 max spend
  onCost: (cost) => {
    console.log(`Request cost: $${cost.totalCost.toFixed(4)}`);
  },
  onBudgetWarning: (status) => {
    console.log(`Warning: $${status.remaining.toFixed(2)} remaining`);
  },
  onBudgetExceeded: () => {
    console.log('Budget exceeded - request blocked');
  }
});

// Use exactly like the original client
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Works with Anthropic too

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { tokencap } from '@tokencap/sdk';

const anthropic = tokencap(new Anthropic(), {
  budget: 5.00,
  onCost: (cost) => console.log(`Cost: $${cost.totalCost.toFixed(4)}`)
});

const response = await anthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## Pre-flight Cost Estimation

Get cost estimates **before** making API calls:

```typescript
import { estimate } from '@tokencap/sdk';

const result = estimate({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing.' }
  ],
  max_tokens: 1000
});

console.log(result);
// {
//   inputTokens: 18,
//   outputTokens: 1000,
//   estimatedCost: 0.0654,
//   inputCost: 0.00054,
//   outputCost: 0.06,
//   model: 'gpt-4',
//   confidence: 'high'
// }
```

## Token Counting

Count tokens locally without API calls:

```typescript
import { countTokens, countMessagesTokens } from '@tokencap/sdk';

// Simple string
const tokens = countTokens('Hello, world!');
console.log(tokens); // { total: 4 }

// Message array
const messages = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Hi!' }
];
const count = countMessagesTokens(messages, { model: 'gpt-4' });
console.log(count);
// { total: 15, breakdown: [{ role: 'system', tokens: 10 }, { role: 'user', tokens: 5 }] }
```

## Budget Management

### Configuration Options

```typescript
tokencap(client, {
  // Maximum budget in USD
  budget: 10.00,

  // Warning at 80% (default)
  warningThreshold: 0.8,

  // Block requests when exceeded (default: true)
  blockOnExceeded: true,

  // Callbacks
  onCost: (cost) => { /* per-request */ },
  onBudgetWarning: (status) => { /* at threshold */ },
  onBudgetExceeded: (status) => { /* when blocked */ },
  onEstimate: (estimate) => { /* before each request */ }
});
```

### Check Budget Status

```typescript
const client = tokencap(openai, { budget: 10.00 });

// After some requests...
const status = client.getBudgetStatus();
console.log(status);
// {
//   spent: 2.50,
//   remaining: 7.50,
//   limit: 10.00,
//   exceeded: false,
//   warning: false
// }

// Reset if needed
client.resetBudget();

// Get total spent
const total = client.getTotalCost();
```

### Handle Budget Exceeded

```typescript
import { tokencap, TokencapBudgetExceededError } from '@tokencap/sdk';

const client = tokencap(openai, { budget: 0.01 });

try {
  await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Write a novel.' }],
    max_tokens: 4000
  });
} catch (error) {
  if (error instanceof TokencapBudgetExceededError) {
    console.log('Budget exceeded!');
    console.log('Status:', error.status);
    console.log('Estimate:', error.estimate);
  }
}
```

## Model Pricing

Get pricing info for models:

```typescript
import { getModelPricing, getAllModelPricing, getCheapestModel } from '@tokencap/sdk';

// Get pricing for a specific model
const pricing = getModelPricing('gpt-4');
// {
//   model: 'gpt-4',
//   provider: 'openai',
//   inputPricePerMillion: 30000,
//   outputPricePerMillion: 60000,
//   contextWindow: 8192
// }

// Get all model pricing
const allPricing = getAllModelPricing();

// Find cheapest model for your needs
const cheapest = getCheapestModel(4000, 'openai');
```

## Supported Models

### OpenAI
- GPT-4, GPT-4 Turbo, GPT-4o, GPT-4o-mini
- GPT-3.5 Turbo
- o1-preview, o1-mini

### Anthropic
- Claude 3 (Opus, Sonnet, Haiku)
- Claude 3.5 (Sonnet, Haiku)

## API Reference

### `tokencap(client, config)`

Wrap an SDK client with cost tracking.

```typescript
function tokencap<T>(client: T, config?: TokencapConfig): T & {
  getBudgetStatus: () => BudgetStatus;
  resetBudget: () => void;
  getTotalCost: () => number;
}
```

### `estimate(request)`

Get pre-execution cost estimate.

```typescript
function estimate(request: EstimateRequest): CostEstimate
```

### `countTokens(text, options?)`

Count tokens in a string.

```typescript
function countTokens(text: string, options?: TokenizerOptions): TokenCount
```

### `countMessagesTokens(messages, options?)`

Count tokens in a message array.

```typescript
function countMessagesTokens(messages: Message[], options?: TokenizerOptions): TokenCount
```

## Types

```typescript
interface TokencapConfig {
  budget?: number;
  warningThreshold?: number;
  blockOnExceeded?: boolean;
  onCost?: (cost: ActualCost) => void;
  onBudgetWarning?: (status: BudgetStatus) => void;
  onBudgetExceeded?: (status: BudgetStatus) => void;
  onEstimate?: (estimate: CostEstimate) => void;
}

interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  inputCost: number;
  outputCost: number;
  model: string;
  confidence: 'high' | 'medium' | 'low';
}

interface BudgetStatus {
  spent: number;
  remaining: number;
  limit: number;
  exceeded: boolean;
  warning: boolean;
}
```

## License

MIT
