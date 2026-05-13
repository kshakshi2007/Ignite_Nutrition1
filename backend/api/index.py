"""
Ignite Nutrition — Vercel Serverless Entry Point
This file is used by Vercel's Python Runtime.
"""
import sys
import os
from pathlib import Path

# Add this file's directory to Python path so 'server' can be imported
api_dir = Path(__file__).parent
backend_dir = api_dir.parent
sys.path.insert(0, str(backend_dir))

from server import app

# Vercel expects 'app' as the ASGI application
handler = app