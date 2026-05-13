"""
Ignite Nutrition — Vercel Serverless Entry Point
This file wraps the FastAPI app for Vercel Python Runtime.
"""
import sys
import os
from pathlib import Path

# Add the backend root directory to Python path so imports work
sys.path.insert(0, str(Path(__file__).parent.parent))

from server import app

# Vercel expects a variable called 'app' — FastAPI instance
# Already imported above

# For Vercel's serverless function handler
handler = app