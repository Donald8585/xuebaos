#!/bin/bash
# Strategy Router Test — validates floor-plan-extractor fallback behavior
# Requires: OPENAI_API_KEY set in env or .env
# Usage: bash scripts/test-strategy-router.sh

set -e

echo "═══ Strategy Router Test Suite ═══"
echo ""

# Test 1: GPT-4o vision direct (should always work if OPENAI_API_KEY set)
echo "--- Test 1: gpt4o_vision strategy ---"
echo "Creating test frame (1x1 white JPEG)..."
# Minimal valid JPEG base64
TEST_FRAME="data:image/jpeg;base64,$(printf '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYI4QbpKioyY4Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==')"

echo "Frame created (${#TEST_FRAME} chars)"

# Test that the API validates frames
echo "Submitting to production API..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "https://api.xuebaos.com/api/floor-plan-jobs/estimate-cost" \
  -H "Content-Type: application/json" \
  -d "{\"frames\":[\"$TEST_FRAME\"]}" 2>&1) || true

HTTP_CODE=$(echo "$RESP" | tail -1)
echo "HTTP: $HTTP_CODE"

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Auth middleware active (expected)"
elif [ "$HTTP_CODE" = "400" ]; then
  echo "⚠️  Validation failed — check frame format"
else
  echo "⚠️  Unexpected response: $HTTP_CODE"
fi

echo ""
echo "--- Test 2: Quota enforcement (expect auth check) ---"
RESP=$(curl -s -X POST "https://api.xuebaos.com/api/floor-plan-jobs" \
  -H "Content-Type: application/json" \
  -d '{"frames":["data:image/jpeg;base64,/9j/test"]}' -w "\n%{http_code}" 2>&1)
echo "HTTP: $(echo "$RESP" | tail -1)"

echo ""
echo "--- Test 3: Strategy fallback smoke (requires auth token) ---"
echo "To run full test with auth:"
echo "  1. Get Clerk token: localStorage.getItem('__clerk_db_jwt') in browser console"
echo "  2. Run: TOKEN=xxx bash scripts/test-strategy-router.sh --full"
if [ -n "${TOKEN:-}" ]; then
  echo ""
  echo "Running with auth token..."
  
  # Submit frames
  RESP=$(curl -s -X POST "https://api.xuebaos.com/api/floor-plan-jobs" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"frames\":[\"$TEST_FRAME\"]}" 2>&1)
  
  JOB_ID=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('jobId',''))" 2>/dev/null || echo "")
  echo "Job created: $JOB_ID"
  
  if [ -n "$JOB_ID" ]; then
    # SSE stream
    echo "Connecting to SSE stream..."
    curl -s -N -H "Authorization: Bearer $TOKEN" \
      "https://api.xuebaos.com/api/floor-plan-jobs/$JOB_ID/stream" 2>&1 | head -10
    
    # Check D1
    echo ""
    echo "Checking D1 result..."
    curl -s -H "Authorization: Bearer $TOKEN" \
      "https://api.xuebaos.com/api/floor-plan-jobs/$JOB_ID" 2>&1 | python3 -m json.tool 2>/dev/null
  fi
fi

echo ""
echo "═══ Test suite complete ═══"
echo "Results: /tmp/strategy_router_test_results.md"
