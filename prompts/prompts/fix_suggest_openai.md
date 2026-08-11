# Task: Switch suggest endpoint from Anthropic to OpenAI

Read routers/boq_router.py — find the suggest_activity_mappings endpoint.

Currently it uses:
  import anthropic
  client = anthropic.Anthropic()
  response = client.messages.create(model="claude-sonnet-4-6", ...)

Replace with OpenAI:
  import openai
  client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
  response = client.chat.completions.create(
      model=os.getenv("OPENAI_MODEL", "gpt-4o"),
      messages=[
          {"role": "system", "content": system_prompt},
          {"role": "user", "content": user_prompt}
      ],
      max_tokens=4000,
      temperature=0,
  )

Extract the response text:
  content = response.choices[0].message.content

Everything else stays the same — JSON parsing, error handling,
SuggestResponse schema, all unchanged.

Also add at top of function:
  import os
  if not os.getenv("OPENAI_API_KEY"):
      raise HTTPException(status_code=500,
          detail="OPENAI_API_KEY not configured")

Do not modify any other endpoint or file.