from pathlib import Path

from flask import Flask, send_from_directory


DIST_DIR = Path(__file__).resolve().parent / "dist"
app = Flask(__name__, static_folder=None)


@app.get("/")
def index():
    return send_from_directory(DIST_DIR, "index.html")


@app.get("/<path:path>")
def static_files(path: str):
    requested = DIST_DIR / path
    if requested.is_file():
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7860, debug=True)
