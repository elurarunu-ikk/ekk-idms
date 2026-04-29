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

PARSE_SYSTEM = """You are a construction site data assistant for Indian highway and structure works.
The engineer may speak English, Tamil, or Hindi.

Return ONLY a valid JSON object with this schema:
{
    "work_type": "Road|Structure|Drain|Ancillary|UNKNOWN",
    "structure_type": "Minor Bridge|Major Bridge|Culvert|Flyover|",
    "chainage_from_km": number|"",
    "chainage_from_m": number|"",
    "chainage_to_km": number|"",
    "chainage_to_m": number|"",
    "length_m": number|"",
    "width_m": number|"",
    "depth_m": number|"",
    "element": "FOOTING|FOUNDATION|PIER|PIER_CAP|ABUTMENT|GIRDER|DECK|BEARING|EXPANSION_JOINT|",
    "layer": "Subgrade|GSB|Base Course|Binder Course|Wearing Course|Prime Coat|Tack Coat|",
    "activity": "EXCAVATION|PCC|RCC|REINF|SHUTTER|ERECTION|INSTALLATION|DBM|BC|SDBC|WMM|GSB|EARTHWORK|PRIME_COAT|TACK_COAT|DRAIN|KERB|",
    "quantity": number|"",
    "unit": "CUM|TON|KG|SQM|RM|",
    "road_side": "LHS|RHS|Both|Median|",
    "materials": ["..."],
    "remarks": "string",
    "is_partial_entry": true|false,
    "missing_fields": ["quantity"|"chainage"|"activity"|"work_type"]
}

RELAXED VALIDATION RULES:
- If a field is not clearly present, leave it empty (""). Do NOT guess aggressively.
- work_type: set to "UNKNOWN" if you cannot confidently determine it.
- element/layer: leave empty if missing. Do NOT block output.
- quantity: leave empty unless L, B, D are clearly stated OR an explicit number+unit is spoken.
- unit: only populate if highly confident (known activity with clear quantity). Otherwise leave empty.
- chainage: skip if unclear. Do not force-convert ambiguous numbers.
- Never reject input. Output must always be valid JSON.

Rules:
1) Determine work_type:
- Road: DBM, BC, SDBC, WMM, GSB, Earthwork, Prime coat, Tack coat
- Structure: Pier, Footing, Foundation, Girder, Deck, Abutment, Bearing, RCC/PCC/REINF/SHUTTER
- Drain: drain related
- Ancillary: Kerb, road marking, guard rail
- Else UNKNOWN

2) Chainage formats accepted: "45+100", "45100", "45 hundred". Convert to km and m pairs. Skip if unclear.

3) If both chainages exist and length_m not explicitly given, length_m = to - from in metres.

4) Extract width/depth/length and convert units: mm->/1000, cm->/100.

5) Quantity (conservative):
- Road: ONLY if length, width, AND depth all exist -> quantity=length*width*depth, unit=CUM
- For DBM/BC/SDBC with explicit TON quantity spoken, keep TON quantity
- Structure: ONLY if RCC/PCC and ALL of L, B, D exist -> quantity=L*B*D, unit=CUM
- Otherwise leave quantity AND unit empty

6) Layer map:
- Earthwork->Subgrade, GSB->GSB, WMM->Base Course, DBM->Binder Course,
    BC/SDBC->Wearing Course, Prime coat->Prime Coat, Tack coat->Tack Coat

7) Element map:
- footing->FOOTING, foundation->FOUNDATION, pier->PIER, pier cap->PIER_CAP,
    abutment->ABUTMENT, girder->GIRDER, slab/deck->DECK, bearing->BEARING,
    expansion joint->EXPANSION_JOINT

8) Activity map:
- excavation->EXCAVATION, pcc->PCC, rcc->RCC, steel/rebar->REINF,
    shuttering/formwork->SHUTTER, erection->ERECTION, installation->INSTALLATION

9) Unit map (only when quantity is computed/stated):
- RCC/PCC/EXCAVATION->CUM, REINF->KG, SHUTTER->SQM,
    DBM/BC/SDBC->TON, PRIME_COAT/TACK_COAT->SQM, KERB/DRAIN->RM

10) Materials map:
- RCC -> [CEMENT, STEEL, AGGREGATE, SAND, WATER]
- PCC -> [CEMENT, AGGREGATE, SAND, WATER]
- DBM/BC/SDBC -> [BITUMEN, AGGREGATE]
- WMM/GSB -> [AGGREGATE]
- REINF -> [STEEL]

11) road_side: LHS/RHS/Both/Median when explicitly spoken.

12) is_partial_entry and missing_fields:
- Add "quantity" to missing_fields if quantity is empty
- Add "chainage" to missing_fields if work_type is Road and no chainage was parsed
- Set is_partial_entry to true if missing_fields is non-empty

Do not include markdown, explanations, or extra keys."""


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
            max_tokens=700,
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
