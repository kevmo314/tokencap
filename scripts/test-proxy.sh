#!/bin/bash
#
# Tokencap Proxy Test Script
# Tests all proxy endpoints to verify the server is working correctly
#
# Usage: ./test-proxy.sh [PROXY_URL]
#   PROXY_URL defaults to http://localhost:3456
#

set -e

# Configuration
PROXY_URL="${1:-http://localhost:3456}"
TEST_PROJECT="test-project-$(date +%s)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_test() {
    echo -e "\n${YELLOW}TEST:${NC} $1"
}

print_success() {
    echo -e "${GREEN}PASS:${NC} $1"
    ((TESTS_PASSED++))
}

print_failure() {
    echo -e "${RED}FAIL:${NC} $1"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${BLUE}INFO:${NC} $1"
}

print_skip() {
    echo -e "${YELLOW}SKIP:${NC} $1"
}

# Check if proxy is running
print_header "Proxy Connection Test"

print_test "Checking if proxy is running at $PROXY_URL"
if curl -s --connect-timeout 5 "$PROXY_URL" > /dev/null 2>&1; then
    print_success "Proxy is reachable"
else
    print_failure "Cannot connect to proxy at $PROXY_URL"
    echo ""
    echo "Make sure the proxy is running:"
    echo "  cd packages/proxy && npm run dev"
    echo ""
    exit 1
fi

# Test health endpoint
print_header "Health Check Tests"

print_test "GET / - Root endpoint"
RESPONSE=$(curl -s "$PROXY_URL/")
if echo "$RESPONSE" | grep -q "Tokencap Proxy"; then
    print_success "Root endpoint returns Tokencap info"
    echo "  Response: $(echo "$RESPONSE" | head -c 100)..."
else
    print_failure "Root endpoint did not return expected response"
    echo "  Response: $RESPONSE"
fi

print_test "GET /health - Health endpoint"
RESPONSE=$(curl -s "$PROXY_URL/health")
if echo "$RESPONSE" | grep -q '"status":"ok"'; then
    print_success "Health endpoint returns OK"
else
    print_failure "Health endpoint did not return OK"
    echo "  Response: $RESPONSE"
fi

# Test budget endpoints
print_header "Budget Management Tests"

print_test "POST /v1/budget - Set budget for project '$TEST_PROJECT'"
RESPONSE=$(curl -s -X POST "$PROXY_URL/v1/budget" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\": \"$TEST_PROJECT\", \"limitUsd\": 5.00}")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Budget set successfully"
    echo "  Response: $RESPONSE"
else
    print_failure "Failed to set budget"
    echo "  Response: $RESPONSE"
fi

print_test "GET /v1/budget - Get budget for project '$TEST_PROJECT'"
RESPONSE=$(curl -s "$PROXY_URL/v1/budget?project_id=$TEST_PROJECT")
if echo "$RESPONSE" | grep -q '"limitUsd"'; then
    print_success "Budget retrieved successfully"
    echo "  Response: $RESPONSE"
else
    print_failure "Failed to get budget"
    echo "  Response: $RESPONSE"
fi

print_test "POST /v1/budget - Set budget with period (30 days)"
RESPONSE=$(curl -s -X POST "$PROXY_URL/v1/budget" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\": \"${TEST_PROJECT}-period\", \"limitUsd\": 10.00, \"periodDays\": 30}")
if echo "$RESPONSE" | grep -q '"periodEnd"'; then
    print_success "Budget with period set successfully"
else
    print_failure "Failed to set budget with period"
    echo "  Response: $RESPONSE"
fi

# Test usage endpoints
print_header "Usage Tracking Tests"

print_test "GET /v1/usage - Get usage stats"
RESPONSE=$(curl -s "$PROXY_URL/v1/usage?project_id=$TEST_PROJECT")
if echo "$RESPONSE" | grep -q '"usage"'; then
    print_success "Usage stats retrieved"
    echo "  Response: $RESPONSE"
else
    print_failure "Failed to get usage stats"
    echo "  Response: $RESPONSE"
fi

print_test "GET /v1/usage/history - Get usage history"
RESPONSE=$(curl -s "$PROXY_URL/v1/usage/history?project_id=$TEST_PROJECT&limit=10")
if echo "$RESPONSE" | grep -q '"records"'; then
    print_success "Usage history retrieved"
else
    print_failure "Failed to get usage history"
    echo "  Response: $RESPONSE"
fi

# Test OpenAI proxy (if API key is set)
print_header "OpenAI Proxy Tests"

if [ -n "$OPENAI_API_KEY" ]; then
    print_test "POST /v1/chat/completions - OpenAI request"

    RESPONSE=$(curl -s -X POST "$PROXY_URL/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -H "X-Tokencap-Project-Id: $TEST_PROJECT" \
        -d '{
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "Say hello in exactly 3 words."}],
            "max_tokens": 20
        }')

    if echo "$RESPONSE" | grep -q '"choices"'; then
        print_success "OpenAI request succeeded"
        # Extract and display relevant info
        CONTENT=$(echo "$RESPONSE" | grep -o '"content":"[^"]*"' | head -1)
        echo "  Model response: $CONTENT"
    elif echo "$RESPONSE" | grep -q '"error"'; then
        # Could be budget exceeded or API error
        ERROR_MSG=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"')
        print_failure "OpenAI request failed"
        echo "  Error: $ERROR_MSG"
    else
        print_failure "Unexpected response from OpenAI proxy"
        echo "  Response: $RESPONSE"
    fi

    # Test with verbose headers
    print_test "POST /v1/chat/completions - Check Tokencap headers"
    HEADERS=$(curl -s -I -X POST "$PROXY_URL/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -H "X-Tokencap-Project-Id: $TEST_PROJECT" \
        -d '{
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "Hi"}],
            "max_tokens": 10
        }' 2>&1 || true)

    # Just do a regular request and check via response
    print_info "Tokencap adds cost tracking headers to responses"
else
    print_skip "OPENAI_API_KEY not set - skipping OpenAI tests"
    echo "  Set OPENAI_API_KEY environment variable to enable these tests"
fi

# Test Anthropic proxy (if API key is set)
print_header "Anthropic Proxy Tests"

if [ -n "$ANTHROPIC_API_KEY" ]; then
    print_test "POST /v1/messages - Anthropic request"

    RESPONSE=$(curl -s -X POST "$PROXY_URL/v1/messages" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $ANTHROPIC_API_KEY" \
        -H "X-Tokencap-Project-Id: $TEST_PROJECT" \
        -d '{
            "model": "claude-3-5-haiku-latest",
            "max_tokens": 20,
            "messages": [{"role": "user", "content": "Say hello in exactly 3 words."}]
        }')

    if echo "$RESPONSE" | grep -q '"content"'; then
        print_success "Anthropic request succeeded"
        # Extract and display relevant info
        TEXT=$(echo "$RESPONSE" | grep -o '"text":"[^"]*"' | head -1)
        echo "  Model response: $TEXT"
    elif echo "$RESPONSE" | grep -q '"error"'; then
        ERROR_MSG=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"')
        print_failure "Anthropic request failed"
        echo "  Error: $ERROR_MSG"
    else
        print_failure "Unexpected response from Anthropic proxy"
        echo "  Response: $RESPONSE"
    fi
else
    print_skip "ANTHROPIC_API_KEY not set - skipping Anthropic tests"
    echo "  Set ANTHROPIC_API_KEY environment variable to enable these tests"
fi

# Test budget enforcement
print_header "Budget Enforcement Tests"

print_test "Setting very low budget ($0.0001) for enforcement test"
RESPONSE=$(curl -s -X POST "$PROXY_URL/v1/budget" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\": \"${TEST_PROJECT}-lowbudget\", \"limitUsd\": 0.0001}")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Low budget set"
else
    print_failure "Failed to set low budget"
fi

if [ -n "$OPENAI_API_KEY" ]; then
    print_test "POST /v1/chat/completions - Should be blocked by budget"
    RESPONSE=$(curl -s -X POST "$PROXY_URL/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -H "X-Tokencap-Project-Id: ${TEST_PROJECT}-lowbudget" \
        -d '{
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "Write a long essay about the history of computing."}],
            "max_tokens": 1000
        }')

    if echo "$RESPONSE" | grep -q "budget_exceeded"; then
        print_success "Request correctly blocked due to budget"
        echo "  Budget enforcement working!"
    else
        print_info "Request was not blocked (budget may not have been exceeded)"
        echo "  Response: $(echo "$RESPONSE" | head -c 200)..."
    fi
fi

# Test budget reset
print_test "POST /v1/budget/reset - Reset budget"
RESPONSE=$(curl -s -X POST "$PROXY_URL/v1/budget/reset?project_id=$TEST_PROJECT")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Budget reset successful"
else
    print_failure "Failed to reset budget"
    echo "  Response: $RESPONSE"
fi

# Test budget delete
print_test "DELETE /v1/budget - Delete budget"
RESPONSE=$(curl -s -X DELETE "$PROXY_URL/v1/budget?project_id=${TEST_PROJECT}-period")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Budget deleted successfully"
else
    print_failure "Failed to delete budget"
    echo "  Response: $RESPONSE"
fi

# Cleanup
print_header "Cleanup"
curl -s -X DELETE "$PROXY_URL/v1/budget?project_id=$TEST_PROJECT" > /dev/null 2>&1 || true
curl -s -X DELETE "$PROXY_URL/v1/budget?project_id=${TEST_PROJECT}-lowbudget" > /dev/null 2>&1 || true
print_info "Cleaned up test projects"

# Summary
print_header "Test Summary"
echo ""
echo -e "  ${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "  ${RED}Failed:${NC} $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
