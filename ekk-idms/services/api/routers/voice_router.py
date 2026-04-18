import os
import json
import tempfile
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from openai import OpenAI

from auth import verify_token

router = APIRouter()

ALLOWED_AUDIO_EXTENSIONS = {".m4a", ".mp4", ".mp3", ".wav", ".webm", ".ogg", ".caf"}
MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MB (Whisper API limit)

PARSE_SYSTEM = """You are a construction site data assistant for a road project in India.
The engineer speaks a mix of English, Tamil, and Hindi.

Extract form fields from the transcript and return ONLY a valid JSON object.
Fields:
- activity_code: one of EW, GSB, WMM, WBM, DBM, BC, SDBC, KERB, DRAIN  (or null)
- stage: one of SUBGRADE, GSB, WMM, WBM, BASE_COURSE, DBM, BC, SDBC (or null)
- chainage_from: decimal km number (e.g. "1+200" → 1.200) or null
- chainage_to:   decimal km number or null
- road_side: one of LHS, RHS, Both, Median (or null). "left"/"இடது" = LHS, "right"/"வலது" = RHS, "both"/"இரு பக்கம்" = Both
- contractor_name: string or null
- rfi_number: integer or null
- layer_section: string like "L1" or null
- remarks: free-text capturing weather / delays / issues / progress, or null

Chainage conversion rules:
- "1+200" or "1 plus 200" → 1.200
- "kilometer 5 plus 400" → 5.400
- spoken Tamil "ஒன்று பிளஸ் இரண்டு நூறு" → 1.200

Return ONLY JSON, no markdown fences."""


def _get_openai() -> OpenAI:
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured on server")
    return OpenAI(api_key=key)


@router.post("/transcribe")
async def transcribe_voice(
    file: UploadFile = File(...),
    lang_hint: Optional[str] = Form(default=None),
    payload: dict = Depends(verify_token),
):
    # ── Validate file ────────────────────────────────────────────────────────
    filename = file.filename or "audio.m4a"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format '{ext}'. Allowed: {', '.join(ALLOWED_AUDIO_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file exceeds 25 MB limit")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    client = _get_openai()

    # ── Write to temp file (Whisper needs a file object) ─────────────────────
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # ── Step 1: Whisper transcription ─────────────────────────────────────
        # language=None → Whisper auto-detects (best for mixed Tamil/Hindi/English)
        with open(tmp_path, "rb") as audio_file:
            whisper_resp = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=None,
                response_format="text",
                prompt=(
                    "Construction site field data. "
                    "Chainage format: 1+200, 1+450. "
                    "Activities: GSB, WMM, DBM, BC, EW, KERB, DRAIN. "
                    "Mixed English, Tamil, Hindi speech."
                ),
            )
        transcript = (whisper_resp.strip() if isinstance(whisper_resp, str) else str(whisper_resp)).strip()

        # ── Step 2: GPT-4o-mini structured parsing ────────────────────────────
        gpt_resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": PARSE_SYSTEM},
                {"role": "user",   "content": f"Transcript: {transcript}"},
            ],
            temperature=0,
            max_tokens=300,
            response_format={"type": "json_object"},
        )
        parsed_raw = gpt_resp.choices[0].message.content or "{}"
        parsed = json.loads(parsed_raw)

        return {
            "transcript": transcript,
            "parsed": parsed,
            "source": "whisper+gpt",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice transcription failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
