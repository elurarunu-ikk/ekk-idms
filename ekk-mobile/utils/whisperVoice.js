// ekk-mobile/utils/whisperVoice.js
// Parallel expo-av audio recording + OpenAI Whisper transcription via backend

import { Audio } from 'expo-av';
import api from '../services/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { API_BASE } from '../services/api';

const isWeb = typeof document !== 'undefined';

let _avRecording = null;

export async function startAudioRecording() {
  try {
    if (isWeb) {
      // On web, expo-av Audio.Recording works differently — skip setAudioModeAsync
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      _avRecording = recording;
    } else {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      _avRecording = recording;
    }
    console.log('[Voice] expo-av recording started');
  } catch (e) {
    console.log('[Voice] expo-av start failed (non-fatal):', e.message);
    _avRecording = null;
  }
}

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
 * Handles both native (file:// URI) and web (blob: URI) environments.
 * Returns: { transcript, parsed, source, error_reason? }
 */
export async function uploadAndTranscribe(audioUri) {
  console.log('[Voice] uploadAndTranscribe called, uri:', audioUri);
  console.log('[Voice] api baseURL:', api.defaults.baseURL);
  if (!audioUri) throw new Error('No audio URI provided');

  const filename = `voice_${Date.now()}.m4a`;
  const formData = new FormData();

  if (isWeb) {
    // On web, audioUri is a blob: URL — fetch it to get the actual Blob
    const response = await fetch(audioUri);
    const blob = await response.blob();
    formData.append('file', blob, filename);
    // Web path: use Axios FormData (blob is serializable)
    console.log('[Voice] web upload via axios');
    try {
      const resp = await api.post('/api/voice/transcribe', formData, { timeout: 30000 });
      console.log('[Voice] upload success, status:', resp.status);
      return resp.data;
    } catch (err) {
      console.log('[Voice] upload error — message:', err.message, 'code:', err.code, 'http:', err?.response?.status);
      throw err;
    }
  } else {
    // Native Android/iOS path — use expo-file-system uploadAsync which handles
    // multipart file:// URIs correctly without the Axios FormData boundary issues.
    const token = await SecureStore.getItemAsync('ekk_token').catch(() => null);
    const uploadUrl = `${API_BASE}/api/voice/transcribe`;
    console.log('[Voice] uploading to:', uploadUrl);

    const uploadResult = await FileSystem.uploadAsync(uploadUrl, audioUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'audio/m4a',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      parameters: {},
    });

    console.log('[Voice] uploadAsync status:', uploadResult.status, 'body:', uploadResult.body?.substring(0, 200));

    if (uploadResult.status >= 400) {
      // Parse error detail for structured error_reason
      let detail = null;
      try { detail = JSON.parse(uploadResult.body)?.detail; } catch {}
      const err = new Error(detail?.message || `Server error ${uploadResult.status}`);
      err.response = { status: uploadResult.status, data: { detail } };
      throw err;
    }

    let data = null;
    try { data = JSON.parse(uploadResult.body); } catch {
      throw new Error('Invalid JSON response from server');
    }
    return data;
  }
}
