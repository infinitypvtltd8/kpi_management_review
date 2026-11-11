#!/usr/bin/env python3
"""Serve only the single-file KPI dashboard for the workspace preview."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

DASHBOARD = Path(__file__).resolve().parent / "kpi-bi" / "index.html"


class DashboardHandler(BaseHTTPRequestHandler):
    def serve_dashboard(self, send_body):
        if urlsplit(self.path).path not in ("/", "/index.html"):
            self.send_error(404)
            return
        try:
            content = DASHBOARD.read_bytes()
        except OSError:
            self.send_error(500, "Dashboard file is unavailable")
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if send_body:
            self.wfile.write(content)

    def do_GET(self):
        self.serve_dashboard(True)

    def do_HEAD(self):
        self.serve_dashboard(False)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8000), DashboardHandler)
    print("KPI dashboard preview listening on port 8000", flush=True)
    server.serve_forever()
