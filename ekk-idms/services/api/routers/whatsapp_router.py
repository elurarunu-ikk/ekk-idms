from fastapi import APIRouter, Request, Query, HTTPException, Depends
from sqlalchemy.orm import Session
import os, uuid, httpx, re, logging
from datetime import datetime

from database import get_db
from models.site_data import SiteDataTransaction
from models.project import Project

logger = logging.getLogger(__name__)

router = APIRouter()

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "ekk_idms_verify")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# ---------------------------------------------------------------------------
# 1. Meta Webhook Verification (GET)
# ---------------------------------------------------------------------------

@router.get("/webhook", summary="Meta webhook verification")
def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
    if hub_mode == "subscribe" and hub_verify_token == WHATSAPP_VERIFY_TOKEN:
        logger.info("WhatsApp webhook verified successfully")
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


# ---------------------------------------------------------------------------
# 2. Receive Incoming Messages (POST)
# ---------------------------------------------------------------------------

@router.post("/webhook", summary="Receive WhatsApp messages")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    logger.info(f"WhatsApp webhook received: {body}")

    try:
        entry = body["entry"][0]
        changes = entry["changes"][0]["value"]

        # Ignore status updates (delivered, read, etc.)
        if "messages" not in changes:
            return {"status": "ignored"}

        message = changes["messages"][0]
        from_number = message["from"]           # sender's WhatsApp number
        msg_type = message.get("type")

        if msg_type == "text":
            text = message["text"]["body"].strip()
            await handle_text_message(text, from_number, db)

        elif msg_type == "image":
            # Future: OCR on image
            send_whatsapp_reply(from_number, "📸 Image received. OCR capture coming soon!")

        else:
            send_whatsapp_reply(from_number, "⚠️ Unsupported message type. Please send text.")

    except (KeyError, IndexError) as e:
        logger.warning(f"Webhook parse error: {e}")

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# 3. Message Handler
# ---------------------------------------------------------------------------

async def handle_text_message(text: str, from_number: str, db: Session):
    """Try structured parse first, fall back to Claude AI parse."""

    # Check for help command
    if text.lower() in ["help", "hi", "hello", "start"]:
        send_whatsapp_reply(from_number, HELP_MESSAGE)
        return

    # Try structured pattern first (fast, no API call)
    parsed = try_structured_parse(text)

    if not parsed:
        # Fall back to Claude AI for free text
        parsed = await try_claude_parse(text)

    if not parsed:
        send_whatsapp_reply(
            from_number,
            "❌ Could not parse your message.\n\n"
            "Try format:\n`ACT001 1+200 1+450 BASE 120`\n\n"
            "Or type *help* for instructions."
        )
        return

    # Look up first available project (in production, map by phone number)
    project = db.query(Project).first()
    if not project:
        send_whatsapp_reply(from_number, "❌ No project found in system. Contact admin.")
        return

    # Create capture entry
    entry = SiteDataTransaction(
        id=uuid.uuid4(),
        project_id=project.id,
        source="whatsapp",
        activity_code=parsed.get("activity_code"),
        chainage_from=parsed.get("chainage_from"),
        chainage_to=parsed.get("chainage_to"),
        stage=parsed.get("stage"),
        quantity_lm=parsed.get("quantity_lm"),
        contractor_name=parsed.get("contractor_name", from_number),
        road_side=parsed.get("road_side"),
        approved=False,
        rejected=False,
        payment_qualifies=False,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Confirm to sender
    send_whatsapp_reply(
        from_number,
        f"✅ Capture recorded!\n\n"
        f"📍 Activity: {entry.activity_code}\n"
        f"📏 Chainage: {entry.chainage_from} → {entry.chainage_to}\n"
        f"🔧 Stage: {entry.stage}\n"
        f"📐 Quantity: {entry.quantity_lm} LM\n\n"
        f"Entry ID: `{str(entry.id)[:8]}...`\n"
        f"⏳ Pending supervisor approval."
    )

    # Notify supervisor (send to the same number for demo — replace with supervisor number)
    supervisor_number = os.getenv("SUPERVISOR_WHATSAPP", from_number)
    send_whatsapp_reply(
        supervisor_number,
        f"🔔 *New Capture Entry — Approval Required*\n\n"
        f"From: {from_number}\n"
        f"Activity: {entry.activity_code}\n"
        f"Chainage: {entry.chainage_from} → {entry.chainage_to}\n"
        f"Stage: {entry.stage}\n"
        f"Quantity: {entry.quantity_lm} LM\n\n"
        f"Entry ID: `{str(entry.id)}`\n\n"
        f"Reply via Swagger: POST /api/capture/{{id}}/approve"
    )


# ---------------------------------------------------------------------------
# 4. Structured Parser
# Format: ACT001 1+200 1+450 STAGE 120 [contractor] [BS/FS]
# ---------------------------------------------------------------------------

CHAINAGE_RE = re.compile(r"(\d+)\+(\d+)")

def parse_chainage(token: str) -> float | None:
    m = CHAINAGE_RE.match(token)
    if m:
        return float(m.group(1)) + float(m.group(2)) / 1000
    try:
        return float(token)
    except ValueError:
        return None

def try_structured_parse(text: str) -> dict | None:
    """
    Expected format: ACT001 1+200 1+450 BASE_COURSE 120
    Optional:        ACT001 1+200 1+450 BASE_COURSE 120 Self BS
    """
    tokens = text.strip().split()
    if len(tokens) < 5:
        return None

    activity_code = tokens[0].upper()
    chainage_from = parse_chainage(tokens[1])
    chainage_to = parse_chainage(tokens[2])
    stage = tokens[3].upper()

    try:
        quantity_lm = float(tokens[4])
    except ValueError:
        return None

    if not all([chainage_from, chainage_to, quantity_lm]):
        return None

    result = {
        "activity_code": activity_code,
        "chainage_from": chainage_from,
        "chainage_to": chainage_to,
        "stage": stage,
        "quantity_lm": quantity_lm,
        "contractor_name": tokens[5] if len(tokens) > 5 else "Self",
        "road_side": tokens[6].upper() if len(tokens) > 6 else None,
    }
    return result


# ---------------------------------------------------------------------------
# 5. Claude AI Parser (free text fallback)
# ---------------------------------------------------------------------------

async def try_claude_parse(text: str) -> dict | None:
    if not ANTHROPIC_API_KEY:
        return None

    prompt = f"""Extract construction site data from this message and return ONLY valid JSON.

Message: "{text}"

Return JSON with these exact keys (use null if not found):
{{
  "activity_code": "string (e.g. ACT001, BC, GSB, WMM)",
  "chainage_from": number (kilometres, e.g. 1.200),
  "chainage_to": number (kilometres, e.g. 1.450),
  "stage": "string (e.g. BASE_COURSE, SUBGRADE, WMM, DBM)",
  "quantity_lm": number (linear metres),
  "contractor_name": "string or Self",
  "road_side": "BS or FS or Both or null"
}}

Return ONLY the JSON object, no explanation."""

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 300,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
        data = resp.json()
        raw = data["content"][0]["text"].strip()

        # Strip markdown fences if present
        raw = re.sub(r"```json|```", "", raw).strip()

        import json
        parsed = json.loads(raw)

        # Validate minimum required fields
        if parsed.get("activity_code") and parsed.get("quantity_lm"):
            return parsed

    except Exception as e:
        logger.error(f"Claude parse error: {e}")

    return None


# ---------------------------------------------------------------------------
# 6. Send WhatsApp Reply
# ---------------------------------------------------------------------------

def send_whatsapp_reply(to: str, message: str):
    if not WHATSAPP_TOKEN or not WHATSAPP_PHONE_NUMBER_ID:
        logger.warning("WhatsApp credentials not set — skipping send")
        return

    url = f"https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": message},
    }
    try:
        resp = httpx.post(
            url,
            headers={"Authorization": f"Bearer {WHATSAPP_TOKEN}", "Content-Type": "application/json"},
            json=payload,
            timeout=10,
        )
        logger.info(f"WhatsApp send status: {resp.status_code}")
    except Exception as e:
        logger.error(f"WhatsApp send error: {e}")


# ---------------------------------------------------------------------------
# Help message
# ---------------------------------------------------------------------------

HELP_MESSAGE = """👷 *EKK IDMS — Field Capture*

Send data in this format:
`ACTIVITY CHAIN_FROM CHAIN_TO STAGE QUANTITY`

*Example:*
`BC 1+200 1+450 BASE_COURSE 250`
`WMM 0+800 1+100 WMM_LAYING 300 Self BS`

*Fields:*
• Activity code (BC, WMM, GSB...)
• Chainage from & to (1+200 format)
• Stage name
• Quantity in linear metres
• Contractor (optional, default: Self)
• Road side: BS / FS / Both (optional)

Your entry will be sent for supervisor approval.
"""