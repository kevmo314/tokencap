# Tokencap

**Know your AI costs before you run.**

Tokencap is an open-source LLM cost optimization tool that predicts costs before execution and enforces budgets automatically.

## The Problem

- **Bill shock is real**: "$120 OpenAI bill after AutoGPT ran 8 hours unchecked"
- **No framework has built-in cost controls**: LangChain, CrewAI, AutoGPT leave it to you
- **Costs grow quadratically**: Context accumulation in agents compounds every turn
- **40% of agentic AI projects fail** partly due to cost surprises

## The Solution

Tokencap sits between your code and LLM APIs, providing:

1. **Pre-execution cost prediction** - Know what a request will cost before it runs
2. **Budget enforcement** - Automatic rejection when limits are exceeded
3. **Cost tracking** - Full visibility into spend by project, model, and time

## Quick Start

### Option 1: SDK Wrapper (Easiest)

```typescript
import OpenAI from 'openai';
import { tokencap } from '@tokencap/sdk';

const openai = tokencap(new OpenAI(), {
  budget: 10.00, // $10 max spend
  onCost: (cost) => console.log(`Request cost: $${cost.toFixed(4)}`)
});

// Use exactly like normal - costs are tracked automatically
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Option 2: Proxy Server

```bash
# Start the proxy
npx @tokencap/proxy

# Point your OpenAI base URL to it
OPENAI_BASE_URL=http://localhost:3000/v1
```

### Option 3: Pre-flight Estimation Only

```typescript
import { estimate } from '@tokencap/sdk';

const cost = await estimate({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Write a poem about AI' }],
  max_tokens: 500
});

console.log(`Estimated cost: $${cost.min.toFixed(4)} - $${cost.max.toFixed(4)}`);
// Estimated cost: $0.0023 - $0.0089
```

## Features

| Feature | Description |
|---------|-------------|
| **Cost Prediction** | Exact input tokens, estimated output with confidence intervals |
| **Budget Enforcement** | Hard limits with automatic request rejection |
| **Graceful Degradation** | Optionally fall back to cheaper models at budget threshold |
| **Agent Chain Tracking** | Track costs across multi-step workflows |
| **Loop Detection** | Circuit breakers for runaway agent loops |
| **Multi-Provider** | OpenAI, Anthropic, Google, Mistral support |

## Response Headers

Every proxied request includes cost metadata:

```
X-Tokencap-Input-Tokens: 150
X-Tokencap-Output-Tokens: 89
X-Tokencap-Cost-USD: 0.00234
X-Tokencap-Budget-Remaining: 9.99766
```

## Pricing

| Tier | Price | Limits |
|------|-------|--------|
| Free | $0 | 50K requests/month |
| Pro | $29/month | 500K requests |
| Team | $99/month | 2M requests |
| Self-hosted | Free forever | Unlimited |

## Self-Hosting

```bash
git clone https://github.com/tokencap/tokencap
cd tokencap
npm install
npm run build
npm run dev
```

## License

MIT - Use it however you want.

## Links

- Website: [tokencap.dev](https://tokencap.dev)
- GitHub: [github.com/tokencap/tokencap](https://github.com/tokencap/tokencap)
- Email: hello@tokencap.dev
