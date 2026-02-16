#!/usr/bin/env python3
"""Local Voice API Server - handles transcription and TTS"""

import os
import base64
import uuid
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from faster_whisper import WhisperModel
import subprocess
import sys

# Configuration
PORT = 18791
TTS_SCRIPT = "/home/anmol/.local/bin/kokoro-tts.py"
TTS_VOICE = "af_bella"

# Load Whisper model once at startup
print("Loading Whisper model...")
whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8")
print("Whisper model loaded!")

class VoiceHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/transcribe":
            self.handle_transcribe()
        elif self.path == "/tts":
            self.handle_tts()
        else:
            self.send_error(404, "Not found")
    
    def handle_transcribe(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        
        try:
            # Decode base64 audio
            audio_data = base64.b64decode(body)
            
            # Save to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                f.write(audio_data)
                temp_path = f.name
            
            # Transcribe
            segments, info = whisper_model.transcribe(temp_path)
            text = " ".join([s.text.strip() for s in segments])
            
            # Cleanup
            os.unlink(temp_path)
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"text": text, "language": info.language}).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def handle_tts(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        data = json.loads(body)
        text = data.get("text", "")
        voice = data.get("voice", TTS_VOICE)
        
        try:
            # Generate TTS
            result = subprocess.run(
                [sys.executable, TTS_SCRIPT, text, "--voice", voice],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                raise Exception(result.stderr)
            
            # Read the generated audio file
            output_path = result.stdout.strip()
            with open(output_path, "rb") as f:
                audio_data = f.read()
            
            # Encode as base64
            audio_b64 = base64.b64encode(audio_data).decode()
            
            # Cleanup
            if os.path.exists(output_path):
                os.unlink(output_path)
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"audio": audio_b64}).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def log_message(self, format, *args):
        print(f"[Voice API] {format % args}")

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), VoiceHandler)
    print(f"Local Voice API running on port {PORT}")
    print(f"TTS Script: {TTS_SCRIPT}")
    server.serve_forever()
