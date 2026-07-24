"""
PulsePatrika - AI Microservice
==============================
FastAPI service that powers the AI features of the newsroom platform.

This is a SCAFFOLD. Each endpoint returns a sensible, well-structured
mock/heuristic response so the rest of the system works end-to-end today.
Every place that needs a real model call is marked with:  # >>> INTEGRATION POINT

To go to production:
  1. pip install -r requirements.txt
  2. Set OPENAI_API_KEY (and others) in .env
  3. Replace the heuristic blocks under each INTEGRATION POINT with real calls
     (OpenAI, Whisper, Tesseract, LangChain, etc.)

Run:  uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""

import os
import re
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Optional: load .env if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

app = FastAPI(title="Patrika Newsroom AI Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class AssistantQuery(BaseModel):
    question: str
    edition: Optional[str] = None
    role: Optional[str] = None
    lang: Optional[str] = "en"


class ContentPayload(BaseModel):
    title: Optional[str] = ""
    body: str
    lang: Optional[str] = "hi"


class TranscriptionResult(BaseModel):
    text: str
    language: str
    summary: str
    quotes: List[str]


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/")
def health():
    return {
        "service": "patrika-ai",
        "status": "ok",
        "openai_configured": bool(OPENAI_API_KEY),
    }


# ---------------------------------------------------------------------------
# A. Newsroom Assistant (chatbot)
# ---------------------------------------------------------------------------
@app.post("/assistant")
def assistant(q: AssistantQuery):
    """
    Natural-language management assistant.
    >>> INTEGRATION POINT: route q.question through LangChain + SQL agent
        so the model can query MySQL and answer with live data.
    """
    text = q.question.lower()

    # Lightweight intent routing so the demo feels real without a model.
    if "delay" in text or "देरी" in text:
        answer = ("2 editions are running late today: Jaipur front page "
                  "(closed 23 min late) and Kota city pages (12 min late). "
                  "Production tracker shows plate release as the main bottleneck.")
    elif "front" in text and "page" in text:
        answer = ("Top front-page contributor this week: Rajesh Sharma "
                  "(7 front-page stories), followed by Priya Verma (5).")
    elif "low" in text and "quality" in text:
        answer = ("3 stories scored below grade B today. Most common issues: "
                  "weak headlines and readability. See AI Insights → Quality.")
    elif "legal" in text:
        answer = ("Jaipur edition has 2 open legal cases; the nearest hearing "
                  "is in 4 days (Case PAT-2024-014, High Court).")
    else:
        answer = ("I can report on delayed editions, reporter productivity, "
                  "content quality and legal cases. Ask me about any of those.")

    return {"answer": answer, "source": "heuristic-stub", "lang": q.lang}


# ---------------------------------------------------------------------------
# B. Content Quality Checker
# ---------------------------------------------------------------------------
@app.post("/content/quality")
def content_quality(p: ContentPayload):
    """
    Grammar, headline score, readability, sentiment, risk flags, summary, tags.
    >>> INTEGRATION POINT: replace heuristics with an OpenAI call returning
        a structured JSON grade card.
    """
    words = re.findall(r"\w+", p.body)
    wc = len(words)
    sentences = max(1, len(re.split(r"[.!?।]", p.body)) - 1)
    avg_sent_len = wc / sentences if sentences else wc

    # Crude readability proxy: shorter sentences => higher score.
    readability = max(0, min(100, int(110 - avg_sent_len * 3)))

    # Crude headline score from length.
    hl = (p.title or "").strip()
    hl_words = len(hl.split())
    headline_score = 90 if 5 <= hl_words <= 12 else (70 if hl_words else 40)

    risk_words = ["alleged", "scam", "fraud", "arrest", "हत्या", "घोटाला", "विवाद"]
    legal_flags = [w for w in risk_words if w in p.body.lower()]

    score = int((readability * 0.4) + (headline_score * 0.4) + (min(wc, 400) / 400 * 100 * 0.2))
    grade = "A+" if score >= 90 else "A" if score >= 80 else "B" if score >= 65 else "C"

    return {
        "grade": grade,
        "score": score,
        "word_count": wc,
        "readability": readability,
        "headline_score": headline_score,
        "sentiment": "neutral",          # >>> INTEGRATION POINT: real sentiment
        "duplicate_risk": "low",         # >>> INTEGRATION POINT: embeddings dedupe
        "fake_news_risk": "low",         # >>> INTEGRATION POINT: classifier
        "legal_risk_words": legal_flags,
        "political_sensitivity": "medium" if legal_flags else "low",
        "summary": (p.body[:160] + "…") if len(p.body) > 160 else p.body,
        "tags": ["news"],                # >>> INTEGRATION POINT: model tags
        "source": "heuristic-stub",
    }


# ---------------------------------------------------------------------------
# C. Trending topic suggestions
# ---------------------------------------------------------------------------
@app.get("/trends")
def trends(edition: Optional[str] = None):
    """
    >>> INTEGRATION POINT: pull Google Trends / X(Twitter) / competitor feeds.
    """
    return {
        "edition": edition or "all",
        "trending": [
            {"topic": "Monsoon preparedness", "heat": 92, "suggestion": "Local civic angle + archive 2023 floods"},
            {"topic": "State budget reactions", "heat": 81, "suggestion": "Reactions from local traders"},
            {"topic": "Cricket series", "heat": 76, "suggestion": "Fan reaction page + stats box"},
        ],
        "source": "heuristic-stub",
    }


# ---------------------------------------------------------------------------
# D. Production delay prediction
# ---------------------------------------------------------------------------
@app.get("/production/predict")
def predict_delay(edition: Optional[str] = None):
    """
    >>> INTEGRATION POINT: train a model on historical production_logs and
        predict the probability of an SLA breach for tonight's run.
    """
    return {
        "edition": edition or "Jaipur",
        "predicted_delay_minutes": 18,
        "confidence": 0.71,
        "likely_bottleneck": "plate_release",
        "recommendation": "Start city pages 20 min earlier; pre-clear ad blocks.",
        "source": "heuristic-stub",
    }


# ---------------------------------------------------------------------------
# E. OCR (e-paper / scanned pages)
# ---------------------------------------------------------------------------
@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    """
    >>> INTEGRATION POINT: run Tesseract / pytesseract on the uploaded image
        or PDF page and return extracted text + headline regions.
    """
    data = await file.read()
    return {
        "filename": file.filename,
        "bytes": len(data),
        "text": "[OCR stub] Connect Tesseract to extract page text here.",
        "headlines": [],
        "ad_ratio": 0.32,
        "news_ratio": 0.68,
        "source": "stub",
    }


# ---------------------------------------------------------------------------
# F. Speech-to-text (Hindi transcription of MD speeches/videos)
# ---------------------------------------------------------------------------
@app.post("/transcribe", response_model=TranscriptionResult)
async def transcribe(file: UploadFile = File(...)):
    """
    >>> INTEGRATION POINT: run Whisper on the uploaded audio/video, then
        summarise + extract quotes with OpenAI.
    """
    data = await file.read()
    _ = len(data)
    return TranscriptionResult(
        text="[Whisper stub] Hindi transcription will appear here once Whisper is wired.",
        language="hi",
        summary="[AI summary stub] Key points of the speech.",
        quotes=["[Quote extraction stub]"],
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
