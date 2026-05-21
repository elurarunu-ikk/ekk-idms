import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Image, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { parseVoiceTranscript, normalizeParsedCapture } from '../utils/voiceParser';
import { useMediaCapture } from '../hooks/useMediaCapture';
import { useNetworkMode } from '../hooks/useNetworkMode';
import { addSubmittedEntryId, enqueueEntry } from '../utils/offlineQueue';
import { formatLocationText } from '../utils/gpsOverlay';
import { startAudioRecording, stopAudioRecording, uploadAndTranscribe } from '../utils/whisperVoice';
import { logout } from '../services/auth';
import api, { getApiErrorMessage } from '../services/api';
import { getSelectedProject } from '../services/session';
import {
  WORK_TYPES,
  LAYERS,
  ELEMENTS,
  STRUCTURE_TYPES,
  ROAD_SIDES,
  getActivitiesForWorkType,
  getRoadActivitiesForLayer,
  getStructureElementsForType,
  getStructureActivitiesForSelection,
  deriveStageFromSelection,
} from '../constants/data';

const STT_LANG   = 'en-IN';
const WEATHER_OPTIONS = [
  { label: 'Sunny', value: 'SUNNY' },
  { label: 'Cloudy', value: 'CLOUDY' },
  { label: 'Rainy', value: 'RAINY' },
];
const PROGRESS_STATUS_OPTIONS = [
  { label: 'Started', value: 'STARTED' },
  { label: 'In Progress/Ongoing', value: 'ONGOING' },
  { label: 'Completed', value: 'COMPLETED' },
];

function showAlert(title, message = '', buttons) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!Array.isArray(buttons) || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const confirmButton =
    buttons.find((button) => !button.style || button.style === 'default' || button.style === 'destructive') ||
    buttons[buttons.length - 1];
  const cancelButton = buttons.find((button) => button.style === 'cancel');

  if (window.confirm(text)) {
    confirmButton?.onPress?.();
    return;
  }

  cancelButton?.onPress?.();
}

function toDateString(date) {
  // Returns YYYY-MM-DD in local time
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPhotoGpsPreview(photo) {
  if (!photo?.locationData) return 'No GPS data';
  return formatLocationText(photo.locationData);
}

function getActivityDefinition(activityCode) {
  return ['ROAD', 'STRUCTURE', 'DRAIN', 'ANCILLARY', 'MISC']
    .flatMap((workType) => getActivitiesForWorkType(workType))
    .find((activity) => activity.code === activityCode);
}

function deriveWorkTypeFromSelection(activityCode, stageCode) {
  if (LAYERS.some((layer) => layer.code === stageCode)) return 'ROAD';
  if (ELEMENTS.some((element) => element.code === stageCode)) return 'STRUCTURE';
  if (['DRAIN', 'ANCILLARY', 'MISC'].includes(stageCode)) return stageCode;

  const activity = getActivityDefinition(activityCode);
  if (activity?.workTypes?.length === 1) return activity.workTypes[0];
  if (activity?.workTypes?.includes('DRAIN')) return 'DRAIN';
  return '';
}

function mapWorkTypeLabelToCode(label) {
  if (!label) return '';
  const map = {
    ROAD: 'ROAD',
    STRUCTURE: 'STRUCTURE',
    DRAIN: 'DRAIN',
    ANCILLARY: 'ANCILLARY',
    MISC: 'MISC',
  };
  return map[String(label).toUpperCase()] || '';
}

function toNumberOrNull(val) {
  if (val === '' || val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function mapParsedActivityToCaptureActivity(activity) {
  const map = {
    WMM: 'WMM_LAY',
    GSB: 'GSB_LAY',
    EARTHWORK: 'EARTHWORK',
    DBM: 'DBM',
    BC: 'BC',
    SDBC: 'SDBC',
    PRIME_COAT: 'PRIME_COAT',
    TACK_COAT: 'TACK_COAT',
    RCC: 'RCC',
    PCC: 'PCC',
    EXCAVATION: 'EXCAVATION',
    REINF: 'REINF',
    SHUTTER: 'SHUTTER',
    ERECTION: 'ERECTION',
    INSTALLATION: 'INSTALLATION',
    DRAIN: 'DRAIN',
    KERB: 'KERB',
    MISC: 'MISC',
  };
  return map[String(activity || '').toUpperCase()] || '';
}

function mapParsedLayerToCode(layer) {
  const map = {
    SUBGRADE: 'SUBGRADE',
    GSB: 'GSB',
    WMM: 'WMM',
    'BASE COURSE': 'BASE',
    'BINDER COURSE': 'BINDER',
    'WEARING COURSE': 'WEARING',
    'PRIME COAT': 'PRIME',
    'TACK COAT': 'TACK',
  };
  return map[String(layer || '').toUpperCase()] || '';
}

function mapParsedProgressStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized === 'IN_PROGRESS' || normalized === 'IN PROGRESS' || normalized === 'ONGOING') return 'ONGOING';
  if (normalized === 'COMPLETED') return 'COMPLETED';
  if (normalized === 'STARTED') return 'STARTED';
  return '';
}

function mapParsedWeatherCode(weatherCode, remarks) {
  const normalized = String(weatherCode || '').trim().toUpperCase();
  if (normalized === 'SUNNY' || normalized === 'CLOUDY' || normalized === 'RAINY') return normalized;
  const text = `${String(weatherCode || '')} ${String(remarks || '')}`.toLowerCase();
  if (/\bsunn?y\b|\bsun\b/.test(text)) return 'SUNNY';
  if (/\bcloudy\b|\bcloud\b|\bovercast\b/.test(text)) return 'CLOUDY';
  if (/\brainy\b|\brain\b|\bdrizzle\b|\bshower\b/.test(text)) return 'RAINY';
  return '';
}

function detectLiveVoiceSelections(text) {
  const t = String(text || '').toLowerCase();
  const weather_code = /\bsunn?y\b|\bsun\b/.test(t)
    ? 'SUNNY'
    : /\bcloudy\b|\bcloud\b|\bovercast\b/.test(t)
      ? 'CLOUDY'
      : /\brainy\b|\brain\b|\bdrizzle\b|\bshower\b/.test(t)
        ? 'RAINY'
        : '';
  const progress_status = /\b(completed|done|finished|finish)\b/.test(t)
    ? 'COMPLETED'
    : /\b(in\s*progress|ongoing|on\s*going|started|starting)\b/.test(t)
      ? 'ONGOING'
      : /\bstart\b/.test(t)
        ? 'STARTED'
        : '';
  return { weather_code, progress_status };
}

export default function CaptureScreen() {
  const navigation = useNavigation();
  const [selectedProject, setSelectedProject] = useState(null);

  const [form, setForm] = useState({
    project_id:      '',
    work_type:       '',
    structure_type:  '',
    layer_code:      '',
    element_code:    '',
    activity_code:   '',
    stage:           '',
    chainage_from_km: '',
    chainage_from_m:  '',
    chainage_to_km:   '',
    chainage_to_m:    '',
    chainage_from:   '',
    chainage_to:     '',
    length_m:        '',
    width_m:         '',
    depth_m:         '',
    quantity:        '',
    unit:            '',
    weather_code:    '',
    progress_status: '',
    materials:       [],
    road_side:       '',
    contractor_name: 'Self',
    rfi_number:      '',
    layer_section:   '',
    remarks:         '',
  });

  // Date picker
  const [entryDate,    setEntryDate]    = useState(new Date());
  const [showDatePick, setShowDatePick] = useState(false);

  const [quantity,   setQuantity]   = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [recording,  setRecording]  = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsing,       setParsing]       = useState(false);
  const [whisperStatus,  setWhisperStatus]  = useState('idle');   // idle | uploading | done | error
  const [transcriptSrc,  setTranscriptSrc]  = useState('local');  // local | ai
  const [liveVoiceSelections, setLiveVoiceSelections] = useState({ weather_code: '', progress_status: '' });
  const [parsedFlags,    setParsedFlags]    = useState({ is_partial_entry: false, missing_fields: [] });
  const [waypoints,  setWaypoints]  = useState([]);
  const [lastSaved,  setLastSaved]  = useState(null);

  const {
    photos, video, files, uploading,
    capturePhoto, captureVideo, browseFile,
    removePhoto, removeVideo, removeFile,
    uploadAllForEntry, resetMedia,
    photoCount, videoCount, fileCount, maxPhotos, maxVideos, maxFiles,
  } = useMediaCapture();

  const { isOffline, isConnected, effectiveMode, offlineReason, networkLoading } = useNetworkMode();
  const showLayerSelector = form.work_type === 'ROAD';
  const showStructureTypeSelector = form.work_type === 'STRUCTURE';
  const showElementSelector = form.work_type === 'STRUCTURE';
  const availableElements = showElementSelector ? getStructureElementsForType(form.structure_type) : ELEMENTS;
  const canChooseActivity = Boolean(
    form.work_type &&
    (!showStructureTypeSelector || form.structure_type) &&
    (!showLayerSelector || form.layer_code) &&
    (!showElementSelector || form.element_code)
  );
  const availableActivities = showLayerSelector
    ? getRoadActivitiesForLayer(form.layer_code)
    : showElementSelector
      ? getStructureActivitiesForSelection(form.structure_type, form.element_code)
      : getActivitiesForWorkType(form.work_type);

  const syncSelectedProject = useCallback(async () => {
    const project = await getSelectedProject();
    setSelectedProject(project);
    setForm((prev) => ({ ...prev, project_id: project?.id || '' }));
  }, []);

  useEffect(() => {
    void syncSelectedProject();
  }, [syncSelectedProject]);

  useFocusEffect(
    useCallback(() => {
      void syncSelectedProject();
    }, [syncSelectedProject])
  );

  // Auto-calculate quantity and length for manual UX.
  useEffect(() => {
    const fk = toNumberOrNull(form.chainage_from_km);
    const fm = toNumberOrNull(form.chainage_from_m);
    const tk = toNumberOrNull(form.chainage_to_km);
    const tm = toNumberOrNull(form.chainage_to_m);
    const width = toNumberOrNull(form.width_m);
    const depth = toNumberOrNull(form.depth_m);
    const manualQty = toNumberOrNull(form.quantity);
    const explicitLength = toNumberOrNull(form.length_m);

    const fromM = fk != null && fm != null ? fk * 1000 + fm : null;
    const toM = tk != null && tm != null ? tk * 1000 + tm : null;
    const chainageLength = fromM != null && toM != null && toM > fromM ? toM - fromM : null;
    const finalLength = chainageLength ?? explicitLength;

    if (chainageLength != null) {
      const derivedLength = String(chainageLength);
      if (form.length_m !== derivedLength) {
        setForm((prev) => {
          if (prev.length_m === derivedLength) return prev;
          return { ...prev, length_m: derivedLength };
        });
      }
    }

    if (manualQty != null) {
      setQuantity(manualQty);
      return;
    }

    if (finalLength != null && width != null && depth != null) {
      setQuantity(Number((finalLength * width * depth).toFixed(3)));
      return;
    }

    if (finalLength != null) {
      setQuantity(finalLength);
      return;
    }

    setQuantity(null);
  }, [
    form.chainage_from_km,
    form.chainage_from_m,
    form.chainage_to_km,
    form.chainage_to_m,
    form.length_m,
    form.width_m,
    form.depth_m,
    form.quantity,
  ]);

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
    const live = detectLiveVoiceSelections(text);
    setLiveVoiceSelections(live);
    if (live.weather_code || live.progress_status) {
      setForm((prev) => ({
        ...prev,
        weather_code: live.weather_code || prev.weather_code,
        progress_status: live.progress_status || prev.progress_status,
      }));
    }
    setTranscript(prev => event.isFinal ? (prev + ' ' + text).trim() : text);
    if (event.isFinal) {
      applyParsed(parseVoiceTranscript(text));
      setLiveVoiceSelections({ weather_code: '', progress_status: '' });
    }
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function parseChainage(val) {
    if (!val) return null;
    const m = val.match(/^(\d+)\+(\d+)$/);
    if (m) return parseFloat(m[1]) + parseFloat(m[2]) / 1000;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  function buildDecimalFromSplit(kmVal, mVal) {
    const km = toNumberOrNull(kmVal);
    const m = toNumberOrNull(mVal);
    if (km == null || m == null) return null;
    return km + m / 1000;
  }

  function update(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function onChainageFieldChange(key, val) {
    // Any chainage correction should re-drive derived length/qty.
    setForm((prev) => ({ ...prev, [key]: val, quantity: '' }));
  }

  function updateWorkType(workType) {
    setForm((current) => ({
      ...current,
      work_type: workType,
      structure_type: '',
      layer_code: '',
      element_code: '',
      activity_code: '',
      stage: deriveStageFromSelection({ workType, layerCode: '', elementCode: '' }),
    }));
  }

  function updateStructureType(structureType) {
    setForm((current) => ({
      ...current,
      structure_type: structureType,
      element_code: '',
      activity_code: '',
      stage: deriveStageFromSelection({
        workType: current.work_type,
        layerCode: current.layer_code,
        elementCode: '',
      }),
    }));
  }

  function updateLayer(layerCode) {
    setForm((current) => ({
      ...current,
      layer_code: layerCode,
      element_code: '',
      activity_code: '',
      stage: deriveStageFromSelection({
        workType: current.work_type,
        layerCode,
        elementCode: '',
      }),
    }));
  }

  function updateElement(elementCode) {
    setForm((current) => ({
      ...current,
      element_code: elementCode,
      layer_code: '',
      activity_code: '',
      stage: deriveStageFromSelection({
        workType: current.work_type,
        layerCode: '',
        elementCode,
      }),
    }));
  }

  function updateActivity(activityCode) {
    setForm((current) => ({
      ...current,
      activity_code: activityCode,
      stage: deriveStageFromSelection({
        workType: current.work_type,
        layerCode: current.layer_code,
        elementCode: current.element_code,
      }),
    }));
  }

  function applyParsed(p) {
    const parsed = normalizeParsedCapture(p);
    setParsedFlags({
      is_partial_entry: Boolean(parsed.is_partial_entry),
      missing_fields: Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [],
    });
    const parsedActivity = mapParsedActivityToCaptureActivity(parsed.activity_code || parsed.activity);
    const parsedWorkType = mapWorkTypeLabelToCode(parsed.work_type) || deriveWorkTypeFromSelection(parsedActivity || parsed.activity_code, parsed.stage);
    const stageValue = String(parsed.stage || '').toUpperCase();
    const mappedLayer = mapParsedLayerToCode(parsed.layer);
    const layerCode = parsedWorkType === 'ROAD'
      ? (mappedLayer || (LAYERS.some((layer) => layer.code === stageValue) ? stageValue : ''))
      : '';
    const parsedElement = String(parsed.element || '').toUpperCase();
    const elementCode = parsedWorkType === 'STRUCTURE'
      ? (ELEMENTS.some((element) => element.code === parsedElement) ? parsedElement : (ELEMENTS.some((element) => element.code === stageValue) ? stageValue : ''))
      : '';

    const fromKm = parsed.chainage_from_km !== '' ? String(parsed.chainage_from_km) : '';
    const fromM = parsed.chainage_from_m !== '' ? String(parsed.chainage_from_m) : '';
    const toKm = parsed.chainage_to_km !== '' ? String(parsed.chainage_to_km) : '';
    const toM = parsed.chainage_to_m !== '' ? String(parsed.chainage_to_m) : '';

    setForm(f => ({
      ...f,
      work_type:       parsedWorkType || f.work_type,
      structure_type:  parsedWorkType === 'STRUCTURE' ? f.structure_type : '',
      layer_code:      layerCode || (parsedWorkType === 'ROAD' ? f.layer_code : ''),
      element_code:    elementCode || (parsedWorkType === 'STRUCTURE' ? f.element_code : ''),
      activity_code:   parsedActivity || parsed.activity_code || parsed.activity || f.activity_code,
      stage:           deriveStageFromSelection({
        workType: parsedWorkType || f.work_type,
        layerCode: layerCode || (parsedWorkType === 'ROAD' ? f.layer_code : ''),
        elementCode: elementCode || (parsedWorkType === 'STRUCTURE' ? f.element_code : ''),
      }) || f.stage,
      chainage_from_km: fromKm || f.chainage_from_km,
      chainage_from_m:  fromM || f.chainage_from_m,
      chainage_to_km:   toKm || f.chainage_to_km,
      chainage_to_m:    toM || f.chainage_to_m,
      chainage_from:    fromKm && fromM ? `${fromKm}+${String(fromM).padStart(3, '0')}` : f.chainage_from,
      chainage_to:      toKm && toM ? `${toKm}+${String(toM).padStart(3, '0')}` : f.chainage_to,
      length_m:         parsed.length_m !== '' ? String(parsed.length_m) : f.length_m,
      width_m:          parsed.width_m !== '' ? String(parsed.width_m) : f.width_m,
      depth_m:          parsed.depth_m !== '' ? String(parsed.depth_m) : f.depth_m,
      quantity:         parsed.quantity !== '' ? String(parsed.quantity) : f.quantity,
      unit:             parsed.unit || f.unit,
      weather_code:     mapParsedWeatherCode(parsed.weather_code, parsed.remarks) || f.weather_code,
      progress_status:  mapParsedProgressStatus(parsed.progress_status || parsed.status) || f.progress_status,
      materials:        Array.isArray(parsed.materials) && parsed.materials.length ? parsed.materials : f.materials,
      road_side:        parsed.road_side || f.road_side,
      contractor_name:  parsed.contractor_name || f.contractor_name,
      rfi_number:       parsed.rfi_number != null ? String(parsed.rfi_number) : f.rfi_number,
      layer_section:    parsed.layer_section || f.layer_section,
      remarks:          parsed.remarks || f.remarks,
    }));
  }

  // ── Voice ─────────────────────────────────────────────────────────────────
  async function handleStartRecording() {
    setTranscript('');
    setTranscriptSrc('local');
    setWhisperStatus('idle');
    setLiveVoiceSelections({ weather_code: '', progress_status: '' });
    setRecording(true);

    // Start expo-av parallel recording (for Whisper upload on stop)
    await startAudioRecording();

    if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = STT_LANG; rec.interimResults = true; rec.continuous = true;
      rec.onstart  = () => { setRecording(true); setTranscript(''); };
      rec.onend    = () => { if (global._ekk_rec_active) rec.start(); else setRecording(false); };
      rec.onerror  = (e) => console.log('STT error:', e.error);
      rec.onresult = (event) => {
        const text = Array.from(event.results).map(r => r[0].transcript).join('');
        const live = detectLiveVoiceSelections(text);
        setLiveVoiceSelections(live);
        if (live.weather_code || live.progress_status) {
          setForm((prev) => ({
            ...prev,
            weather_code: live.weather_code || prev.weather_code,
            progress_status: live.progress_status || prev.progress_status,
          }));
        }
        setTranscript(text);
        if (event.results[event.results.length - 1].isFinal) {
          setParsing(true); applyParsed(parseVoiceTranscript(text)); setParsing(false);
          setLiveVoiceSelections({ weather_code: '', progress_status: '' });
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

  async function handleStopRecording() {
    global._ekk_rec_active = false;
    if (global._ekk_rec) { global._ekk_rec.stop(); global._ekk_rec = null; }
    else ExpoSpeechRecognitionModule.stop();
    setRecording(false);

    // AI enhancement should depend on actual connectivity, not manual save mode.
    const audioUri = await stopAudioRecording();
    if (audioUri && effectiveMode === 'online') {
      setWhisperStatus('uploading');
      try {
        const result = await uploadAndTranscribe(audioUri);
        if (result?.transcript) {
          setTranscript(result.transcript);
          setTranscriptSrc('ai');
        }
        if (result?.parsed) {
          applyParsed(result.parsed);
        }
        setWhisperStatus('done');
      } catch (e) {
        console.log('[Voice] Whisper upload failed (local STT kept):', e.message);
        setWhisperStatus('error');
      }
    }
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

  // ── Build payload ─────────────────────────────────────────────────────────
  function buildPayload(cf, ct) {
    const stage = deriveStageFromSelection({
      workType: form.work_type,
      layerCode: form.layer_code,
      elementCode: form.element_code,
    });
    const fp = waypoints[0];
    const lp = waypoints[waypoints.length - 1];
    const numericQuantity = toNumberOrNull(form.quantity);
    const numericLength = toNumberOrNull(form.length_m);
    const numericWidth = toNumberOrNull(form.width_m);
    const numericDepth = toNumberOrNull(form.depth_m);
    const derivedLength =
      typeof cf === 'number' && typeof ct === 'number' && ct > cf
        ? Math.round((ct - cf) * 1000)
        : null;
    const finalLength = numericLength ?? derivedLength;
    const finalQuantity = quantity ?? numericQuantity ?? finalLength;
    const finalUnit = form.unit || ((finalQuantity != null && numericWidth != null && numericDepth != null) ? 'CUM' : null);
    return {
      project_id:      form.project_id,
      work_type:       form.work_type || null,
      structure_type:  form.structure_type || null,
      layer_code:      form.layer_code || null,
      element_code:    form.element_code || null,
      activity_code:   form.activity_code.toUpperCase(),
      stage:           (stage || form.stage || form.work_type || 'MISC').toUpperCase(),
      chainage_from:   cf,
      chainage_to:     ct,
      quantity_lm:     finalQuantity,
      quantity:        finalQuantity,
      length_m:        finalLength,
      width_m:         numericWidth,
      depth_m:         numericDepth,
      unit:            finalUnit,
      weather_code:    form.weather_code || null,
      progress_status: form.progress_status || null,
      contractor_name: form.contractor_name || 'Self',
      road_side:       form.road_side    || null,
      rfi_number:      form.rfi_number && form.rfi_number !== '' ? parseInt(form.rfi_number) : null,
      layer_section:   form.layer_section || null,
      remarks:         form.remarks
        ? `${form.remarks}${form.materials.length ? ` | materials:${form.materials.join(',')}` : ''}`
        : (form.materials.length ? `materials:${form.materials.join(',')}` : null),
      entry_date:      toDateString(entryDate),   // ← date picker value
      gps_start_lat:   fp?.lat            || null,
      gps_start_lng:   fp?.lng            || null,
      gps_end_lat:     lp?.lat            || null,
      gps_end_lng:     lp?.lng            || null,
      gps_accuracy_m:  Math.min(fp?.accuracy_m || 0, 9999.99),
    };
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function saveOnlineAfterConfirm(payload, chainageFrom, chainageTo, mediaCount) {
    setLoading(true);
    try {
      const resp = await api.post('/api/capture/', payload);
      const entryId = resp.data.id;
      await addSubmittedEntryId(entryId);
      setLastSaved({
        ...resp.data,
        work_type: payload.work_type,
        structure_type: payload.structure_type,
        element_code: payload.element_code,
        activity_code: payload.activity_code,
      });

      // Start upload in background, then immediately clear form for next entry.
      if (mediaCount > 0) uploadAllForEntry(entryId);
      resetForm();

      showAlert(
        'Entry submitted',
        `${resp.data.activity_code} · ${chainageFrom} → ${chainageTo} · ${payload.quantity_lm ?? 'NA'} ${form.unit || ''}` +
        (mediaCount > 0 ? `\nUploading ${mediaCount} media file(s) in background...` : '') +
        '\nYou can view it in My Entries.'
      );
    } catch (e) {
      console.log('Submit failed:', e.message);
      showAlert('Error', 'Failed to submit entry: ' + getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }
 
  async function submitCapture() {
    if (!form.project_id) { showAlert('Missing', 'No project selected for this user'); return; }
    if (!form.work_type)     { showAlert('Missing', 'Select a Work Type'); return; }
    if (showLayerSelector && !form.layer_code) { showAlert('Missing', 'Select a Layer'); return; }
    if (showElementSelector && !form.element_code) { showAlert('Missing', 'Select an Element'); return; }
    if (!form.activity_code) { showAlert('Missing', 'Select an Activity'); return; }

    const cf = buildDecimalFromSplit(form.chainage_from_km, form.chainage_from_m) ?? parseChainage(form.chainage_from);
    const ct = buildDecimalFromSplit(form.chainage_to_km, form.chainage_to_m) ?? parseChainage(form.chainage_to);
    if (form.work_type === 'ROAD') {
      if (cf === null || ct === null) { showAlert('Invalid chainage', 'Enter chainage in Km and M fields'); return; }
      if (ct <= cf) { showAlert('Invalid chainage', 'To must be greater than From'); return; }
    }

    const payload = buildPayload(cf, ct);
    const chainageFrom = form.chainage_from_km && form.chainage_from_m
      ? `${form.chainage_from_km}+${String(form.chainage_from_m).padStart(3, '0')}`
      : (form.chainage_from || 'NA');
    const chainageTo = form.chainage_to_km && form.chainage_to_m
      ? `${form.chainage_to_km}+${String(form.chainage_to_m).padStart(3, '0')}`
      : (form.chainage_to || 'NA');
    const mediaCount = photoCount + videoCount + fileCount;

    try {
      if (isOffline) {
        setLoading(true);
        // ── Offline path ──────────────────────────────────────────────────────
        const mediaItems = [...photos, ...(video ? [video] : []), ...files];
        const localId = await enqueueEntry(payload, mediaItems);
        setLastSaved({
          activity_code: payload.activity_code,
          work_type: payload.work_type,
          structure_type: payload.structure_type,
          element_code: payload.element_code,
          created_at: new Date().toISOString(),
          offline: true,
        });
        resetForm();  // Clear form immediately after saving offline
        resetMedia(); // Also clear media since it's stored in queue
        showAlert(
          '💾 Saved offline',
          `${payload.activity_code} · ${chainageFrom} → ${chainageTo}\n${mediaItems.length} media file(s) queued — sync from Settings when online.`,
          [{ text: 'OK' }]   // No need for onPress since form is already cleared
        );
        setLoading(false);
      } else {
        // ── Online path: confirm first, then submit ──────────────────────────
        showAlert(
          'Submit entry?',
          `${payload.activity_code} · ${chainageFrom} → ${chainageTo} · ${payload.quantity_lm ?? 'NA'} ${form.unit || ''}` +
          (mediaCount > 0 ? `\n${mediaCount} media file(s) will upload in background after saving.` : ''),
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'OK',
              onPress: () => { void saveOnlineAfterConfirm(payload, chainageFrom, chainageTo, mediaCount); },
            },
          ]
        );
      }
    } catch (e) {
      // ── Error: show message without saving offline ──────────────────────────
      console.log('Submit failed:', e.message);
      showAlert('Error', 'Failed to submit entry: ' + getApiErrorMessage(e));
    } finally {
      if (isOffline) setLoading(false);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function resetForm() {
    setForm({
      project_id: selectedProject?.id || '', work_type: '', structure_type: '', layer_code: '', element_code: '', activity_code: '', stage: '',
      chainage_from_km: '', chainage_from_m: '', chainage_to_km: '', chainage_to_m: '',
      chainage_from: '', chainage_to: '', road_side: '',
      length_m: '', width_m: '', depth_m: '', quantity: '', unit: '', weather_code: '', progress_status: '', materials: [],
      contractor_name: 'Self', rfi_number: '', layer_section: '', remarks: '',
    });
    setEntryDate(new Date());
    setQuantity(null); setTranscript(''); setWaypoints([]);
    setParsedFlags({ is_partial_entry: false, missing_fields: [] });
    resetMedia();
  }

  const isToday = toDateString(entryDate) === toDateString(new Date());

  function handleLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out', style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.replace('Login');
          },
        },
      ]
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Field Capture</Text>
          <Text style={styles.subtitle}>
            M1 · End of Day Entry · {selectedProject ? `${selectedProject.project_code} - ${selectedProject.name}` : 'No project selected'}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪</Text>
        </TouchableOpacity>
      </View>

      {/* Offline banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            {offlineReason === 'no_network'
              ? '📵 No network — entries will save to offline queue'
              : '💾 Offline mode — entries save to queue for manual sync'}
          </Text>
        </View>
      )}

      {lastSaved && (
        <View style={[styles.savedBanner, lastSaved.offline && { backgroundColor: '#fef3c7' }]}>
          <Text style={[styles.savedText, lastSaved.offline && { color: '#92400e' }]}>
            {lastSaved.offline ? '💾 Queued: ' : 'Last saved: '}
            {lastSaved.activity_code} · {new Date(lastSaved.created_at).toLocaleTimeString('en-IN')}
          </Text>
          <Text style={[styles.savedSubText, lastSaved.offline && { color: '#92400e' }]}>
            {'Work Type: '}{lastSaved.work_type || '—'}{'  |  '}
            {'Structure Type: '}{lastSaved.structure_type || '—'}{'  |  '}
            {'Element: '}{lastSaved.element_code || '—'}{'  |  '}
            {'Activity: '}{lastSaved.activity_code || '—'}
          </Text>
        </View>
      )}

      {/* ── Date picker ── */}
      <Text style={styles.label}>Entry Date</Text>
      <View style={styles.section}>
        <TouchableOpacity style={styles.datePicker} onPress={() => setShowDatePick(true)}>
          <Text style={styles.datePickerIcon}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.datePickerValue}>
              {entryDate.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
            {!isToday && (
              <Text style={styles.datePickerPast}>Past date entry</Text>
            )}
          </View>
          {!isToday && (
            <TouchableOpacity onPress={() => setEntryDate(new Date())} style={styles.todayBtn}>
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {showDatePick && (
          <DateTimePicker
            value={entryDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, date) => {
              setShowDatePick(false);
              if (date) setEntryDate(date);
            }}
          />
        )}
      </View>

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

        {(transcript !== '' || whisperStatus === 'uploading') && (
          <View style={styles.transcriptBox}>
            <View style={styles.transcriptHeader}>
              <Text style={styles.transcriptLabel}>Heard</Text>
              <View
                style={[
                  styles.sourceBadge,
                  transcriptSrc === 'ai'
                    ? styles.sourceBadgeAI
                    : whisperStatus === 'error'
                      ? styles.sourceBadgeWarn
                      : styles.sourceBadgeLocal,
                ]}
              >
                <Text style={styles.sourceBadgeText}>
                  {transcriptSrc === 'ai'
                    ? 'AI processed'
                    : effectiveMode === 'offline'
                      ? 'Offline local STT'
                      : whisperStatus === 'uploading'
                        ? 'Sending to AI'
                        : whisperStatus === 'error'
                          ? 'AI unavailable'
                          : 'Local STT'}
                </Text>
              </View>
            </View>
            {whisperStatus === 'uploading' && (
              <View style={styles.whisperRow}>
                <ActivityIndicator size="small" color="#7c3aed" />
                <Text style={styles.whisperText}>Enhancing with AI (Tamil / Hindi / English)...</Text>
              </View>
            )}
            {whisperStatus === 'error' && (
              <Text style={styles.whisperError}>⚠ AI enhance failed — local result kept</Text>
            )}
            <Text style={styles.transcriptText}>{transcript}</Text>
            <Text style={[styles.transcriptLabel, { marginTop: 8 }]}>Parsed into form</Text>
            {parsedFlags.is_partial_entry && (
              <View style={styles.partialEntryBanner}>
                <Text style={styles.partialEntryText}>
                  ⚠ Partial entry — fill in: {parsedFlags.missing_fields.join(', ')}
                </Text>
              </View>
            )}
            <Text style={styles.transcriptText}>
              {'Work Type: '}{form.work_type || '—'}{'\n'}
              {'Structure Type: '}{form.structure_type || '—'}{'\n'}
              {'Layer: '}{form.layer_code || '—'}{'\n'}
              {'Element: '}{form.element_code || '—'}{'\n'}
              {'Activity: '}{form.activity_code || '—'}{'\n'}
              {'Stage: '}{form.stage || '—'}{'\n'}
              {'Chainage: '}
              {form.chainage_from_km && form.chainage_from_m ? `${form.chainage_from_km}+${String(form.chainage_from_m).padStart(3, '0')}` : '—'}
              {' → '}
              {form.chainage_to_km && form.chainage_to_m ? `${form.chainage_to_km}+${String(form.chainage_to_m).padStart(3, '0')}` : '—'}
              {'\n'}
              {'L×B×D: '}{form.length_m || '—'}{' × '}{form.width_m || '—'}{' × '}{form.depth_m || '—'}{'\n'}
              {'Qty: '}{form.quantity || (quantity != null ? String(quantity) : '—')}{' '}{form.unit || ''}{'\n'}
              {'Weather: '}{form.weather_code || '—'}{'\n'}
              {'Status: '}{form.progress_status || '—'}{'\n'}
              {'Materials: '}{form.materials.length ? form.materials.join(', ') : '—'}{'\n'}
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

      {/* Media */}
      <Text style={styles.label}>Photos & Video</Text>
      <View style={styles.section}>
        <View style={styles.mediaActions}>
          <TouchableOpacity
            style={[styles.mediaBtn, photoCount >= maxPhotos && styles.mediaBtnDisabled]}
            onPress={capturePhoto} disabled={photoCount >= maxPhotos}
          >
            <Text style={styles.mediaBtnIcon}>📷</Text>
            <Text style={styles.mediaBtnText}>Photo</Text>
            <Text style={styles.mediaBtnCount}>{photoCount}/{maxPhotos}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mediaBtn, videoCount >= maxVideos && styles.mediaBtnDisabled]}
            onPress={captureVideo} disabled={videoCount >= maxVideos}
          >
            <Text style={styles.mediaBtnIcon}>🎥</Text>
            <Text style={styles.mediaBtnText}>Video</Text>
            <Text style={styles.mediaBtnCount}>{videoCount}/{maxVideos} · max 30s</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mediaBtn, fileCount >= maxFiles && styles.mediaBtnDisabled]}
            onPress={browseFile} disabled={fileCount >= maxFiles}
          >
            <Text style={styles.mediaBtnIcon}>📎</Text>
            <Text style={styles.mediaBtnText}>File</Text>
            <Text style={styles.mediaBtnCount}>{fileCount}/{maxFiles}</Text>
          </TouchableOpacity>
        </View>
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
                <View style={styles.gpsPreviewCard}>
                  <Text style={styles.gpsPreviewLabel}>Stamp Preview</Text>
                  <Text style={styles.gpsPreviewText} numberOfLines={4}>
                    {getPhotoGpsPreview(p)}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
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
        {files.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {files.map((f, i) => (
              <View key={i} style={styles.fileChip}>
                <Text style={styles.fileChipIcon}>📎</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileChipName} numberOfLines={1}>{f.name}</Text>
                  <Text style={styles.fileChipMeta}>{f.sizeMb.toFixed(1)}MB</Text>
                </View>
                <TouchableOpacity onPress={() => removeFile(i)} style={styles.thumbRemove}>
                  <Text style={styles.thumbRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        {uploading && (
          <View style={styles.uploadingRow}>
            <ActivityIndicator size="small" color="#1a1a1a" />
            <Text style={styles.uploadingText}>Uploading media in background...</Text>
          </View>
        )}
      </View>

      <Text style={styles.label}>Work Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
        {WORK_TYPES.map((workType) => (
          <TouchableOpacity
            key={workType.code}
            style={[styles.pill, form.work_type === workType.code && styles.pillActive]}
            onPress={() => updateWorkType(workType.code)}
          >
            <Text style={[styles.pillText, form.work_type === workType.code && styles.pillTextActive]}>{workType.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {showLayerSelector && (
        <>
          <Text style={styles.label}>Layer</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
            {LAYERS.map((layer) => (
              <TouchableOpacity
                key={layer.code}
                style={[styles.pill, form.layer_code === layer.code && styles.pillActive]}
                onPress={() => updateLayer(layer.code)}
              >
                <Text style={[styles.pillText, form.layer_code === layer.code && styles.pillTextActive]}>{layer.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {showElementSelector && (
        <>
          <Text style={styles.label}>Structure Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
            {STRUCTURE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.code}
                style={[styles.pill, form.structure_type === type.code && styles.pillActive]}
                onPress={() => updateStructureType(type.code)}
              >
                <Text style={[styles.pillText, form.structure_type === type.code && styles.pillTextActive]}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Element</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
            {availableElements.map((element) => (
              <TouchableOpacity
                key={element.code}
                style={[styles.pill, form.element_code === element.code && styles.pillActive]}
                onPress={() => updateElement(element.code)}
              >
                <Text style={[styles.pillText, form.element_code === element.code && styles.pillTextActive]}>{element.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Activity */}
      <Text style={styles.label}>Activity</Text>
      {!canChooseActivity && (
        <Text style={styles.helperText}>
          {form.work_type === 'ROAD'
            ? 'Select a layer to see matching road activities.'
            : form.work_type === 'STRUCTURE'
              ? 'Select structure type and element to see structure activities.'
              : 'Select a work type to continue.'}
        </Text>
      )}
      {canChooseActivity && availableActivities.length === 0 && (
        <Text style={styles.helperText}>No activities are mapped for this selection yet.</Text>
      )}
      {canChooseActivity && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
          {availableActivities.map((activity) => (
            <TouchableOpacity
              key={activity.code}
              style={[styles.pill, form.activity_code === activity.code && styles.pillActive]}
              onPress={() => updateActivity(activity.code)}
            >
              <Text style={[styles.pillText, form.activity_code === activity.code && styles.pillTextActive]}>{activity.code}</Text>
              <Text style={[styles.pillSub, form.activity_code === activity.code && styles.pillSubActive]}>{activity.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Chainage */}
      <Text style={styles.label}>Chainage (Km + M)</Text>
      <View style={styles.twoColCompact}>
        <View style={styles.compactCol}>
          <Text style={styles.compactHint}>From Km</Text>
          <TextInput
            style={[styles.input, styles.compactInput]}
            value={form.chainage_from_km}
            onChangeText={v => onChainageFieldChange('chainage_from_km', v)}
            placeholder="45"
            placeholderTextColor="#c7c2c2"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.compactCol}>
          <Text style={styles.compactHint}>From M</Text>
          <TextInput
            style={[styles.input, styles.compactInput]}
            value={form.chainage_from_m}
            onChangeText={v => onChainageFieldChange('chainage_from_m', v)}
            placeholder="100"
            placeholderTextColor="#c7c2c2"
            keyboardType="numeric"
          />
        </View>
      </View>
      <View style={styles.twoColCompact}>
        <View style={styles.compactCol}>
          <Text style={styles.compactHint}>To Km</Text>
          <TextInput
            style={[styles.input, styles.compactInput]}
            value={form.chainage_to_km}
            onChangeText={v => onChainageFieldChange('chainage_to_km', v)}
            placeholder="46"
            placeholderTextColor="#c7c2c2"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.compactCol}>
          <Text style={styles.compactHint}>To M</Text>
          <TextInput
            style={[styles.input, styles.compactInput]}
            value={form.chainage_to_m}
            onChangeText={v => onChainageFieldChange('chainage_to_m', v)}
            placeholder="600"
            placeholderTextColor="#c7c2c2"
            keyboardType="numeric"
          />
        </View>
      </View>

      <Text style={styles.label}>Dimensions (Manual or Parsed)</Text>
      <View style={styles.threeColCompact}>
        <View style={styles.compactCol}>
          <Text style={styles.compactHint}>Length m</Text>
          <TextInput style={[styles.input, styles.compactInput]} value={form.length_m} onChangeText={v => update('length_m', v)} placeholder="1500" placeholderTextColor="#c7c2c2" keyboardType="decimal-pad" />
        </View>
        <View style={styles.compactCol}>
          <Text style={styles.compactHint}>Width m</Text>
          <TextInput style={[styles.input, styles.compactInput]} value={form.width_m} onChangeText={v => update('width_m', v)} placeholder="7" placeholderTextColor="#c7c2c2" keyboardType="decimal-pad" />
        </View>
        <View style={styles.compactCol}>
          <Text style={styles.compactHint}>Depth m</Text>
          <TextInput style={[styles.input, styles.compactInput]} value={form.depth_m} onChangeText={v => update('depth_m', v)} placeholder="0.2" placeholderTextColor="#c7c2c2" keyboardType="decimal-pad" />
        </View>
      </View>

      <View style={styles.twoColCompact}>
        <View style={styles.compactCol}>
          <Text style={styles.compactHint}>Quantity</Text>
          <TextInput
            style={[styles.input, styles.compactInput]}
            value={form.quantity}
            onChangeText={v => update('quantity', v)}
            placeholder={quantity != null ? String(quantity) : 'Auto'}
            placeholderTextColor="#c7c2c2"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.compactCol}>
          <Text style={styles.compactHint}>Unit</Text>
          <TextInput style={[styles.input, styles.compactInput]} value={form.unit} onChangeText={v => update('unit', v.toUpperCase())} placeholder="CUM / TON / KG" placeholderTextColor="#c7c2c2" />
        </View>
      </View>

      {form.materials.length > 0 && (
        <View style={styles.materialWrap}>
          {form.materials.map((mat) => (
            <View key={mat} style={styles.materialChip}>
              <Text style={styles.materialChipText}>{mat}</Text>
            </View>
          ))}
        </View>
      )}
      {quantity !== null && (
        <View style={styles.qtyCard}>
          <Text style={styles.qtyVal}>{quantity.toLocaleString()}</Text>
          <Text style={styles.qtyUnit}> {form.unit || 'auto unit'}</Text>
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

      <Text style={styles.label}>Weather</Text>
      <View style={styles.rsRow}>
        {WEATHER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.rsBtn, (form.weather_code === option.value || liveVoiceSelections.weather_code === option.value) && styles.rsBtnActive]}
            onPress={() => update('weather_code', option.value)}
          >
            <Text style={[styles.rsBtnText, (form.weather_code === option.value || liveVoiceSelections.weather_code === option.value) && styles.rsBtnTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Status</Text>
      <View style={styles.rsRow}>
        {PROGRESS_STATUS_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.rsBtn, (form.progress_status === option.value || liveVoiceSelections.progress_status === option.value) && styles.rsBtnActive]}
            onPress={() => update('progress_status', option.value)}
          >
            <Text style={[styles.rsBtnText, (form.progress_status === option.value || liveVoiceSelections.progress_status === option.value) && styles.rsBtnTextActive]}>{option.label}</Text>
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
      <TouchableOpacity
        style={[styles.submitBtn, isOffline && styles.submitBtnOffline, (loading || networkLoading) && { opacity: 0.6 }]}
        onPress={submitCapture}
        disabled={loading || networkLoading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitText}>{networkLoading ? 'Checking network mode...' : isOffline ? '💾 Save Offline' : 'Submit Capture Entry'}</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.clearBtn} onPress={resetForm}>
        <Text style={styles.clearText}>Clear Form</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f5f5f0' },
  header:           { backgroundColor: '#1a1a1a', padding: 20, paddingTop: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerContent:    { flex: 1 },
  title:            { fontSize: 22, fontWeight: '700', color: '#fff' },
  subtitle:         { fontSize: 12, color: '#777', marginTop: 2 },
  offlineBanner:    { backgroundColor: '#1a1a1a', padding: 10, paddingHorizontal: 16 },
  offlineBannerText:{ fontSize: 12, color: '#f59e0b', fontWeight: '500' },
  savedBanner:      { backgroundColor: '#e8f5e9', padding: 10, paddingHorizontal: 16 },
  savedText:        { fontSize: 12, color: '#2e7d32', fontWeight: '500' },
  savedSubText:     { fontSize: 11, color: '#2e7d32', marginTop: 2 },
  section:          { marginHorizontal: 16, marginTop: 8 },
  label:            { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  // Date picker
  datePicker:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  datePickerIcon:   { fontSize: 20 },
  datePickerValue:  { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  datePickerPast:   { fontSize: 11, color: '#f59e0b', marginTop: 2, fontWeight: '500' },
  todayBtn:         { backgroundColor: '#f0f0f0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  todayBtnText:     { fontSize: 12, color: '#555', fontWeight: '600' },
  // Voice
  voiceBtn:         { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 20, alignItems: 'center' },
  voiceBtnRec:      { backgroundColor: '#c62828' },
  voiceIcon:        { fontSize: 32, marginBottom: 6 },
  voiceBtnText:     { color: '#fff', fontSize: 15, fontWeight: '600' },
  voiceHint:        { color: '#aaa', fontSize: 12, marginTop: 6 },
  transcriptBox:    { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginTop: 10, borderLeftWidth: 3, borderLeftColor: '#1a1a1a' },
  transcriptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  transcriptLabel:  { fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 4 },
  transcriptText:   { fontSize: 13, color: '#333', lineHeight: 20 },
  sourceBadge:      { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  sourceBadgeLocal: { backgroundColor: '#f0f0f0' },
  sourceBadgeAI:    { backgroundColor: '#ede9fe' },
  sourceBadgeWarn:  { backgroundColor: '#fee2e2' },
  sourceBadgeText:  { fontSize: 10, fontWeight: '600', color: '#555' },
  whisperRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  whisperText:      { fontSize: 11, color: '#7c3aed', fontWeight: '500', flex: 1 },
  whisperError:     { fontSize: 11, color: '#dc2626', marginBottom: 6 },
  partialEntryBanner: { backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#d97706' },
  partialEntryText:   { fontSize: 12, color: '#92400e', fontWeight: '600' },
  // GPS
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
  gpsPreviewCard:   { width: 140, marginTop: 6, backgroundColor: '#111827', borderRadius: 8, padding: 6 },
  gpsPreviewLabel:  { fontSize: 9, color: '#cbd5e1', textTransform: 'uppercase', marginBottom: 2 },
  gpsPreviewText:   { fontSize: 10, color: '#f9fafb', lineHeight: 13 },
  videoChip:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#e0e0e0' },
  videoChipIcon:    { fontSize: 22 },
  videoChipName:    { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  videoChipMeta:    { fontSize: 11, color: '#aaa', marginTop: 2 },
  uploadingRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  uploadingText:    { fontSize: 12, color: '#666' },
  fileChip:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, marginRight: 8, minWidth: 200 },
  fileChipIcon:     { fontSize: 16, marginRight: 8 },
  fileChipName:     { fontSize: 14, fontWeight: '500', color: '#1a1a1a', flex: 1 },
  fileChipMeta:     { fontSize: 12, color: '#666' },
  // Form
  pillScroll:       { paddingHorizontal: 16, marginBottom: 4 },
  pill:             { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', marginRight: 8, alignItems: 'center' },
  pillActive:       { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  pillText:         { fontSize: 13, fontWeight: '600', color: '#555' },
  pillTextActive:   { color: '#fff' },
  pillSub:          { fontSize: 10, color: '#aaa', marginTop: 2 },
  pillSubActive:    { color: '#888' },
  helperText:       { fontSize: 12, color: '#666', marginHorizontal: 16, marginBottom: 4 },
  input:            { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 15, marginHorizontal: 16, color: '#1a1a1a', marginBottom: 4 },
  chainageRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  chainageInput:    { flex: 1, marginHorizontal: 0 },
  chainageSep:      { fontSize: 20, color: '#bbb' },
  twoColCompact:    { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  threeColCompact:  { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  compactCol:       { flex: 1 },
  compactHint:      { fontSize: 11, color: '#777', marginBottom: 4, marginHorizontal: 2 },
  compactInput:     { marginHorizontal: 0, paddingVertical: 9, fontSize: 14 },
  materialWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginTop: 6 },
  materialChip:     { backgroundColor: '#111827', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  materialChipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
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
  submitBtnOffline: { backgroundColor: '#92400e' },
  submitText:       { color: '#fff', fontSize: 16, fontWeight: '600' },
  clearBtn:         { alignItems: 'center', marginBottom: 8 },
  clearText:        { color: '#aaa', fontSize: 13 },
  logoutBtn:        { padding: 12, borderRadius: 8, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  logoutText:       { fontSize: 18 },
});