#!/usr/bin/env python3
"""
Local Whisper API server for SoMe-plattformen.
Receives video/audio URL, extracts audio with ffmpeg, transcribes with Whisper.
Handles large files that exceed OpenAI's 25MB limit.

Usage: python3 whisper-server.py [--port 8787] [--model small]
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import urlopen, Request
from urllib.error import URLError

# Whisper import
try:
    import whisper
except ImportError:
    print("ERROR: openai-whisper not installed. Run: pip install openai-whisper")
    sys.exit(1)

MODEL = None
MODEL_NAME = "small"

def load_model(name: str):
    global MODEL, MODEL_NAME
    MODEL_NAME = name
    print(f"Loading Whisper model '{name}'...")
    MODEL = whisper.load_model(name)
    print(f"Model '{name}' loaded ✓")

def download_file(url: str, dest: str) -> bool:
    """Download a file from URL to dest path."""
    try:
        req = Request(url, headers={"User-Agent": "whisper-server/1.0"})
        with urlopen(req, timeout=120) as resp, open(dest, "wb") as f:
            while True:
                chunk = resp.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                f.write(chunk)
        return True
    except (URLError, OSError) as e:
        print(f"Download error: {e}")
        return False

def extract_audio(video_path: str, audio_path: str) -> bool:
    """Extract audio from video using ffmpeg."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-i", video_path, "-vn", "-acodec", "pcm_s16le",
             "-ar", "16000", "-ac", "1", audio_path, "-y"],
            capture_output=True, text=True, timeout=120
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print(f"FFmpeg error: {e}")
        return False

def transcribe(audio_path: str, language: str = "no") -> dict:
    """Transcribe audio file with Whisper."""
    result = MODEL.transcribe(audio_path, language=language, verbose=False)
    segments = []
    for seg in result.get("segments", []):
        segments.append({
            "start": round(seg["start"], 2),
            "end": round(seg["end"], 2),
            "text": seg["text"].strip(),
        })
    return {
        "text": result["text"].strip(),
        "segments": segments,
        "language": result.get("language", language),
        "duration": segments[-1]["end"] if segments else 0,
        "model": MODEL_NAME,
    }

class WhisperHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/transcribe":
            self.send_error(404)
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self._respond(400, {"error": "Invalid JSON"})
            return

        video_url = data.get("video_url")
        language = data.get("language", "no")

        if not video_url:
            self._respond(400, {"error": "video_url is required"})
            return

        # Auth check
        auth_token = os.environ.get("WHISPER_API_TOKEN")
        if auth_token:
            provided = self.headers.get("Authorization", "").replace("Bearer ", "")
            if provided != auth_token:
                self._respond(401, {"error": "Unauthorized"})
                return

        print(f"[{time.strftime('%H:%M:%S')}] Transcribe request: {video_url[:80]}...")

        with tempfile.TemporaryDirectory() as tmpdir:
            video_path = os.path.join(tmpdir, "input_video")
            audio_path = os.path.join(tmpdir, "audio.wav")

            # Download video
            print(f"  Downloading video...")
            start = time.time()
            if not download_file(video_url, video_path):
                self._respond(500, {"error": "Could not download video"})
                return

            video_size = os.path.getsize(video_path)
            print(f"  Downloaded {video_size / 1024 / 1024:.1f}MB in {time.time() - start:.1f}s")

            # Extract audio
            print(f"  Extracting audio...")
            if not extract_audio(video_path, audio_path):
                self._respond(500, {"error": "Could not extract audio (ffmpeg)"})
                return

            audio_size = os.path.getsize(audio_path)
            print(f"  Audio: {audio_size / 1024:.0f}KB")

            # Transcribe
            print(f"  Transcribing with model '{MODEL_NAME}'...")
            start = time.time()
            try:
                result = transcribe(audio_path, language)
            except Exception as e:
                print(f"  Transcription error: {e}")
                self._respond(500, {"error": f"Transcription failed: {str(e)}"})
                return

            elapsed = time.time() - start
            print(f"  Done in {elapsed:.1f}s — {len(result['text'])} chars, {len(result['segments'])} segments")

            result["success"] = True
            self._respond(200, result)

    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"status": "ok", "model": MODEL_NAME})
        else:
            self.send_error(404)

    def _respond(self, code: int, data: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        pass  # Suppress default logging

def main():
    parser = argparse.ArgumentParser(description="Local Whisper API server")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--model", default="small", choices=["tiny", "base", "small", "medium", "large"])
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    load_model(args.model)

    server = HTTPServer((args.host, args.port), WhisperHandler)
    print(f"Whisper API server running on http://{args.host}:{args.port}")
    print(f"  POST /transcribe  — transcribe video/audio")
    print(f"  GET  /health      — health check")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()

if __name__ == "__main__":
    main()
