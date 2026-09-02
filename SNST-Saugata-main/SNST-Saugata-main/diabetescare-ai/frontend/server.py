"""
Simple HTTP server to serve the frontend
Run this file to start the frontend server
"""
import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

# Configuration
PORT = 3000
DIRECTORY = Path(__file__).parent

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)
    
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def main():
    """Start the frontend server"""
    os.chdir(DIRECTORY)
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print("=" * 70)
        print("🚀 DiabetesCare AI Frontend Server")
        print("=" * 70)
        print(f"📂 Serving directory: {DIRECTORY}")
        print(f"🌐 Server running at: http://localhost:{PORT}")
        print(f"📱 Open in browser: http://localhost:{PORT}/index.html")
        print("=" * 70)
        print("Press Ctrl+C to stop the server")
        print("=" * 70)
        
        # Open browser automatically
        try:
            webbrowser.open(f'http://localhost:{PORT}/index.html')
            print("✅ Browser opened automatically")
        except:
            print("⚠️  Please open http://localhost:{PORT}/index.html in your browser")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n🛑 Server stopped")
            print("Thank you for using DiabetesCare AI!")

if __name__ == "__main__":
    main()
