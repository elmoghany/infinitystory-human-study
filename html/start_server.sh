#!/bin/bash
# Video Evaluation Server Startup Script

cd "$(dirname "$0")"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     Video Generation Evaluation System - Server Start    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "🔍 Checking files..."

# Check required files
files_ok=true
for file in evaluation_config.json evaluation_script.js evaluation_styles.css video_evaluation.html; do
    if [ -f "$file" ]; then
        size=$(ls -lh "$file" | awk '{print $5}')
        echo "  ✓ $file ($size)"
    else
        echo "  ✗ $file - MISSING!"
        files_ok=false
    fi
done

# Check video clips
clip_count=$(find clips -name "*.mp4" 2>/dev/null | wc -l)
echo "  ✓ Video clips: $clip_count files"
echo ""

if [ "$files_ok" = false ]; then
    echo "❌ Missing required files! Please check the installation."
    exit 1
fi

echo "📂 Working directory: $(pwd)"
echo ""

# Kill any existing Python HTTP servers on port 8000
echo "🔍 Checking for existing servers on port 8000..."
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 8000 is already in use. Killing existing server..."
    # Try multiple methods to kill the process
    pkill -9 -f "python.*http.server.*8000" 2>/dev/null || true
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    fuser -k 8000/tcp 2>/dev/null || true
    sleep 2
    
    # Verify it's killed
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ Failed to kill existing server. Please run manually:"
        echo "   sudo fuser -k 8000/tcp"
        exit 1
    else
        echo "✓ Existing server killed"
    fi
    echo ""
else
    echo "✓ Port 8000 is available"
    echo ""
fi

echo "🚀 Starting HTTP server on port 8000..."
echo ""
echo "┌─────────────────────────────────────────────────────────┐"
echo "│  🌐 Open in your browser:                               │"
echo "│                                                         │"
echo "│     http://localhost:8000/video_evaluation.html         │"
echo "│                                                         │"
echo "│  Or for EGTEA system:                                   │"
echo "│     http://localhost:8000/                              │"
echo "└─────────────────────────────────────────────────────────┘"
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo "════════════════════════════════════════════════════════════"
echo ""

# Start the server
python3 -m http.server 8000

