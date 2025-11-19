#!/usr/bin/env python3
"""
HTTP Server with proper Range Request support for video seeking
"""

import http.server
import socketserver
import os
import re
from pathlib import Path

class RangeRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler with Range request support"""
    
    def send_head(self):
        """
        Override to add proper Range request handling for video files
        """
        path = self.translate_path(self.path)
        
        if not os.path.exists(path):
            return super().send_head()
        
        # Check if this is a range request
        range_header = self.headers.get('Range')
        
        if range_header is None or not os.path.isfile(path):
            # No range request or not a file - use default behavior
            return super().send_head()
        
        # Parse the range header
        try:
            # Range header format: "bytes=start-end"
            range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)
            if not range_match:
                return super().send_head()
            
            file_size = os.path.getsize(path)
            start = int(range_match.group(1))
            end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
            
            # Validate range
            if start >= file_size or end >= file_size or start > end:
                self.send_error(416, "Requested Range Not Satisfiable")
                return None
            
            # Open file and seek to start position
            f = open(path, 'rb')
            f.seek(start)
            
            # Send proper headers for partial content
            self.send_response(206, "Partial Content")
            
            # Guess content type
            ctype = self.guess_type(path)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            self.send_header("Content-Length", str(end - start + 1))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            
            return f
            
        except Exception as e:
            print(f"Error handling range request: {e}")
            return super().send_head()
    
    def end_headers(self):
        # Add CORS headers if needed
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def run_server(port=8000):
    """Start the server"""
    Handler = RangeRequestHandler
    
    with socketserver.TCPServer(("", port), Handler) as httpd:
        print(f"╔═══════════════════════════════════════════════════════════╗")
        print(f"║     Video Evaluation Server (with Range Support)         ║")
        print(f"╚═══════════════════════════════════════════════════════════╝")
        print(f"")
        print(f"✓ Server running on port {port}")
        print(f"✓ Range requests: ENABLED (videos will seek properly)")
        print(f"")
        print(f"┌─────────────────────────────────────────────────────────┐")
        print(f"│  🌐 Open in your browser:                               │")
        print(f"│                                                         │")
        print(f"│     http://localhost:{port}/video_evaluation.html         │")
        print(f"│                                                         │")
        print(f"└─────────────────────────────────────────────────────────┘")
        print(f"")
        print(f"🛑 Press Ctrl+C to stop the server")
        print(f"════════════════════════════════════════════════════════════")
        print(f"")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n🛑 Server stopped")

if __name__ == '__main__':
    # Change to the directory where this script is located
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    run_server(8000)

