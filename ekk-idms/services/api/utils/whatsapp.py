import httpx
import os

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")

async def send_message(to: str, text: str):
    """Send a WhatsApp text message via Meta Cloud API."""
    url = f"https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages"
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}", "Content-Type": "application/json"}
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload)
        return resp.json()

def parse_inbound_message(payload: dict) -> dict:
    """
    Parse Meta webhook payload → extract sender, message text, media id.
    Returns dict with: from_number, message_type, text, media_id, timestamp
    """
    try:
        entry = payload["entry"][0]["changes"][0]["value"]
        msg = entry["messages"][0]
        return {
            "from_number": msg["from"],
            "message_type": msg["type"],
            "text": msg.get("text", {}).get("body", ""),
            "media_id": msg.get("image", msg.get("video", msg.get("audio", {}))).get("id"),
            "timestamp": msg.get("timestamp"),
        }
    except (KeyError, IndexError):
        return {}
