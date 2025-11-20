#!/bin/bash

# This will be replaced by GitHub Actions during deployment
GOOGLE_SHEETS_URL="{{GOOGLE_SHEETS_URL}}"

# Test data
TEST_DATA='{
  "evaluatorId": "TEST_001",
  "timestamp": "2025-11-20T10:30:00.000Z",
  "comparisonIndex": 1,
  "videoA": "InfinityStory/episode_01.mp4",
  "videoB": "MovieAgent/episode_01.mp4", 
  "videoC": "Video-Gen-of-Thought/episode_01.mp4",
  "actualOrder": ["A", "B", "C"],
  "bgConsistency": "A",
  "transitions": "A",
  "characters": "B",
  "motion": "A",
  "aesthetic": "A"
}'

echo "🧪 Testing Google Sheets Integration..."
echo "Sending test data to: $GOOGLE_SHEETS_URL"
echo ""

# Send POST request
RESPONSE=$(curl -s -L -X POST "$GOOGLE_SHEETS_URL" \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA")

echo "Response: $RESPONSE"
echo ""
echo "✅ Check your Google Sheet for new data at your spreadsheet URL"

