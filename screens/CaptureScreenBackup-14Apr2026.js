import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Image,
} from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { parseVoiceTranscript, formatChainage } from '../utils/voiceParser';
import { useMediaCapture } from '../hooks/useMediaCapture';
import api from '../services/api';
import { STAGES, ACTIVITY_CODES, ROAD_SIDES } from '../constants/data';

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const STT_LANG   = 'en-IN';

export default function CaptureScreen() {

  const [form, setForm] = useState({
    project_id:      PROJECT_ID,
    activity_code:   '',
    stage:           '',
    chainage_from:   '',
    chainage_to:     '',
    road_side:       '',
    contractor_name: 'Self',
    rfi_number:      '',
    layer_section:   '',
    remarks:         '',
  });

  const [quantity,   setQuantity]   = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [recording,  setRecording]  = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsing,    setParsing]    = useState(false);
  const [waypoints,  setWaypoints]  = useState([]);
  const [lastSaved,  setLastSaved]  = useState(null);

  const {
    photos, video, uploading,
    capturePhoto, captureVideo,
    removePhoto, removeVideo,
    uploadAllForEntry, resetMedia,
    photoCount, videoCount, maxPhotos, maxVideos,
  } = useMediaCapture();

  // Auto-calculate quantity
  useEffect(() => {
    const f = parseChainage(form.chainage_from);
    const t = parseChainage(form.chainage_to);
    if (f !== null && t !== null && t > f) {
      setQuantity(Math.round((t - f) * 1000));
    } else {
      setQuantity(null);
    }
  }, [form.chainage_from, form.chainage_to]);

  // ── Speech events ─────────────────────────────────────────────────────────
  useSpeechRecognitionEvent('start', () => { setRecording(true); setTranscript(''); });
  useSpeechRecognitionEvent('end', () => {
    if (!global._ekk_rec_active) setRecording(false);
  });
  useSpeechRecognitionEvent('error', (e) => {
    console.log('STT error:', e);
    if (global._ekk_rec_active) {
      ExpoSpeechRecognitionModule.start({ lang: STT_LANG, interimResults: true, continuous: true });
    }
  });
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript || '';
    setTranscript(prev => event.isFinal ? (prev + ' ' + text).trim() : text);
    if (event.isFinal) applyParsed(parseVoiceTranscript(text));
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function parseChainage(val) {
    if (!val) return null;
    const m = val.match(/^(\d+)\+(\d+)$/);
    if (m) return parseFloat(m[1]) + parseFloat(m[2]) / 1000;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  function update(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function applyParsed(p) {
    setForm(f => ({
      ...f,
      activity_code:   p.activity_code                          || f.activity_code,
      stage:           p.stage                                  || f.stage,
      chainage_from:   p.chainage_from != null ? formatChainage(p.chainage_from) : f.chainage_from,
      chainage_to:     p.chainage_to   != null ? formatChainage(p.chainage_to)   : f.chainage_to,
      road_side:       p.road_side                              || f.road_side,
      contractor_name: p.contractor_name                        || f.contractor_name,
      rfi_number:      p.rfi_number    != null ? String(p.rfi_number)            : f.rfi_number,
      layer_section:   p.layer_section                          || f.layer_section,
      remarks:         p.remarks                                || f.remarks,
    }));
  }

  // ── Voice ─────────────────────────────────────────────────────────────────
  function handleStartRecording() {
    setTranscript('');
    setRecording(true);

    if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = STT_LANG; rec.interimResults = true; rec.continuous = true;
      rec.onstart  = () => { setRecording(true); setTranscript(''); };
      rec.onend    = () => { if (global._ekk_rec_active) rec.start(); else setRecording(false); };
      rec.onerror  = (e) => console.log('STT error:', e.error);
      rec.onresult = (event) => {
        const text = Array.from(event.results).map(r => r[0].transcript).join('');
        setTranscript(text);
        if (event.results[event.results.length - 1].isFinal) {
          setParsing(true);
          applyParsed(parseVoiceTranscript(text));
          setParsing(false);
        }
      };
      global._ekk_rec_active = true;
      global._ekk_rec = rec;
      rec.start();
      return;
    }

    ExpoSpeechRecognitionModule.requestPermissionsAsync().then(result => {
      if (!result.granted) { setRecording(false); Alert.alert('Permission denied', 'Microphone access required'); return; }
      global._ekk_rec_active = true;
      ExpoSpeechRecognitionModule.start({ lang: STT_LANG, interimResults: true, continuous: true });
    }).catch(e => { setRecording(false); console.log('Permission error:', e); });
  }

  function handleStopRecording() {
    global._ekk_rec_active = false;
    if (global._ekk_rec) { global._ekk_rec.stop(); global._ekk_rec = null; }
    else ExpoSpeechRecognitionModule.stop();
    setRecording(false);
  }

  // ── GPS ───────────────────────────────────────────────────────────────────
  async function handleDropPin() {
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission denied', 'Location access required'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const wp  = { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy_m: loc.coords.accuracy, captured_at: new Date().toISOString() };
      setWaypoints(prev => [...prev, wp]);
      Alert.alert('Pin dropped', `${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}\n±${Math.round(wp.accuracy_m)}m`);
    } catch (e) { Alert.alert('GPS Error', e.message); }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function submitCapture() {
    if (!form.activity_code) { Alert.alert('Missing', 'Select an Activity'); return; }
    if (!form.stage)         { Alert.alert('Missing', 'Select a Stage');     return; }

    const cf = parseChainage(form.chainage_from);
    const ct = parseChainage(form.chainage_to);
    if (cf === null || ct === null) { Alert.alert('Invalid chainage', 'Enter as 1+200 format'); return; }
    if (ct <= cf)                   { Alert.alert('Invalid chainage', 'To must be greater than From'); return; }

    const fp = waypoints[0];
    const lp = waypoints[waypoints.length - 1];

    const payload = {
      project_id:      form.project_id,
      activity_code:   form.activity_code.toUpperCase(),
      stage:           form.stage.toUpperCase(),
      chainage_from:   cf,
      chainage_to:     ct,
      quantity_lm:     quantity || Math.round((ct - cf) * 1000),
      contractor_name: form.contractor_name || 'Self',
      road_side:       form.road_side    || null,
      rfi_number:      form.rfi_number && form.rfi_number !== '' ? parseInt(form.rfi_number) : null,
      layer_section:   form.layer_section || null,
      remarks:         form.remarks       || null,
      gps_start_lat:   fp?.lat            || null,
      gps_start_lng:   fp?.lng            || null,
      gps_end_lat:     lp?.lat            || null,
      gps_end_lng:     lp?.lng            || null,
      gps_accuracy_m:  fp?.accuracy_m     || null,
    };

    setLoading(true);
    try {
      const resp = await api.post('/api/capture/', payload);
      const entryId = resp.data.id;
      setLastSaved(resp.data);

      // Show success immediately — media uploads in background
      Alert.alert(
        '✅ Saved!',
        `${resp.data.activity_code} · ${form.chainage_from} → ${form.chainage_to} · ${payload.quantity_lm} LM` +
        (photoCount + videoCount > 0 ? `\nUploading ${photoCount + videoCount} media file(s)...` : ''),
        [{ text: 'New Entry', onPress: resetForm }, { text: 'Stay' }]
      );

      // Background upload — does not block user
      uploadAllForEntry(entryId);

    } catch (e) {
      console.log('Submit error:', JSON.stringify(e?.response?.data));
      Alert.alert('Failed', JSON.stringify(e?.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function resetForm() {
    setForm({
      project_id: PROJECT_ID, activity_code: '', stage: '',
      chainage_from: '', chainage_to: '', road_side: '',
      contractor_name: 'Self', rfi_number: '', layer_section: '', remarks: '',
    });
    setQuantity(null); setTranscript(''); setWaypoints([]);
    resetMedia();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>

      <View style={styles.header}>
        <Text style={styles.title}>Field Capture</Text>
        <Text style={styles.subtitle}>M1 · End of Day Entry · Project 613</Text>
      </View>

      {lastSaved && (
        <View style={styles.savedBanner}>
          <Text style={styles.savedText}>
            Last saved: {lastSaved.activity_code} · {new Date(lastSaved.created_at).toLocaleTimeString('en-IN')}
          </Text>
        </View>
      )}

      {/* Voice */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.voiceBtn, recording && styles.voiceBtnRec]}
          onPress={recording ? handleStopRecording : handleStartRecording}
          disabled={parsing}
        >
          {parsing
            ? <ActivityIndicator color="#fff" size="large" />
            : <Text style={styles.voiceIcon}>{recording ? '⏹' : '🎤'}</Text>
          }
          <Text style={styles.voiceBtnText}>
            {parsing ? 'Parsing...' : recording ? 'Tap to Stop' : 'Speak to Fill Form'}
          </Text>
          {recording && <Text style={styles.voiceHint}>Listening... English / தமிழ் / हिंदी</Text>}
        </TouchableOpacity>

        {transcript !== '' && (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptLabel}>Heard</Text>
            <Text style={styles.transcriptText}>{transcript}</Text>
            <Text style={[styles.transcriptLabel, { marginTop: 8 }]}>Parsed into form</Text>
            <Text style={styles.transcriptText}>
              {'Activity: '}{form.activity_code || '—'}{'\n'}
              {'Stage: '}{form.stage || '—'}{'\n'}
              {'Chainage: '}{form.chainage_from || '—'}{' → '}{form.chainage_to || '—'}{'\n'}
              {'Road Side: '}{form.road_side || '—'}{'\n'}
              {'Remarks: '}{form.remarks || '—'}
            </Text>
          </View>
        )}
      </View>

      {/* GPS */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.pinBtn} onPress={handleDropPin}>
          <Text style={styles.pinIcon}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pinText}>Drop GPS Pin</Text>
            <Text style={styles.pinSub}>
              {waypoints.length === 0 ? 'Tap anytime during or after work'
                : `${waypoints.length} pin${waypoints.length > 1 ? 's' : ''} dropped today`}
            </Text>
          </View>
        </TouchableOpacity>
        {waypoints.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {waypoints.map((wp, i) => (
              <View key={i} style={styles.waypointChip}>
                <Text style={styles.waypointNum}>Pin {i + 1}</Text>
                <Text style={styles.waypointTime}>{new Date(wp.captured_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                <Text style={styles.waypointCoord}>±{Math.round(wp.accuracy_m)}m</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Media Capture ── */}
      <Text style={styles.label}>Photos & Video</Text>
      <View style={styles.section}>

        {/* Action buttons */}
        <View style={styles.mediaActions}>
          <TouchableOpacity
            style={[styles.mediaBtn, photoCount >= maxPhotos && styles.mediaBtnDisabled]}
            onPress={capturePhoto}
            disabled={photoCount >= maxPhotos}
          >
            <Text style={styles.mediaBtnIcon}>📷</Text>
            <Text style={styles.mediaBtnText}>Photo</Text>
            <Text style={styles.mediaBtnCount}>{photoCount}/{maxPhotos}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mediaBtn, videoCount >= maxVideos && styles.mediaBtnDisabled]}
            onPress={captureVideo}
            disabled={videoCount >= maxVideos}
          >
            <Text style={styles.mediaBtnIcon}>🎥</Text>
            <Text style={styles.mediaBtnText}>Video</Text>
            <Text style={styles.mediaBtnCount}>{videoCount}/{maxVideos} · max 30s</Text>
          </TouchableOpacity>
        </View>

        {/* Photo thumbnails */}
        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {photos.map((p, i) => (
              <View key={i} style={styles.thumbWrap}>
                <Image source={{ uri: p.uri }} style={styles.thumb} />
                <View style={styles.thumbMeta}>
                  <Text style={styles.thumbSize}>{p.sizeMb.toFixed(1)}MB</Text>
                  <TouchableOpacity onPress={() => removePhoto(i)} style={styles.thumbRemove}>
                    <Text style={styles.thumbRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Video chip */}
        {video && (
          <View style={styles.videoChip}>
            <Text style={styles.videoChipIcon}>🎥</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.videoChipName}>{video.name}</Text>
              <Text style={styles.videoChipMeta}>{video.sizeMb.toFixed(1)}MB · max 30s</Text>
            </View>
            <TouchableOpacity onPress={removeVideo} style={styles.thumbRemove}>
              <Text style={styles.thumbRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Upload status */}
        {uploading && (
          <View style={styles.uploadingRow}>
            <ActivityIndicator size="small" color="#1a1a1a" />
            <Text style={styles.uploadingText}>Uploading media in background...</Text>
          </View>
        )}
      </View>

      {/* Activity */}
      <Text style={styles.label}>Activity</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
        {ACTIVITY_CODES.map(a => (
          <TouchableOpacity key={a.code} style={[styles.pill, form.activity_code === a.code && styles.pillActive]} onPress={() => update('activity_code', a.code)}>
            <Text style={[styles.pillText, form.activity_code === a.code && styles.pillTextActive]}>{a.code}</Text>
            <Text style={[styles.pillSub,  form.activity_code === a.code && styles.pillSubActive]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stage */}
      <Text style={styles.label}>Stage / Layer</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
        {STAGES.map(s => (
          <TouchableOpacity key={s.code} style={[styles.pill, form.stage === s.code && styles.pillActive]} onPress={() => update('stage', s.code)}>
            <Text style={[styles.pillText, form.stage === s.code && styles.pillTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chainage */}
      <Text style={styles.label}>Chainage</Text>
      <View style={styles.chainageRow}>
        <TextInput style={[styles.input, styles.chainageInput]} value={form.chainage_from} onChangeText={v => update('chainage_from', v)} placeholder="1+200" />
        <Text style={styles.chainageSep}>→</Text>
        <TextInput style={[styles.input, styles.chainageInput]} value={form.chainage_to}   onChangeText={v => update('chainage_to',   v)} placeholder="1+450" />
      </View>

      {quantity !== null && (
        <View style={styles.qtyCard}>
          <Text style={styles.qtyVal}>{quantity.toLocaleString()}</Text>
          <Text style={styles.qtyUnit}> linear metres</Text>
        </View>
      )}

      {/* Road Side */}
      <Text style={styles.label}>Road Side</Text>
      <View style={styles.rsRow}>
        {ROAD_SIDES.map(rs => (
          <TouchableOpacity key={rs} style={[styles.rsBtn, form.road_side === rs && styles.rsBtnActive]} onPress={() => update('road_side', rs)}>
            <Text style={[styles.rsBtnText, form.road_side === rs && styles.rsBtnTextActive]}>{rs}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contractor */}
      <Text style={styles.label}>Contractor</Text>
      <TextInput style={styles.input} value={form.contractor_name} onChangeText={v => update('contractor_name', v)} placeholder="Self" />

      {/* RFI & Layer */}
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>RFI Number</Text>
          <TextInput style={styles.input} value={form.rfi_number} onChangeText={v => update('rfi_number', v)} placeholder="Optional" keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Layer / Section</Text>
          <TextInput style={styles.input} value={form.layer_section} onChangeText={v => update('layer_section', v)} placeholder="L1 / Sec-A" />
        </View>
      </View>

      {/* Remarks */}
      <Text style={styles.label}>Remarks</Text>
      <TextInput style={[styles.input, styles.remarks]} value={form.remarks} onChangeText={v => update('remarks', v)} placeholder="Weather, delays, issues..." multiline numberOfLines={3} />

      {/* Submit */}
      <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={submitCapture} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Capture Entry</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.clearBtn} onPress={resetForm}>
        <Text style={styles.clearText}>Clear Form</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f5f5f0' },
  header:           { backgroundColor: '#1a1a1a', padding: 20, paddingTop: 52 },
  title:            { fontSize: 22, fontWeight: '700', color: '#fff' },
  subtitle:         { fontSize: 12, color: '#777', marginTop: 2 },
  savedBanner:      { backgroundColor: '#e8f5e9', padding: 10, paddingHorizontal: 16 },
  savedText:        { fontSize: 12, color: '#2e7d32', fontWeight: '500' },
  section:          { marginHorizontal: 16, marginTop: 8 },
  label:            { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  voiceBtn:         { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 20, alignItems: 'center' },
  voiceBtnRec:      { backgroundColor: '#c62828' },
  voiceIcon:        { fontSize: 32, marginBottom: 6 },
  voiceBtnText:     { color: '#fff', fontSize: 15, fontWeight: '600' },
  voiceHint:        { color: '#aaa', fontSize: 12, marginTop: 6 },
  transcriptBox:    { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginTop: 10, borderLeftWidth: 3, borderLeftColor: '#1a1a1a' },
  transcriptLabel:  { fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 4 },
  transcriptText:   { fontSize: 13, color: '#333', lineHeight: 20 },
  pinBtn:           { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  pinIcon:          { fontSize: 22 },
  pinText:          { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  pinSub:           { fontSize: 11, color: '#aaa', marginTop: 2 },
  waypointChip:     { backgroundColor: '#e8f5e9', borderRadius: 8, padding: 10, marginRight: 8, minWidth: 80, alignItems: 'center' },
  waypointNum:      { fontSize: 11, fontWeight: '600', color: '#2e7d32' },
  waypointTime:     { fontSize: 12, color: '#388e3c', marginTop: 2 },
  waypointCoord:    { fontSize: 10, color: '#66bb6a', marginTop: 2 },
  // Media
  mediaActions:     { flexDirection: 'row', gap: 10 },
  mediaBtn:         { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  mediaBtnDisabled: { opacity: 0.4 },
  mediaBtnIcon:     { fontSize: 26, marginBottom: 4 },
  mediaBtnText:     { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  mediaBtnCount:    { fontSize: 11, color: '#aaa', marginTop: 2 },
  thumbWrap:        { marginRight: 10, alignItems: 'center' },
  thumb:            { width: 80, height: 80, borderRadius: 8, backgroundColor: '#eee' },
  thumbMeta:        { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  thumbSize:        { fontSize: 10, color: '#aaa' },
  thumbRemove:      { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  thumbRemoveText:  { fontSize: 11, color: '#dc2626', fontWeight: '700' },
  videoChip:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#e0e0e0' },
  videoChipIcon:    { fontSize: 22 },
  videoChipName:    { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  videoChipMeta:    { fontSize: 11, color: '#aaa', marginTop: 2 },
  uploadingRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  uploadingText:    { fontSize: 12, color: '#666' },
  // Form
  pillScroll:       { paddingHorizontal: 16, marginBottom: 4 },
  pill:             { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', marginRight: 8, alignItems: 'center' },
  pillActive:       { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  pillText:         { fontSize: 13, fontWeight: '600', color: '#555' },
  pillTextActive:   { color: '#fff' },
  pillSub:          { fontSize: 10, color: '#aaa', marginTop: 2 },
  pillSubActive:    { color: '#888' },
  input:            { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 15, marginHorizontal: 16, color: '#1a1a1a', marginBottom: 4 },
  chainageRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  chainageInput:    { flex: 1, marginHorizontal: 0 },
  chainageSep:      { fontSize: 20, color: '#bbb' },
  qtyCard:          { flexDirection: 'row', alignItems: 'baseline', marginHorizontal: 16, marginTop: 8, padding: 12, backgroundColor: '#e8f5e9', borderRadius: 8 },
  qtyVal:           { fontSize: 24, fontWeight: '700', color: '#2e7d32' },
  qtyUnit:          { fontSize: 13, color: '#4caf50' },
  rsRow:            { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  rsBtn:            { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', alignItems: 'center' },
  rsBtnActive:      { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  rsBtnText:        { fontSize: 13, fontWeight: '600', color: '#555' },
  rsBtnTextActive:  { color: '#fff' },
  twoCol:           { flexDirection: 'row', gap: 8 },
  remarks:          { height: 88, textAlignVertical: 'top', paddingTop: 12 },
  submitBtn:        { backgroundColor: '#1a1a1a', margin: 16, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  submitText:       { color: '#fff', fontSize: 16, fontWeight: '600' },
  clearBtn:         { alignItems: 'center', marginBottom: 8 },
  clearText:        { color: '#aaa', fontSize: 13 },
});