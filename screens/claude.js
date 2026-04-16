import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

let recording = null;

export async function startRecording() {
  try {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording: rec } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recording = rec;
    return true;
  } catch (e) {
    throw e;
  }
}

export async function stopAndParse(existingFormData) {
  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;

    // Read audio as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Send to Claude for transcription + parsing
    const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY'; // move to env later

    const prompt = `You are a construction site data assistant for a road project in India.

A site engineer has sent a voice note in Tamil, Hindi, or English describing their work today.

Current form data (may be partially filled):
${JSON.stringify(existingFormData, null, 2)}

Listen to the audio and:
1. Transcribe what was said
2. Extract these fields if mentioned:
   - activity_code (EW/GSB/WMM/DBM/BC/KERB/DRAIN)
   - stage (SUBGRADE/GSB/WMM/BASE_COURSE/DBM/BC)
   - chainage_from (convert to decimal km e.g. 1+200 = 1.200)
   - chainage_to (convert to decimal km)
   - road_side (BS/FS/Both/Median)
   - contractor_name (default Self)
   - rfi_number (integer if mentioned)
   - layer_section (e.g. L1, Section-A)
   - remarks (weather, issues, delays mentioned)
   - quantity_lm (linear metres if mentioned)

Return ONLY valid JSON:
{
  "transcript": "what was said",
  "parsed": {
    "activity_code": null,
    "stage": null,
    "chainage_from": null,
    "chainage_to": null,
    "road_side": null,
    "contractor_name": null,
    "rfi_number": null,
    "layer_section": null,
    "remarks": null,
    "quantity_lm": null
  },
  "confidence": "high/medium/low",
  "unclear": "anything that was unclear"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'audio/m4a',
                data: base64,
              },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    const data = await response.json();
    const raw = data.content[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);

  } catch (e) {
    throw new Error('Voice parse failed: ' + e.message);
  }
}