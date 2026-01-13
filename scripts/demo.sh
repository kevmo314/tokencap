#!/bin/bash
#
# Tokencap Demo Script
# Demonstrates the basic workflow: set budget, make request, check usage
#
# Usage: ./demo.sh [PROXY_URL]
#   PROXY_URL defaults to http://localhost:3456
#
# Requires: OPENAI_API_KEY environment variable
#

set -e

# Configuration
PROXY_URL="${1:-http://localhost:3456}"
PROJECT_ID="demo"
BUDGET_USD="1.00"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Header
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                  Tokencap Demo                            ║${NC}"
echo -e "${CYAN}║       Pre-execution cost prediction in action            ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
echo -e "${BLUE}[1/5] Checking prerequisites...${NC}"

# Check if proxy is running
if ! curl -s --connect-timeout 3 "$PROXY_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}Error: Proxy not running at $PROXY_URL${NC}"
    echo ""
    echo "Start the proxy first:"
    echo "  cd packages/proxy && npm run dev"
    echo ""
    exit 1
fi
echo -e "  ${GREEN}Proxy is running${NC}"

# Check for API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}Error: OPENAI_API_KEY not set${NC}"
    echo ""
    echo "Export your OpenAI API key:"
    echo "  export OPENAI_API_KEY=sk-..."
    echo ""
    exit 1
fi
echo -e "  ${GREEN}OpenAI API key found${NC}"

# Step 1: Set budget
echo ""
echo -e "${BLUE}[2/5] Setting \$$BUDGET_USD budget for project '$PROJECT_ID'...${NC}"

BUDGET_RESPONSE=$(curl -s -X POST "$PROXY_URL/v1/budget" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\": \"$PROJECT_ID\", \"limitUsd\": $BUDGET_USD}")

if echo "$BUDGET_RESPONSE" | grep -q '"success":true'; then
    echo -e "  ${GREEN}Budget set successfully${NC}"
    LIMIT=$(echo "$BUDGET_RESPONSE" | grep -o '"limitUsd":[0-9.]*' | cut -d: -f2)
    REMAINING=$(echo "$BUDGET_RESPONSE" | grep -o '"remainingUsd":[0-9.]*' | cut -d: -f2)
    echo "  Limit: \$$LIMIT | Remaining: \$$REMAINING"
else
    echo -e "  ${RED}Failed to set budget${NC}"
    echo "  Response: $BUDGET_RESPONSE"
    exit 1
fi

# Step 2: Make an OpenAI request through the proxy
echo ""
echo -e "${BLUE}[3/5] Making OpenAI request through Tokencap proxy...${NC}"
echo "  Model: gpt-4o-mini"
echo "  Prompt: \"Explain what Tokencap does in 2 sentences.\""

# Make the request and capture both body and headers
RESPONSE=$(curl -s -w "\n---HEADERS---\n%{http_code}" -X POST "$PROXY_URL/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "X-Tokencap-Project-Id: $PROJECT_ID" \
    -d '{
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant. Be concise."},
            {"role": "user", "content": "Explain what Tokencap does in 2 sentences. Tokencap is an LLM cost optimization tool with pre-execution prediction."}
        ],
        "max_tokens": 100
    }')

# Parse response
HTTP_CODE=$(echo "$RESPONSE" | grep -A1 "---HEADERS---" | tail -1)
BODY=$(echo "$RESPONSE" | sed '/---HEADERS---/,$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}Request successful (HTTP 200)${NC}"

    # Extract the assistant's message
    CONTENT=$(echo "$BODY" | grep -o '"content":"[^"]*"' | head -1 | sed 's/"content":"//;s/"$//')
    if [ -n "$CONTENT" ]; then
        echo ""
        echo -e "  ${CYAN}Response:${NC}"
        echo "  $CONTENT"
    fi
elif [ "$HTTP_CODE" = "402" ]; then
    echo -e "  ${YELLOW}Request blocked - Budget exceeded (HTTP 402)${NC}"
    ERROR=$(echo "$BODY" | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"$//')
    echo "  $ERROR"
else
    echo -e "  ${RED}Request failed (HTTP $HTTP_CODE)${NC}"
    echo "  Response: $BODY"
fi

# Step 3: Check usage and remaining budget
echo ""
echo -e "${BLUE}[4/5] Checking usage and remaining budget...${NC}"

USAGE_RESPONSE=$(curl -s "$PROXY_URL/v1/usage?project_id=$PROJECT_ID")

# Parse usage data
TOTAL_REQUESTS=$(echo "$USAGE_RESPONSE" | grep -o '"totalRequests":[0-9]*' | cut -d: -f2)
TOTAL_INPUT=$(echo "$USAGE_RESPONSE" | grep -o '"totalInputTokens":[0-9]*' | cut -d: -f2)
TOTAL_OUTPUT=$(echo "$USAGE_RESPONSE" | grep -o '"totalOutputTokens":[0-9]*' | cut -d: -f2)
TOTAL_COST=$(echo "$USAGE_RESPONSE" | grep -o '"totalCostUsd":[0-9.]*' | cut -d: -f2)
BUDGET_REMAINING=$(echo "$USAGE_RESPONSE" | grep -o '"budgetRemainingUsd":[0-9.]*' | cut -d: -f2)
UTILIZATION=$(echo "$USAGE_RESPONSE" | grep -o '"budgetUtilizationPercent":[0-9.]*' | cut -d: -f2)

echo ""
echo -e "  ${CYAN}Usage Summary:${NC}"
echo "  ┌─────────────────────────────────────────┐"
echo "  │  Total Requests:     $TOTAL_REQUESTS"
echo "  │  Input Tokens:       $TOTAL_INPUT"
echo "  │  Output Tokens:      $TOTAL_OUTPUT"
echo "  │  Total Cost:         \$$TOTAL_COST"
echo "  │  Budget Remaining:   \$$BUDGET_REMAINING"
echo "  │  Budget Used:        ${UTILIZATION}%"
echo "  └─────────────────────────────────────────┘"

# Step 4: Show how to view history
echo ""
echo -e "${BLUE}[5/5] Recent request history...${NC}"

HISTORY=$(curl -s "$PROXY_URL/v1/usage/history?project_id=$PROJECT_ID&limit=3")
RECORD_COUNT=$(echo "$HISTORY" | grep -o '"requestId"' | wc -l)

if [ "$RECORD_COUNT" -gt 0 ]; then
    echo "  Found $RECORD_COUNT recent request(s)"
    echo ""
    # Show simplified view
    echo "$HISTORY" | grep -o '"model":"[^"]*"' | head -3 | while read -r line; do
        MODEL=$(echo "$line" | sed 's/"model":"//;s/"$//')
        echo "  - Model: $MODEL"
    done
else
    echo "  No requests recorded yet"
fi

# Summary
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Demo complete!${NC}"
echo ""
echo "Key features demonstrated:"
echo "  1. Budget enforcement - requests blocked when over budget"
echo "  2. Cost tracking - every request logged with token counts"
echo "  3. Usage visibility - real-time spending vs budget"
echo ""
echo "Next steps:"
echo "  - Try setting a lower budget and see requests get blocked"
echo "  - Use the Anthropic endpoint at POST /v1/messages"
echo "  - Check the full API at $PROXY_URL/"
echo ""
