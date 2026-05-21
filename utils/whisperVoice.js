// ekk-mobile/utils/whisperVoice.js
// Parallel expo-av audio recording + OpenAI Whisper transcription via backend

import { Audio } from 'expo-av';
import api from '../services/api';

let _avRecording = null;

/**
 * Start expo-av audio recording in parallel with expo-speech-recognition.
 * Call this at the same time as ExpoSpeechRecognitionModule.start().
 */
export async function startAudioRecording() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    _avRecording = recording;
    console.log('[Voice] expo-av recording started');
  } catch (e) {
    // Non-fatal: local STT still works as fallback
    console.log('[Voice] expo-av start failed (non-fatal):', e.message);
    _avRecording = null;
  }
}

/**
 * Stop expo-av recording and return the local audio file URI.
 * Returns null if recording was never started or failed.
 */
export async function stopAudioRecording() {
  if (!_avRecording) return null;
  try {
    await _avRecording.stopAndUnloadAsync();
    const uri = _avRecording.getURI();
    _avRecording = null;
    console.log('[Voice] expo-av recording stopped, uri:', uri);
    return uri;
  } catch (e) {
    console.log('[Voice] expo-av stop failed:', e.message);
    _avRecording = null;
    return null;
  }
}

/**
 * Upload audio to backend /api/voice/transcribe.
 * Backend calls Whisper for multilingual transcription (English + Tamil + Hindi)
 * then GPT-4o-mini to parse into structured form fields.
 *
 * Returns: { transcript: string, parsed: {...}, source: 'whisper+gpt' }
 */
export async function uploadAndTranscribe(audioUri) {
  if (!audioUri) throw new Error('No audio URI provided');

  const filename = `voice_${Date.now()}.m4a`;
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    name: filename,
    type: 'audio/m4a',
  });

  const resp = await api.post('/api/voice/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000, // 30s — Whisper can take a few seconds
  });

  return resp.data; // { transcript, parsed, source }
}
