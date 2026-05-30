import os
import json
import logging
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from openai import OpenAI

from auth import verify_token

router = APIRouter()

ALLOWED_AUDIO_EXTENSIONS = {".m4a", ".mp4", ".mp3", ".wav", ".webm", ".ogg", ".caf"}
MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MB (Whisper API limit)

PARSE_SYSTEM = """You are a construction site data assistant for Indian highway and structure works.
The engineer may speak any Indian language. Common terms by language:
- Hindi: mazdoor/majdoor=unskilled worker, ghante=hours, lagaya=laid/placed, mistri/mistry=mason,
  raat ki paali=night shift, din ki paali=day shift, pura=completed, shuru=started,
  baarish=rain, teen=3, paanch=5, aath=8, das=10, bees=20
- Tamil: thozhilalar=worker, iranthu=two, moonru=three, ainthu=five, ettu=eight,
  manal=sand, simmenttu=cement, irumbu=steel, maalai paali=evening/night shift
- Telugu: pillalu=workers, rendu=2, moodu=3, aidu=5, enimidi=8, idu=sand, cements=cement
- Kannada: karmikaru=workers, eradu=2, mooru=3, aidu=5, entu=8, maru=sand
- Malayalam: thozhilalikal=workers, randu=2, moonu=3, anju=5, ettu=8, manal=sand
- Marathi: mazdoor/kamgar=worker, teen=3, panch=5, aath=8, das=10, rat paali=night shift
All other rules below apply regardless of input language.

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
    "layer": "SUBGRADE|GSB|CTSB|CTB|WMM|BASE|BINDER|WEARING|PRIME|TACK|SHOULDER|MEDIAN|EMBANKMENT|",
    "activity": "EXCAVATION|PCC|RCC|REINF|SHUTTER|ERECTION|INSTALLATION|DBM|BC|SDBC|WMM|GSB|CTSB|CTB|EARTHWORK|PRIME_COAT|TACK_COAT|DRAIN|KERB|",
    "quantity": number|"",
    "unit": "CUM|MT|KG|SQM|LM|BAG|NOS|LTR|",
    "road_side": "LHS|RHS|Both|Median|",
    "materials": ["CEMENT","STEEL",...],
    "remarks": "string",
    "is_partial_entry": true|false,
    "missing_fields": ["quantity"|"chainage"|"activity"|"work_type"],
    "materials_used": [
        {"material_code": "WMM", "quantity": 45, "unit": "CUM", "source": "crusher or null"}
    ],
    "machines_deployed": [
        {"machine_code": "ROLLER", "hours": 8, "operator_name": "Ravi or null", "count": 1}
    ],
    "manpower_deployed": [
        {"category": "SKILLED|SEMISKILLED|UNSKILLED|MASON|CARPENTER|ELECTRICIAN|WELDER|HELPER|OPERATOR|SUPERVISOR|ENGINEER",
         "count": 12, "shift_type": "DAY|NIGHT|GENERAL"}
    ]
}

RELAXED VALIDATION RULES:
- If a field is not clearly present, leave it empty (""). Do NOT guess aggressively.
- work_type: set to "UNKNOWN" if you cannot confidently determine it.
- element/layer: leave empty if missing. Do NOT block output.
- quantity: leave empty unless explicitly spoken or computable from L×B×D.
- Never reject input. Output must always be valid JSON.

FIELD RULES:

1) work_type: Road=DBM/BC/SDBC/WMM/GSB/CTSB/CTB/Earthwork/Embankment/Filling/Compaction/Prime coat/Tack coat;
   Structure=Pier/Footing/Foundation/Girder/Deck/RCC/PCC/REINF/SHUTTER; Drain; Ancillary=Kerb/guard rail
   "Embankment filling" → work_type=Road, activity=EARTHWORK, layer=EMBANKMENT
   "CTSB laying" → work_type=Road, activity=SPREADING, layer=CTSB
   "CTB compaction" → work_type=Road, activity=COMPACTION, layer=CTB

2) Chainage: "45+100", "45100", "45 hundred" → km=45, m=100. Skip if unclear.

3) length_m = chainage to − from (metres) when both present and length not explicit.

4) Dimensions: convert mm→/1000, cm→/100.

5) Quantity: Road with L+W+D → L×W×D CUM; DBM/BC/SDBC explicit TON → keep; Structure RCC/PCC with L+W+D → L×W×D CUM; else leave empty.

6) Layer codes — use EXACTLY these codes:
   Earthwork/Embankment→SUBGRADE, GSB→GSB, CTSB→CTSB, CTB→CTB,
   WMM→WMM, DBM→BINDER, BC/SDBC→WEARING,
   Prime coat→PRIME, Tack coat→TACK, Shoulder→SHOULDER, Median→MEDIAN.
   Engineers say abbreviations: "BC" means WEARING, "DBM" means BINDER, "WMM" means WMM.

7) materials_used — extract EVERY material explicitly mentioned with quantity and unit:
   - "45 cum WMM from crusher" → {material_code:"WMM", quantity:45, unit:"CUM", source:"crusher"}
   - "10 bags cement" → {material_code:"CEMENT", quantity:10, unit:"BAG", source:null}
   - "30 ton GSB" → {material_code:"GSB", quantity:30, unit:"MT", source:null}
   - "20 ton bitumen" → {material_code:"BITUMEN", quantity:20, unit:"MT", source:null}
   - Hindi numbers: aath=8, teen=3, das=10, barah=12, bees=20, tees=30
   - Leave [] if no materials explicitly spoken with quantities.

8) machines_deployed — extract EVERY machine with hours:
   - "roller 8 hours operator Ravi" → {machine_code:"ROLLER", hours:8, operator_name:"Ravi", count:1}
   - "roller aath ghante" → hours=8 (ghante=hours in Hindi)
   - "paver 4 hours" → {machine_code:"PAVER", hours:4, operator_name:null, count:1}
   - "jcb 5 hours" → machine_code="EXCAVATOR"
   - Codes: ROLLER, PAVER, COMPACTOR, EXCAVATOR, TIPPER, GRADER, TRANSIT_MIXER, CRANE, LOADER, GENERATOR
   - Leave [] if no machines spoken.

9) manpower_deployed — extract EVERY workforce category with count and shift:
   - "12 skilled workers day shift" → {category:"SKILLED", count:12, shift_type:"DAY"}
   - "8 mazdoor" → {category:"UNSKILLED", count:8, shift_type:"DAY"}
   - "5 mason night shift" → {category:"MASON", count:5, shift_type:"NIGHT"}
   - "teen mason" → count=3 (teen=3 in Hindi)
   - Hindi: mazdoor/majdoor=UNSKILLED, mistri/mistry=MASON, karigar=SKILLED
   - Shift: day/morning=DAY, night=NIGHT, general=GENERAL. Default to DAY.
   - Leave [] if no manpower spoken.

10) road_side: LHS/RHS/Both/Median when explicitly spoken.

11) is_partial_entry=true when missing_fields is non-empty.

Do not include markdown, explanations, or extra keys."""


def _get_openai() -> OpenAI:
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured on server")
    return OpenAI(api_key=key)


@router.get("/status", summary="Check OpenAI API key validity and quota")
async def voice_status(payload: dict = Depends(verify_token)):
    """Quick health check — sends a minimal GPT request to verify key and quota."""
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        return {"status": "error", "error_reason": "no_key", "message": "OPENAI_API_KEY not set on server"}
    try:
        client = OpenAI(api_key=key)
        client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
        )
        return {"status": "ok", "message": "OpenAI key is valid and has quota"}
    except Exception as e:
        err = str(e).lower()
        if "quota" in err or "insufficient_quota" in err or "billing" in err:
            return {"status": "error", "error_reason": "openai_quota_exceeded",
                    "message": "OpenAI credit balance exhausted. Top up at platform.openai.com/account/billing."}
        if "invalid_api_key" in err or "authentication" in err:
            return {"status": "error", "error_reason": "openai_invalid_key",
                    "message": "OpenAI API key is invalid or revoked."}
        return {"status": "error", "error_reason": "unknown", "message": str(e)}


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

        # Augment GPT result with regex 3M parser (better at Hindi numerics & keywords)
        try:
            from voice_parser import parse_voice_transcript as regex_parse
            regex_result = regex_parse(transcript)
            # Only fill in 3M arrays if GPT left them empty
            if not parsed.get("materials_used") and regex_result["materials"]:
                parsed["materials_used"] = [
                    {
                        "material_code": m["material_code"],
                        "quantity": m.get("quantity"),
                        "unit": m.get("unit") or "NOS",
                        "source": m.get("source"),
                    }
                    for m in regex_result["materials"]
                ]
            if not parsed.get("machines_deployed") and regex_result["machines"]:
                parsed["machines_deployed"] = [
                    {
                        "machine_code": m["machine_code"],
                        "hours": m.get("hours"),
                        "operator_name": m.get("operator_name"),
                        "count": m.get("count", 1),
                    }
                    for m in regex_result["machines"]
                ]
            if not parsed.get("manpower_deployed") and regex_result["manpower"]:
                parsed["manpower_deployed"] = [
                    {
                        "category": m["category"],
                        "count": m.get("count"),
                        "shift_type": m.get("shift_type", "DAY"),
                    }
                    for m in regex_result["manpower"]
                ]
            parsed["voice_confidence"] = regex_result["confidence"]
        except Exception:
            pass  # regex parser augmentation is advisory; never block response

        return {
            "transcript": transcript,
            "parsed": parsed,
            "source": "whisper+gpt",
        }

    except HTTPException:
        raise
    except Exception as e:
        err_str = str(e).lower()
        # Classify the error so the client can show a meaningful message
        if "quota" in err_str or "insufficient_quota" in err_str or "billing" in err_str:
            reason = "openai_quota_exceeded"
            msg = "OpenAI credit balance exhausted. Top up at platform.openai.com/account/billing."
        elif "invalid_api_key" in err_str or "authentication" in err_str:
            reason = "openai_invalid_key"
            msg = "OpenAI API key is invalid or revoked."
        elif "rate_limit" in err_str:
            reason = "openai_rate_limit"
            msg = "OpenAI rate limit hit. Retry in a few seconds."
        elif "connection" in err_str or "timeout" in err_str:
            reason = "network_error"
            msg = "Network error reaching OpenAI. Check server internet connection."
        else:
            reason = "unknown"
            msg = f"Voice transcription failed: {str(e)}"
        logger.error("voice_transcribe error [%s]: %s", reason, str(e))
        raise HTTPException(status_code=500, detail={"error_reason": reason, "message": msg})
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
