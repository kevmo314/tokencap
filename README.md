<p align="center">
  <h1 align="center">Tokencap</h1>
  <p align="center"><strong>Know your AI costs before you run.</strong></p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@tokencap/sdk"><img src="https://img.shields.io/npm/v/@tokencap/sdk.svg?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/tokencap/tokencap/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
  <a href="https://github.com/tokencap/tokencap/actions"><img src="https://img.shields.io/github/actions/workflow/status/tokencap/tokencap/ci.yml?branch=main&style=flat-square" alt="Build Status" /></a>
  <a href="https://tokencap.dev"><img src="https://img.shields.io/badge/docs-tokencap.dev-brightgreen?style=flat-square" alt="Documentation" /></a>
</p>

---

**Tokencap is the only LLM cost tool that predicts costs *before* execution.** Every other platform (Helicone, Portkey, LangSmith) only tracks costs after you've already spent the money. We tell you what it will cost before you run.

## The Problem

- **Bill shock is real**: "$120 OpenAI bill after AutoGPT ran 8 hours unchecked"
- **No framework has built-in cost controls**: LangChain, CrewAI, AutoGPT all leave it to you
- **Costs grow quadratically**: Context accumulation in agents compounds every turn
- **40% of agentic AI projects fail** partly due to cost surprises (Gartner)

## Why Tokencap?

| Feature | Helicone | Portkey | LangSmith | **Tokencap** |
|---------|:--------:|:-------:|:---------:|:------------:|
| Pre-execution cost prediction | No | No | No | **Yes** |
| Output estimation with confidence | No | No | No | **Yes** |
| Agent chain cost estimates | No | No | No | **Yes** |
| Hard budget enforcement | Alerts only | Alerts only | No | **Auto-kill** |
| Approval workflows | No | Partial | No | **Yes** |
| Self-hostable | Yes | No | No | **Yes** |
| Open source | Yes | Partial | No | **Yes (MIT)** |
| Loop detection / circuit breakers | No | No | No | **Yes** |

## Quick Start

### Option 1: SDK Wrapper (Recommended)

```bash
npm install @tokencap/sdk
```

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

Zero code changes required. Just point your base URL to Tokencap.

```bash
# Install and start the proxy
npx @tokencap/proxy

# Configure your client
export OPENAI_BASE_URL=http://localhost:3000/v1
```

Or with Docker:

```bash
docker run -p 3000:3000 tokencap/proxy
```

### Option 3: Pre-flight Estimation Only

Get cost estimates without proxying traffic.

```typescript
import { estimate } from '@tokencap/sdk';

const cost = await estimate({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Write a poem about AI' }],
  max_tokens: 500
});

console.log(`Estimated cost: $${cost.min.toFixed(4)} - $${cost.max.toFixed(4)}`);
// Estimated cost: $0.0023 - $0.0089

// Approve or reject based on estimate
if (cost.max > 0.10) {
  throw new Error('Request too expensive');
}
```

## Features

### Pre-Execution Cost Prediction

```typescript
import { estimate } from '@tokencap/sdk';

// Get cost estimate before running
const estimate = await estimate({
  model: 'claude-3-5-sonnet-20241022',
  messages: conversation,
  max_tokens: 2000
});

console.log(`Input tokens: ${estimate.inputTokens} (exact)`);
console.log(`Output estimate: ${estimate.outputTokens.min}-${estimate.outputTokens.max}`);
console.log(`Cost range: $${estimate.cost.min} - $${estimate.cost.max}`);
```

### Budget Enforcement

```typescript
const openai = tokencap(new OpenAI(), {
  budget: 5.00,                    // Hard cap at $5
  budgetWindow: '24h',             // Reset daily
  onBudgetExceeded: (info) => {
    console.log(`Budget exceeded! Spent: $${info.spent}`);
  },
  fallbackModel: 'gpt-4o-mini'     // Try cheaper model before rejecting
});
```

### Agent Chain Tracking

```typescript
import { TokencapSession } from '@tokencap/sdk';

const session = new TokencapSession({
  budget: 25.00,
  maxIterations: 50,               // Circuit breaker
  loopDetection: true              // Detect repeated patterns
});

// Track costs across multi-step workflows
for (const step of agentSteps) {
  const result = await session.run(() => agent.execute(step));
  console.log(`Step cost: $${result.cost}, Total: $${session.totalCost}`);
}
```

### Response Headers

Every proxied request includes cost metadata:

```
X-Tokencap-Input-Tokens: 150
X-Tokencap-Output-Tokens: 89
X-Tokencap-Cost-USD: 0.00234
X-Tokencap-Budget-Remaining: 9.99766
X-Tokencap-Request-Id: tc_abc123
```

## Supported Providers

| Provider | Input Prediction | Output Estimation | Budget Enforcement |
|----------|:----------------:|:-----------------:|:------------------:|
| OpenAI | Yes | Yes | Yes |
| Anthropic | Yes | Yes | Yes |
| Google (Gemini) | Yes | Yes | Yes |
| Mistral | Yes | Yes | Yes |
| Groq | Yes | Yes | Yes |
| Together AI | Yes | Yes | Yes |
| Azure OpenAI | Yes | Yes | Yes |

**300+ models supported** with real-time pricing updates.

## API Reference

### `tokencap(client, options)`

Wraps an LLM client with cost tracking and budget enforcement.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `budget` | `number` | `Infinity` | Maximum spend in USD |
| `budgetWindow` | `string` | `'forever'` | Budget reset period (`'1h'`, `'24h'`, `'30d'`) |
| `onCost` | `function` | - | Callback after each request with cost info |
| `onBudgetExceeded` | `function` | - | Called when budget is exceeded |
| `fallbackModel` | `string` | - | Cheaper model to try before rejecting |
| `apiKey` | `string` | - | Tokencap API key (for cloud features) |

### `estimate(request)`

Returns cost estimate for a request without executing it.

```typescript
const result = await estimate({
  model: 'gpt-4o',
  messages: [...],
  max_tokens: 1000
});

// result: {
//   inputTokens: 150,           // Exact count
//   outputTokens: { min: 200, max: 1000 },
//   cost: { min: 0.002, max: 0.008 },
//   confidence: 0.75
// }
```

### `TokencapSession`

Track costs across multiple requests with shared budget.

```typescript
const session = new TokencapSession({
  budget: 50.00,
  maxIterations: 100,
  loopDetection: true,
  loopThreshold: 3              // Max repeated patterns
});

session.totalCost;              // Current spend
session.remainingBudget;        // Budget left
session.iterationCount;         // Requests made
```

## Self-Hosting

Tokencap is fully open source (MIT). Run your own instance with zero external dependencies.

```bash
# Clone the repo
git clone https://github.com/tokencap/tokencap
cd tokencap

# Install dependencies
npm install

# Build all packages
npm run build

# Start the proxy server
npm run dev
```

### Environment Variables

```bash
# Optional: Connect to cloud dashboard
TOKENCAP_API_KEY=tc_xxx

# Optional: Custom port
PORT=3000

# Optional: Database path (default: ./data/tokencap.db)
DATABASE_PATH=/var/lib/tokencap/data.db
```

### Docker Compose

```yaml
version: '3.8'
services:
  tokencap:
    image: tokencap/proxy:latest
    ports:
      - "3000:3000"
    volumes:
      - tokencap-data:/data
    environment:
      - DATABASE_PATH=/data/tokencap.db

volumes:
  tokencap-data:
```

## Pricing

| Tier | Price | Requests/month | Features |
|------|-------|----------------|----------|
| **Free** | $0 | 50,000 | Cost tracking, basic budgets |
| **Pro** | $29 | 500,000 | Team sharing, advanced analytics |
| **Team** | $99 | 2,000,000 | 20 seats, SSO, audit logs |
| **Self-hosted** | Free forever | Unlimited | Full control, your infrastructure |

## Roadmap

- [x] Pre-execution cost prediction
- [x] Budget enforcement
- [x] Multi-provider support
- [x] Proxy server
- [ ] Web dashboard
- [ ] Slack/Discord alerts
- [ ] Cost anomaly detection
- [ ] Model recommendation engine
- [ ] Prompt caching cost optimization

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Development setup
git clone https://github.com/tokencap/tokencap
cd tokencap
npm install
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

### Project Structure

```
packages/
  sdk/        # @tokencap/sdk - Client wrapper
  proxy/      # @tokencap/proxy - Proxy server
  dashboard/  # Web dashboard (coming soon)
  web/        # Marketing website
```

## License

MIT License - use it however you want. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <a href="https://tokencap.dev">Website</a> |
  <a href="https://github.com/tokencap/tokencap">GitHub</a> |
  <a href="https://tokencap.dev/docs">Documentation</a>
</p>

<p align="center">
  Built with frustration after too many surprise AI bills.
</p>
