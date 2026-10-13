"""Local-only editing server for the static Jasper Tang portfolio."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent.parent
PORT = 8765
EDITABLE_PAGES = {
    "home": ROOT / "index.html",
    "analog": ROOT / "projects" / "analog-music-light-interface.html",
    "heat": ROOT / "projects" / "cuda-heat-simulation.html",
    "music": ROOT / "projects" / "music-synthesizer.html",
    "neutrino": ROOT / "projects" / "neutrino-simulation.html",
    "photography": ROOT / "projects" / "photography.html",
    "physics": ROOT / "projects" / "physics-simulation.html",
    "vector": ROOT / "projects" / "vector-compute-engine.html",
}


class PortfolioHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if urlparse(self.path).path == "/admin":
            self.send_response(302)
            self.send_header("Location", "/tools/editor.html")
            self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/__save":
            self.send_error(404)
            return

        if self.headers.get_content_type() != "application/json":
            self.send_error(415, "Expected application/json")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400, "Invalid content length")
            return
        if length <= 0 or length > 2_000_000:
            self.send_error(413, "Page content is empty or too large")
            return

        try:
            payload = json.loads(self.rfile.read(length))
            page = EDITABLE_PAGES[payload["page"]]
            html = payload["html"]
            if not isinstance(html, str) or "</html>" not in html.lower():
                raise ValueError("The editor did not provide a complete HTML page")
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
            self.send_error(400, str(error))
            return

        temporary = page.with_name(f".{page.name}.editor-tmp")
        try:
            temporary.write_text(html, encoding="utf-8", newline="\n")
            os.replace(temporary, page)
        except OSError as error:
            temporary.unlink(missing_ok=True)
            self.send_error(500, f"Could not save the page: {error}")
            return

        response = json.dumps({"saved": True}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(response)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), PortfolioHandler)
    print(f"Portfolio editor: http://127.0.0.1:{PORT}/admin")
    print("Local computer only. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nPortfolio editor stopped.")
    finally:
        server.server_close()
