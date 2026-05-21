import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getInfoAsync } from 'expo-file-system/legacy';
import api from '../services/api';
import { useNetworkMode } from '../hooks/useNetworkMode';
import { addSubmittedEntryId, loadQueue, removeFromQueue, markFailed, updateQueueEntry } from '../utils/offlineQueue';
import { capturePhotoWithGPSOverlay } from '../utils/gpsOverlay';
import { getSelectedProject } from '../services/session';
import {
  WORK_TYPES,
  LAYERS,
  STRUCTURE_TYPES,
  getActivitiesForWorkType,
  getRoadActivitiesForLayer,
  getStructureElementsForType,
  getStructureActivitiesForSelection,
  deriveStageFromSelection,
  STRUCTURE_ELEMENT_ACTIVITY_MAP,
} from '../constants/data';

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

function normalizeProgressStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized === 'IN_PROGRESS' || normalized === 'IN PROGRESS' || normalized === 'ONGOING') return 'ONGOING';
  if (normalized === 'COMPLETED') return 'COMPLETED';
  if (normalized === 'STARTED') return 'STARTED';
  return '';
}

function inferMediaType(mediaItem = {}) {
  const type = String(mediaItem.type || '').toLowerCase();
  if (type === 'photo' || type === 'video') return type;

  const mime = String(mediaItem.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';

  const name = String(mediaItem.name || mediaItem.uri || '').toLowerCase();
  if (/\.(jpg|jpeg|png|gif|bmp|webp|heic)$/.test(name)) return 'photo';
  if (/\.(mp4|mov|avi|mkv|3gp|webm|m4v)$/.test(name)) return 'video';

  return null;
}

function inferMimeType(mediaItem = {}, mediaType) {
  const mime = String(mediaItem.mimeType || '').toLowerCase();
  if (mime) return mime;
  return mediaType === 'photo' ? 'image/jpeg' : 'video/mp4';
}

function toPositiveNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function StatusBadge({ status }) {
  const map = {
    pending: { bg: '#fef3c7', text: '#92400e', label: 'Pending Sync' },
    failed: { bg: '#fee2e2', text: '#991b1b', label: 'Failed' },
  };
  const s = map[status] || map.pending;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text>
    </View>
  );
}

function SubmissionBadge({ approved, rejected }) {
  const badge = rejected
    ? { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' }
    : approved
      ? { bg: '#dcfce7', text: '#166534', label: 'Approved' }
      : { bg: '#fef3c7', text: '#92400e', label: 'Submitted' };

  return (
    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
      <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
    </View>
  );
}

export default function EntriesScreen() {
  const navigation = useNavigation();
  const { effectiveMode } = useNetworkMode();

  const [queue, setQueue] = useState([]);
  const [remoteEntries, setRemoteEntries] = useState([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState('');
  const [syncingId, setSyncingId] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState(null);

  // Edit modal state
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editDate, setEditDate] = useState(new Date());
  const [showEditDatePick, setShowEditDatePick] = useState(false);
  const [editMediaItems, setEditMediaItems] = useState([]);
  const [editQuantity, setEditQuantity] = useState(null);
  const [mediaBusy, setMediaBusy] = useState(false);

  const showEditLayerSelector = editForm.work_type === 'ROAD';
  const showEditStructureTypeSelector = editForm.work_type === 'STRUCTURE';
  const showEditElementSelector = editForm.work_type === 'STRUCTURE';
  const editAvailableElements = showEditElementSelector ? getStructureElementsForType(editForm.structure_type) : [];
  const editAvailableActivities = showEditLayerSelector
    ? getRoadActivitiesForLayer(editForm.layer_code)
    : showEditElementSelector
      ? getStructureActivitiesForSelection(editForm.structure_type, editForm.element_code)
      : getActivitiesForWorkType(editForm.work_type);

  useFocusEffect(useCallback(() => {
    void refreshEntries();
  }, [effectiveMode]));

  async function refreshEntries() {
    const project = await getSelectedProject();
    setSelectedProject(project);
    const activeProjectId = project?.id;

    const q = await loadQueue();
    setQueue(q);

    if (effectiveMode !== 'online') {
      setRemoteError('');
      return;
    }

    if (!activeProjectId) {
      setRemoteEntries([]);
      setRemoteError('No project selected for this user.');
      return;
    }

    setLoadingRemote(true);
    try {
      const resp = await api.get('/api/capture/', { params: { project_id: activeProjectId, limit: 100 } });
      const entries = Array.isArray(resp.data?.entries) ? resp.data.entries : [];

      setRemoteEntries(entries);
      setRemoteError('');
    } catch (e) {
      setRemoteError(e?.message || 'Could not load submitted entries.');
    } finally {
      setLoadingRemote(false);
    }
  }

  // ── Chainage helpers ──────────────────────────────────────────────────────
  function floatToChainageFmt(val) {
    if (val === null || val === undefined || val === '') return '';
    const n = parseFloat(val);
    if (isNaN(n)) return String(val);
    const km = Math.floor(n);
    const m = Math.round((n - km) * 1000);
    return `${km}+${String(m).padStart(3, '0')}`;
  }

  function chainageFmtToFloat(val) {
    if (!val) return null;
    const raw = String(val).trim().toLowerCase();
    const normalized = raw.replace(/\s+/g, ' ');

    const explicitKmM = normalized.match(/^(\d{1,4})\s*km\s*(\d{1,3})\s*m$/);
    if (explicitKmM) return Number(explicitKmM[1]) + Number(explicitKmM[2]) / 1000;

    const plus = raw.match(/^(\d{1,4})\+(\d{1,3})$/);
    if (plus) return Number(plus[1]) + Number(plus[2]) / 1000;

    const spacedCompact = raw.match(/^(\d{1,4})\s+(\d{3})$/);
    if (spacedCompact) return Number(spacedCompact[1]) + Number(spacedCompact[2]) / 1000;

    const compact = raw.match(/^(\d{4,6})$/);
    if (compact) {
      if (compact[1].length === 4 && compact[1].endsWith('00')) {
        return Number(compact[1].slice(0, 2));
      }
      const n = Number(compact[1]);
      return Math.floor(n / 1000) + (n % 1000) / 1000;
    }

    const hundred = raw.match(/^(\d{1,4})\s*hundred$/);
    if (hundred) return Number(hundred[1]) + 0.1;

    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function parseOptionalNumber(val) {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  // ── Infer work type ───────────────────────────────────────────────────────
  function inferWorkType(stageCode, activityCode) {
    if (LAYERS.some((layer) => layer.code === stageCode)) return 'ROAD';
    if (['DRAIN', 'ANCILLARY', 'MISC'].includes(stageCode)) return stageCode;
    if (Object.values(STRUCTURE_ELEMENT_ACTIVITY_MAP).some((elementMap) => Object.keys(elementMap).includes(stageCode))) {
      return 'STRUCTURE';
    }
    const activity = ['ROAD', 'STRUCTURE', 'DRAIN', 'ANCILLARY', 'MISC']
      .flatMap((workType) => getActivitiesForWorkType(workType))
      .find((item) => item.code === activityCode);
    if (activity?.workTypes?.includes('ROAD')) return 'ROAD';
    if (activity?.workTypes?.includes('STRUCTURE')) return 'STRUCTURE';
    if (activity?.workTypes?.includes('DRAIN')) return 'DRAIN';
    if (activity?.workTypes?.includes('ANCILLARY')) return 'ANCILLARY';
    if (activity?.workTypes?.includes('MISC')) return 'MISC';
    return '';
  }

  function inferStructureType(stageCode, activityCode) {
    if (!stageCode) return '';
    for (const structureType of STRUCTURE_TYPES) {
      const mappedActivities = STRUCTURE_ELEMENT_ACTIVITY_MAP[structureType.code]?.[stageCode] || [];
      if (!mappedActivities.length) continue;
      if (!activityCode || mappedActivities.includes(activityCode)) return structureType.code;
    }
    return '';
  }

  async function uploadMediaForEntry(entryId, mediaItem) {
    const mediaType = inferMediaType(mediaItem);
    if (!mediaType) {
      throw new Error(`Unsupported media type for ${mediaItem.name || 'file'}. Only photo/video is allowed.`);
    }

    const formData = new FormData();
    formData.append('entry_id', entryId);
    formData.append('media_type', mediaType);

    if (Platform.OS === 'web') {
      const response = await fetch(mediaItem.uri);
      const blob = await response.blob();
      formData.append('file', blob, mediaItem.name);
    } else {
      formData.append('file', {
        uri: mediaItem.uri,
        name: mediaItem.name,
        type: inferMimeType(mediaItem, mediaType),
      });
    }

    await api.post('/api/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  }

  async function retrySync(item) {
    if (effectiveMode === 'offline') {
      Alert.alert('Offline Mode', 'Cannot sync while offline. Switch to online mode first.');
      return;
    }

    setSyncingId(item.localId);
    try {
      const payload = { ...item.payload };
      if (payload.entry_date && typeof payload.entry_date !== 'string') {
        payload.entry_date = String(payload.entry_date);
      }

      const resp = await api.post('/api/capture/', payload);
      const entryId = resp.data.id;

      if (item.mediaItems?.length) {
        for (const mediaItem of item.mediaItems) {
          await uploadMediaForEntry(entryId, mediaItem);
        }
      }

      await addSubmittedEntryId(entryId);
      await removeFromQueue(item.localId);
      await refreshEntries();
      Alert.alert('Uploaded', 'Queued entry synced successfully.');
    } catch (e) {
      const reason = e?.response?.data?.detail
        ? JSON.stringify(e.response.data.detail)
        : e.message || 'Network error';
      await markFailed(item.localId, reason);
      await refreshEntries();
      Alert.alert('Sync failed', reason);
    } finally {
      setSyncingId('');
    }
  }

  function confirmDelete(item) {
    Alert.alert(
      'Delete queued entry?',
      `${item.payload.activity_code} · ${item.payload.stage}\n${item.payload.chainage_from} → ${item.payload.chainage_to}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeFromQueue(item.localId);
            await refreshEntries();
          },
        },
      ]
    );
  }

  // ── Edit modal handlers ────────────────────────────────────────────────────
  function openEdit(item) {
    const cf = floatToChainageFmt(item.payload.chainage_from);
    const ct = floatToChainageFmt(item.payload.chainage_to);
    const f = chainageFmtToFloat(cf);
    const t = chainageFmtToFloat(ct);
    const chainageLength = f !== null && t !== null && t > f ? Math.round((t - f) * 1000) : null;
    setEditQuantity(chainageLength);

    const dateStr = item.payload.entry_date || '';
    const parsedDate = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const workType = item.payload.work_type || inferWorkType(item.payload.stage, item.payload.activity_code);
    const structureType = workType === 'STRUCTURE'
      ? (item.payload.structure_type || inferStructureType(item.payload.stage, item.payload.activity_code))
      : '';
    const layerCode = workType === 'ROAD' ? (item.payload.layer_code || item.payload.stage || '') : '';
    const elementCode = workType === 'STRUCTURE' ? (item.payload.element_code || item.payload.stage || '') : '';

    const prefLength = toPositiveNumberOrNull(item.payload.length_m);
    const prefWidth = toPositiveNumberOrNull(item.payload.width_m);
    const prefDepth = toPositiveNumberOrNull(item.payload.depth_m);
    const prefUnit = item.payload.unit || ((prefWidth != null && prefDepth != null) ? 'CUM' : '');

    setEditDate(isNaN(parsedDate) ? new Date() : parsedDate);
    setEditMediaItems(item.mediaItems ? [...item.mediaItems] : []);
    setEditItem(item);
    setEditForm({
      work_type: workType,
      structure_type: structureType,
      layer_code: layerCode,
      element_code: elementCode,
      activity_code: item.payload.activity_code || '',
      stage: item.payload.stage || '',
      chainage_from: cf,
      chainage_to: ct,
      road_side: item.payload.road_side || '',
      contractor_name: item.payload.contractor_name || 'Self',
      rfi_number: item.payload.rfi_number ? String(item.payload.rfi_number) : '',
      layer_section: item.payload.layer_section || '',
      length_m: prefLength != null ? String(prefLength) : (chainageLength != null ? String(chainageLength) : ''),
      width_m: prefWidth != null ? String(prefWidth) : '',
      depth_m: prefDepth != null ? String(prefDepth) : '',
      quantity: item.payload.quantity != null ? String(item.payload.quantity) : (item.payload.quantity_lm != null ? String(item.payload.quantity_lm) : ''),
      unit: prefUnit,
      weather_code: item.payload.weather_code || '',
      progress_status: normalizeProgressStatus(item.payload.progress_status),
      remarks: item.payload.remarks || '',
    });
  }

  function updateEditWorkType(workType) {
    setEditForm((prev) => ({
      ...prev,
      work_type: workType,
      structure_type: '',
      layer_code: '',
      element_code: '',
      activity_code: '',
      stage: deriveStageFromSelection({ workType, layerCode: '', elementCode: '' }),
    }));
  }

  function updateEditStructureType(structureType) {
    setEditForm((prev) => ({
      ...prev,
      structure_type: structureType,
      element_code: '',
      activity_code: '',
      stage: deriveStageFromSelection({ workType: prev.work_type, layerCode: '', elementCode: '' }),
    }));
  }

  function updateEditLayer(layerCode) {
    setEditForm((prev) => ({
      ...prev,
      layer_code: layerCode,
      element_code: '',
      activity_code: '',
      stage: deriveStageFromSelection({ workType: prev.work_type, layerCode, elementCode: '' }),
    }));
  }

  function updateEditElement(elementCode) {
    setEditForm((prev) => ({
      ...prev,
      element_code: elementCode,
      layer_code: '',
      activity_code: '',
      stage: deriveStageFromSelection({ workType: prev.work_type, layerCode: '', elementCode }),
    }));
  }

  function updateEditActivity(activityCode) {
    setEditForm((prev) => ({
      ...prev,
      activity_code: activityCode,
      stage: deriveStageFromSelection({
        workType: prev.work_type,
        layerCode: prev.layer_code,
        elementCode: prev.element_code,
      }),
    }));
  }

  async function saveEdit() {
    if (!editItem) return;
    if (!editForm.work_type) {
      Alert.alert('Missing', 'Select a Work Type');
      return;
    }
    if (showEditStructureTypeSelector && !editForm.structure_type) {
      Alert.alert('Missing', 'Select a Structure Type');
      return;
    }
    if (showEditLayerSelector && !editForm.layer_code) {
      Alert.alert('Missing', 'Select a Layer');
      return;
    }
    if (showEditElementSelector && !editForm.element_code) {
      Alert.alert('Missing', 'Select an Element');
      return;
    }
    if (!editForm.activity_code) {
      Alert.alert('Missing', 'Select an Activity');
      return;
    }

    const cf = chainageFmtToFloat(editForm.chainage_from);
    const ct = chainageFmtToFloat(editForm.chainage_to);
    const stage = deriveStageFromSelection({
      workType: editForm.work_type,
      layerCode: editForm.layer_code,
      elementCode: editForm.element_code,
    });

    const y = editDate.getFullYear();
    const mo = String(editDate.getMonth() + 1).padStart(2, '0');
    const d = String(editDate.getDate()).padStart(2, '0');
    const chainageLengthM = cf !== null && ct !== null && ct > cf ? Math.round((ct - cf) * 1000) : null;
    const lengthM = parseOptionalNumber(editForm.length_m) ?? chainageLengthM;
    const widthM = parseOptionalNumber(editForm.width_m);
    const depthM = parseOptionalNumber(editForm.depth_m);
    const manualQty = parseOptionalNumber(editForm.quantity);
    let finalQty = manualQty ?? chainageLengthM ?? parseOptionalNumber(editItem.payload.quantity_lm);
    if (lengthM != null && widthM != null && depthM != null) {
      finalQty = Number((lengthM * widthM * depthM).toFixed(3));
    }

    const updated = {
      ...editItem.payload,
      work_type: editForm.work_type || null,
      structure_type: editForm.structure_type || null,
      layer_code: editForm.layer_code || null,
      element_code: editForm.element_code || null,
      activity_code: editForm.activity_code || editItem.payload.activity_code,
      stage: stage || editItem.payload.stage,
      chainage_from: cf ?? editItem.payload.chainage_from,
      chainage_to: ct ?? editItem.payload.chainage_to,
      road_side: editForm.road_side || null,
      contractor_name: editForm.contractor_name || 'Self',
      rfi_number: editForm.rfi_number ? parseInt(editForm.rfi_number, 10) : null,
      layer_section: editForm.layer_section || null,
      length_m: lengthM,
      width_m: widthM,
      depth_m: depthM,
      quantity: finalQty,
      unit: editForm.unit || null,
      weather_code: editForm.weather_code || null,
      progress_status: normalizeProgressStatus(editForm.progress_status) || null,
      remarks: editForm.remarks || null,
      entry_date: `${y}-${mo}-${d}`,
      quantity_lm: finalQty,
    };

    await updateQueueEntry(editItem.localId, updated, editMediaItems);
    setEditItem(null);
    await refreshEntries();
    Alert.alert('Saved', 'Entry updated in queue.');
  }

  function onEditChainageChange(key, val) {
    setEditForm((prev) => {
      const next = { ...prev, [key]: val };
      const f = chainageFmtToFloat(next.chainage_from);
      const t = chainageFmtToFloat(next.chainage_to);
      const chainageLengthM = f !== null && t !== null && t > f ? Math.round((t - f) * 1000) : null;
      setEditQuantity(chainageLengthM);
      // Update length_m from chainage difference
      if (chainageLengthM !== null) {
        next.length_m = String(chainageLengthM);
        // Recalculate quantity with new length
        const w = parseOptionalNumber(next.width_m);
        const d = parseOptionalNumber(next.depth_m);
        if (w != null && d != null) {
          next.quantity = String(Number((chainageLengthM * w * d).toFixed(3)));
        } else {
          next.quantity = String(chainageLengthM);
        }
      }
      return next;
    });
  }

  function onEditDimensionChange(field, value) {
    setEditForm((prev) => {
      const next = { ...prev, [field]: value };
      const cf = chainageFmtToFloat(next.chainage_from);
      const ct = chainageFmtToFloat(next.chainage_to);
      const chainageLengthM = cf !== null && ct !== null && ct > cf ? Math.round((ct - cf) * 1000) : null;
      const l = parseOptionalNumber(next.length_m) ?? chainageLengthM;
      const w = parseOptionalNumber(next.width_m);
      const d = parseOptionalNumber(next.depth_m);
      if (l != null && w != null && d != null) {
        next.quantity = String(Number((l * w * d).toFixed(3)));
      } else if (l != null && w == null && d == null) {
        next.quantity = String(l);
      }
      return next;
    });
  }

  function getEditMediaCounts() {
    const photos = editMediaItems.filter((m) => inferMediaType(m) === 'photo').length;
    const videos = editMediaItems.filter((m) => inferMediaType(m) === 'video').length;
    const files = editMediaItems.filter((m) => m.source === 'file').length;
    return { photos, videos, files };
  }

  function removeEditMediaAt(index) {
    setEditMediaItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function ensureCameraPermission() {
    const res = await ImagePicker.requestCameraPermissionsAsync();
    if (res.status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to capture media.');
      return false;
    }
    return true;
  }

  async function captureEditPhoto() {
    const { photos } = getEditMediaCounts();
    if (photos >= 3) {
      Alert.alert('Limit reached', 'Maximum 3 photos per entry.');
      return;
    }
    const ok = await ensureCameraPermission();
    if (!ok) return;

    setMediaBusy(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const stamped = await capturePhotoWithGPSOverlay(asset.uri);
      const stampedUri = stamped?.imageUri || asset.uri;
      let sizeMb = 0;
      if (Platform.OS !== 'web') {
        const info = await getInfoAsync(stampedUri, { size: true });
        sizeMb = (info.size || 0) / (1024 * 1024);
      }
      setEditMediaItems((prev) => [
        ...prev,
        {
          uri: stampedUri,
          type: 'photo',
          source: 'camera',
          mimeType: asset.mimeType || 'image/jpeg',
          name: `photo_${Date.now()}.jpg`,
          sizeMb,
          locationData: stamped?.locationData || null,
        },
      ]);
    } finally {
      setMediaBusy(false);
    }
  }

  async function captureEditVideo() {
    const { videos } = getEditMediaCounts();
    if (videos >= 1) {
      Alert.alert('Limit reached', 'Maximum 1 video per entry.');
      return;
    }
    const ok = await ensureCameraPermission();
    if (!ok) return;

    setMediaBusy(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 30,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      let sizeMb = 0;
      if (Platform.OS !== 'web') {
        const info = await getInfoAsync(asset.uri, { size: true });
        sizeMb = (info.size || 0) / (1024 * 1024);
      }
      setEditMediaItems((prev) => [
        ...prev,
        {
          uri: asset.uri,
          type: 'video',
          source: 'camera',
          mimeType: asset.mimeType || 'video/mp4',
          name: `video_${Date.now()}.mp4`,
          sizeMb,
        },
      ]);
    } finally {
      setMediaBusy(false);
    }
  }

  async function pickEditFile() {
    const { files } = getEditMediaCounts();
    if (files >= 2) {
      Alert.alert('Limit reached', 'Maximum 2 files per entry.');
      return;
    }

    setMediaBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      const mediaType = inferMediaType({
        type: asset.type,
        mimeType: asset.mimeType,
        name: asset.name,
        uri: asset.uri,
      });
      if (!mediaType) {
        Alert.alert('Unsupported file', 'Only image or video files can be attached.');
        return;
      }

      let sizeMb = 0;
      if (Platform.OS !== 'web') {
        const info = await getInfoAsync(asset.uri, { size: true });
        sizeMb = (info.size || 0) / (1024 * 1024);
      }

      setEditMediaItems((prev) => [
        ...prev,
        {
          uri: asset.uri,
          type: mediaType,
          source: 'file',
          mimeType: asset.mimeType,
          name: asset.name || `${mediaType}_${Date.now()}`,
          sizeMb,
        },
      ]);
    } finally {
      setMediaBusy(false);
    }
  }

  const counts = useMemo(() => ({
    all: queue.length,
    pending: queue.filter((item) => item.syncStatus === 'pending').length,
    failed: queue.filter((item) => item.syncStatus === 'failed').length,
  }), [queue]);

  const filteredQueue = useMemo(() => {
    if (filter === 'all') return queue;
    return queue.filter((item) => item.syncStatus === filter);
  }, [queue, filter]);

  const editPhotos = editMediaItems.filter((m) => inferMediaType(m) === 'photo');
  const editVideos = editMediaItems.filter((m) => inferMediaType(m) === 'video');
  const editFiles = editMediaItems.filter((m) => m.source === 'file');
  const hasAnyEntries = remoteEntries.length > 0 || filteredQueue.length > 0;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={styles.title}>My Entries</Text>
          <Text style={styles.subtitle}>Submitted entries and offline sync status</Text>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Submitted Online</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => { void refreshEntries(); }}>
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {selectedProject && (
          <Text style={styles.projectMeta}>
            Project: {selectedProject.project_code} - {selectedProject.name}
          </Text>
        )}

        {loadingRemote && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#1a1a1a" />
            <Text style={styles.loadingText}>Loading submitted entries...</Text>
          </View>
        )}

        {!loadingRemote && remoteError !== '' && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Could not refresh submitted entries</Text>
            <Text style={styles.infoText}>{remoteError}</Text>
          </View>
        )}

        {!loadingRemote && remoteEntries.length === 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>No submitted entries yet</Text>
            <Text style={styles.infoText}>Entries saved online for this project will appear here.</Text>
          </View>
        )}

        {remoteEntries.map((item) => (
          <View key={String(item.id)} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activity}>{item.activity_code} · {item.stage}</Text>
                <Text style={styles.meta}>Entry ID: {String(item.id).slice(0, 8)}...</Text>
                <Text style={styles.meta}>
                  Chainage: {floatToChainageFmt(item.chainage_from)} → {floatToChainageFmt(item.chainage_to)} · {item.quantity_lm ?? item.quantity ?? 'NA'} {item.unit || 'LM'}
                </Text>
                {(item.weather_code || item.progress_status) && (
                  <Text style={styles.meta}>
                    Weather: {item.weather_code || 'NA'} · Status: {item.progress_status || 'NA'}
                  </Text>
                )}
                <Text style={styles.meta}>Submitted: {item.created_at ? new Date(item.created_at).toLocaleString('en-IN') : 'NA'}</Text>
              </View>
              <SubmissionBadge approved={item.approved} rejected={item.rejected} />
            </View>
          </View>
        ))}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Offline Queue</Text>
        </View>

        <View style={styles.filterRow}>
          {[
            { key: 'all', label: `All (${counts.all})` },
            { key: 'pending', label: `Pending (${counts.pending})` },
            { key: 'failed', label: `Failed (${counts.failed})` },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterChip, filter === tab.key && styles.filterChipActive]}
              onPress={() => setFilter(tab.key)}
            >
              <Text style={[styles.filterChipText, filter === tab.key && styles.filterChipTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!hasAnyEntries && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No entries in this view</Text>
            <Text style={styles.emptySub}>Capture online or offline to see your entries here.</Text>
          </View>
        )}

        {hasAnyEntries && filteredQueue.length === 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>No queued offline entries</Text>
            <Text style={styles.infoText}>Offline saves and failed sync items will appear here.</Text>
          </View>
        )}

        {filteredQueue.map((item) => (
          <View key={item.localId} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activity}>{item.payload.activity_code} · {item.payload.stage}</Text>
                {item.payload.work_type && (
                  <Text style={styles.meta}>
                    Path: {item.payload.work_type}
                    {item.payload.structure_type ? ` > ${item.payload.structure_type}` : ''}
                    {item.payload.layer_code ? ` > ${item.payload.layer_code}` : ''}
                    {item.payload.element_code ? ` > ${item.payload.element_code}` : ''}
                  </Text>
                )}
                <Text style={styles.meta}>📅 {item.payload.entry_date}</Text>
                <Text style={styles.meta}>
                  Chainage: {item.payload.chainage_from} → {item.payload.chainage_to} · {item.payload.quantity_lm} LM
                </Text>
                {(item.payload.weather_code || item.payload.progress_status) && (
                  <Text style={styles.meta}>
                    Weather: {item.payload.weather_code || 'NA'} · Status: {item.payload.progress_status || 'NA'}
                  </Text>
                )}
                {item.mediaItems?.length > 0 && (
                  <Text style={styles.meta}>📎 {item.mediaItems.length} media file(s)</Text>
                )}
                <Text style={styles.meta}>Queued: {new Date(item.queuedAt).toLocaleString('en-IN')}</Text>
                {item.failReason && <Text style={styles.failReason}>⚠ {item.failReason}</Text>}
              </View>
              <StatusBadge status={item.syncStatus} />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.retryBtn, syncingId === item.localId && styles.btnDisabled]}
                onPress={() => retrySync(item)}
                disabled={syncingId === item.localId}
              >
                {syncingId === item.localId
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.retryText}>Retry Sync</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, styles.editBtn]} onPress={() => openEdit(item)}>
                <Text style={styles.editText}>✏️ Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, styles.deleteBtn]} onPress={() => confirmDelete(item)}>
                <Text style={styles.deleteText}>🗑 Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={!!editItem} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Queued Entry</Text>
            <TouchableOpacity onPress={() => setEditItem(null)}>
              <Text style={styles.modalClose}>✕ Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Entry Date</Text>
            <TouchableOpacity style={styles.modalDatePicker} onPress={() => setShowEditDatePick(true)}>
              <Text style={styles.modalDateIcon}>📅</Text>
              <Text style={styles.modalDateValue}>
                {editDate.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
            {showEditDatePick && (
              <DateTimePicker
                value={editDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={(_, date) => {
                  setShowEditDatePick(false);
                  if (date) setEditDate(date);
                }}
              />
            )}
          </View>

          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Work Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalPillScroll}>
              {WORK_TYPES.map((workType) => (
                <TouchableOpacity
                  key={workType.code}
                  style={[styles.modalPill, editForm.work_type === workType.code && styles.modalPillActive]}
                  onPress={() => updateEditWorkType(workType.code)}
                >
                  <Text style={[styles.modalPillText, editForm.work_type === workType.code && styles.modalPillTextActive]}>{workType.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {showEditStructureTypeSelector && (
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Structure Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalPillScroll}>
                {STRUCTURE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.code}
                    style={[styles.modalPill, editForm.structure_type === type.code && styles.modalPillActive]}
                    onPress={() => updateEditStructureType(type.code)}
                  >
                    <Text style={[styles.modalPillText, editForm.structure_type === type.code && styles.modalPillTextActive]}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {showEditLayerSelector && (
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Layer</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalPillScroll}>
                {LAYERS.map((layer) => (
                  <TouchableOpacity
                    key={layer.code}
                    style={[styles.modalPill, editForm.layer_code === layer.code && styles.modalPillActive]}
                    onPress={() => updateEditLayer(layer.code)}
                  >
                    <Text style={[styles.modalPillText, editForm.layer_code === layer.code && styles.modalPillTextActive]}>{layer.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {showEditElementSelector && (
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Element</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalPillScroll}>
                {editAvailableElements.map((element) => (
                  <TouchableOpacity
                    key={element.code}
                    style={[styles.modalPill, editForm.element_code === element.code && styles.modalPillActive]}
                    onPress={() => updateEditElement(element.code)}
                  >
                    <Text style={[styles.modalPillText, editForm.element_code === element.code && styles.modalPillTextActive]}>{element.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Activity</Text>
            {!editForm.work_type && (
              <Text style={styles.modalHelperText}>Select a work type to continue.</Text>
            )}
            {showEditStructureTypeSelector && !editForm.structure_type && (
              <Text style={styles.modalHelperText}>Select a structure type to see valid elements and activities.</Text>
            )}
            {showEditLayerSelector && !editForm.layer_code && (
              <Text style={styles.modalHelperText}>Select a layer to see matching road activities.</Text>
            )}
            {showEditElementSelector && editForm.structure_type && !editForm.element_code && (
              <Text style={styles.modalHelperText}>Select an element to see structure activities.</Text>
            )}
            {editAvailableActivities.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalPillScroll}>
                {editAvailableActivities.map((activity) => (
                  <TouchableOpacity
                    key={activity.code}
                    style={[styles.modalPill, editForm.activity_code === activity.code && styles.modalPillActive]}
                    onPress={() => updateEditActivity(activity.code)}
                  >
                    <Text style={[styles.modalPillText, editForm.activity_code === activity.code && styles.modalPillTextActive]}>{activity.code}</Text>
                    <Text style={[styles.modalPillSub, editForm.activity_code === activity.code && styles.modalPillSubActive]}>{activity.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {[
            { key: 'chainage_from', label: 'Chainage From', placeholder: '1+200', keyboard: 'numeric' },
            { key: 'chainage_to', label: 'Chainage To', placeholder: '1+450', keyboard: 'numeric' },
            { key: 'road_side', label: 'Road Side', placeholder: 'LHS / RHS / Both' },
            { key: 'contractor_name', label: 'Contractor', placeholder: 'Self' },
            { key: 'rfi_number', label: 'RFI Number', placeholder: 'Optional', keyboard: 'numeric' },
            { key: 'layer_section', label: 'Layer / Section', placeholder: 'L1' },
          ].map((f) => (
            <View key={f.key} style={styles.modalField}>
              <Text style={styles.modalLabel}>{f.label}</Text>
              {(f.key === 'chainage_from' || f.key === 'chainage_to') && (
                <Text style={styles.modalHelperText}>Accepted: 45+100, 45100, 45 100, 45 hundred</Text>
              )}
              <TextInput
                style={[styles.modalInput, f.key === 'remarks' && { height: 72, textAlignVertical: 'top' }]}
                value={editForm[f.key] || ''}
                onChangeText={(v) =>
                  f.key === 'chainage_from' || f.key === 'chainage_to'
                    ? onEditChainageChange(f.key, v)
                    : setEditForm((prev) => ({ ...prev, [f.key]: v }))
                }
                placeholder={f.placeholder}
                keyboardType={f.keyboard || 'default'}
                multiline={f.key === 'remarks'}
              />
            </View>
          ))}

          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Weather</Text>
            <View style={styles.modalPillRow}>
              {WEATHER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.modalPill, editForm.weather_code === option.value && styles.modalPillActive]}
                  onPress={() => setEditForm((prev) => ({ ...prev, weather_code: option.value }))}
                >
                  <Text style={[styles.modalPillText, editForm.weather_code === option.value && styles.modalPillTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Status</Text>
            <View style={styles.modalPillRow}>
              {PROGRESS_STATUS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.modalPill, editForm.progress_status === option.value && styles.modalPillActive]}
                  onPress={() => setEditForm((prev) => ({ ...prev, progress_status: option.value }))}
                >
                  <Text style={[styles.modalPillText, editForm.progress_status === option.value && styles.modalPillTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Remarks</Text>
            <TextInput
              style={[styles.modalInput, { height: 72, textAlignVertical: 'top' }]}
              value={editForm.remarks || ''}
              onChangeText={(v) => setEditForm((prev) => ({ ...prev, remarks: v }))}
              placeholder="Weather, delays..."
              multiline
            />
          </View>

          <Text style={styles.modalLabel}>Dimensions & Quantity</Text>
          <View style={styles.modalRow}>
            <View style={styles.modalRowItem}>
              <Text style={styles.modalHelperText}>Length (m)</Text>
              <TextInput
                style={styles.modalInput}
                value={editForm.length_m || ''}
                onChangeText={(v) => onEditDimensionChange('length_m', v)}
                placeholder="Auto from chainage"
                placeholderTextColor="#c7c2c2"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.modalRowItem}>
              <Text style={styles.modalHelperText}>Width (m)</Text>
              <TextInput
                style={styles.modalInput}
                value={editForm.width_m || ''}
                onChangeText={(v) => onEditDimensionChange('width_m', v)}
                placeholder="From voice/manual"
                placeholderTextColor="#c7c2c2"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.modalRow}>
            <View style={styles.modalRowItem}>
              <Text style={styles.modalHelperText}>Depth (m)</Text>
              <TextInput
                style={styles.modalInput}
                value={editForm.depth_m || ''}
                onChangeText={(v) => onEditDimensionChange('depth_m', v)}
                placeholder="From voice/manual"
                placeholderTextColor="#c7c2c2"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.modalRowItem}>
              <Text style={styles.modalHelperText}>Quantity</Text>
              <TextInput
                style={styles.modalInput}
                value={editForm.quantity || ''}
                onChangeText={(v) => setEditForm((prev) => ({ ...prev, quantity: v }))}
                placeholder="6"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Unit</Text>
            <TextInput
              style={styles.modalInput}
              value={editForm.unit || ''}
              onChangeText={(v) => setEditForm((prev) => ({ ...prev, unit: v.toUpperCase() }))}
              placeholder="CUM / TON / KG"
              placeholderTextColor="#c7c2c2"
            />
          </View>

          {editQuantity !== null && (
            <View style={styles.modalQtyCard}>
              <Text style={styles.modalQtyValue}>{editQuantity.toLocaleString()}</Text>
              <Text style={styles.modalQtyUnit}> linear metres</Text>
            </View>
          )}

          <Text style={styles.modalLabel}>Media (Capture Again)</Text>
          <View style={styles.modalMediaActions}>
            <TouchableOpacity
              style={[styles.modalMediaBtn, editPhotos.length >= 3 && styles.modalMediaBtnDisabled]}
              onPress={captureEditPhoto}
              disabled={mediaBusy || editPhotos.length >= 3}
            >
              <Text style={styles.modalMediaBtnIcon}>📷</Text>
              <Text style={styles.modalMediaBtnText}>Photo</Text>
              <Text style={styles.modalMediaBtnCount}>{editPhotos.length}/3</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalMediaBtn, editVideos.length >= 1 && styles.modalMediaBtnDisabled]}
              onPress={captureEditVideo}
              disabled={mediaBusy || editVideos.length >= 1}
            >
              <Text style={styles.modalMediaBtnIcon}>🎥</Text>
              <Text style={styles.modalMediaBtnText}>Video</Text>
              <Text style={styles.modalMediaBtnCount}>{editVideos.length}/1</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalMediaBtn, editFiles.length >= 2 && styles.modalMediaBtnDisabled]}
              onPress={pickEditFile}
              disabled={mediaBusy || editFiles.length >= 2}
            >
              <Text style={styles.modalMediaBtnIcon}>📎</Text>
              <Text style={styles.modalMediaBtnText}>File</Text>
              <Text style={styles.modalMediaBtnCount}>{editFiles.length}/2</Text>
            </TouchableOpacity>
          </View>

          {mediaBusy && (
            <View style={styles.modalUploadingRow}>
              <ActivityIndicator size="small" color="#1a1a1a" />
              <Text style={styles.modalUploadingText}>Preparing media...</Text>
            </View>
          )}

          {editPhotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {editPhotos.map((m, i) => {
                const originalIndex = editMediaItems.indexOf(m);
                return (
                  <View key={`${m.uri}-${i}`} style={styles.modalThumbWrap}>
                    <Image source={{ uri: m.uri }} style={styles.modalThumb} />
                    <View style={styles.modalThumbMeta}>
                      <Text style={styles.modalThumbSize}>{m.sizeMb ? `${m.sizeMb.toFixed(1)}MB` : 'Photo'}</Text>
                      <TouchableOpacity onPress={() => removeEditMediaAt(originalIndex)} style={styles.modalThumbRemove}>
                        <Text style={styles.modalThumbRemoveText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {editVideos.length > 0 &&
            editVideos.map((m, i) => {
              const originalIndex = editMediaItems.indexOf(m);
              return (
                <View key={`${m.uri}-${i}`} style={styles.modalVideoChip}>
                  <Text style={styles.modalVideoChipIcon}>🎥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalVideoChipName}>{m.name || 'video'}</Text>
                    <Text style={styles.modalVideoChipMeta}>{m.sizeMb ? `${m.sizeMb.toFixed(1)}MB` : 'Video file'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeEditMediaAt(originalIndex)} style={styles.modalThumbRemove}>
                    <Text style={styles.modalThumbRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

          {editFiles.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginBottom: 8 }}>
              {editFiles.map((m, i) => (
                <View key={`${m.uri}-${i}`} style={styles.modalFileChip}>
                  <Text style={styles.modalFileChipIcon}>{inferMediaType(m) === 'photo' ? '🖼️' : inferMediaType(m) === 'video' ? '🎬' : '📎'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalFileChipName} numberOfLines={1}>
                      {m.name || 'media file'}
                    </Text>
                    <Text style={styles.modalFileChipMeta}>{m.sizeMb ? `${m.sizeMb.toFixed(1)}MB` : 'Attached'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeEditMediaAt(i)} style={styles.modalThumbRemove}>
                    <Text style={styles.modalThumbRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.saveEditBtn} onPress={saveEdit}>
            <Text style={styles.saveEditText}>Save Changes</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0' },
  header: { backgroundColor: '#1a1a1a', padding: 20, paddingTop: 52 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5 },
  projectMeta: { fontSize: 12, color: '#6b7280', marginHorizontal: 16, marginTop: 6 },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#1a1a1a' },
  refreshBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, margin: 16, marginBottom: 4, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  loadingText: { fontSize: 13, color: '#444' },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, margin: 16, marginBottom: 4, padding: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  infoText: { fontSize: 12, color: '#666', marginTop: 4, lineHeight: 18 },
  filterChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 20, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 7 },
  filterChipActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#555' },
  filterChipTextActive: { color: '#fff' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 12, margin: 16, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  emptySub: { fontSize: 13, color: '#888', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, marginTop: 12, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  activity: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  meta: { fontSize: 12, color: '#555', marginTop: 2 },
  failReason: { fontSize: 11, color: '#dc2626', marginTop: 4, lineHeight: 16 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center' },
  retryBtn: { backgroundColor: '#1a1a1a' },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  editBtn: { backgroundColor: '#e0f2fe' },
  editText: { color: '#075985', fontWeight: '600', fontSize: 13 },
  deleteBtn: { backgroundColor: '#fee2e2' },
  deleteText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
  // Edit modal styles
  modalContainer: { flex: 1, backgroundColor: '#f5f5f0', padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  modalClose: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
  modalField: { marginBottom: 12 },
  modalLabel: { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  modalPillScroll: { marginBottom: 2 },
  modalPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', marginRight: 8, alignItems: 'center' },
  modalPillActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  modalPillText: { fontSize: 13, fontWeight: '600', color: '#555' },
  modalPillTextActive: { color: '#fff' },
  modalPillSub: { fontSize: 10, color: '#aaa', marginTop: 2 },
  modalPillSubActive: { color: '#888' },
  modalHelperText: { fontSize: 12, color: '#666', marginBottom: 4 },
  modalRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  modalRowItem: { flex: 1 },
  modalInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 15, color: '#1a1a1a' },
  modalDatePicker: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  modalDateIcon: { fontSize: 18 },
  modalDateValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  modalQtyCard: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: '#e8f5e9', borderRadius: 8, padding: 10, marginBottom: 12 },
  modalQtyValue: { fontSize: 20, fontWeight: '700', color: '#2e7d32' },
  modalQtyUnit: { fontSize: 12, color: '#4caf50' },
  modalMediaActions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  modalMediaBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  modalMediaBtnDisabled: { opacity: 0.4 },
  modalMediaBtnIcon: { fontSize: 22, marginBottom: 2 },
  modalMediaBtnText: { fontSize: 12, fontWeight: '600', color: '#1a1a1a' },
  modalMediaBtnCount: { fontSize: 10, color: '#999', marginTop: 2 },
  modalUploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  modalUploadingText: { fontSize: 12, color: '#666' },
  modalThumbWrap: { marginRight: 10, alignItems: 'center' },
  modalThumb: { width: 76, height: 76, borderRadius: 8, backgroundColor: '#eee' },
  modalThumbMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  modalThumbSize: { fontSize: 10, color: '#999' },
  modalThumbRemove: { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  modalThumbRemoveText: { fontSize: 11, color: '#dc2626', fontWeight: '700' },
  modalVideoChip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  modalVideoChipIcon: { fontSize: 20 },
  modalVideoChipName: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  modalVideoChipMeta: { fontSize: 11, color: '#888' },
  modalFileChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, marginRight: 8, minWidth: 220 },
  modalFileChipIcon: { fontSize: 16, marginRight: 8 },
  modalFileChipName: { fontSize: 13, fontWeight: '500', color: '#1a1a1a', flex: 1 },
  modalFileChipMeta: { fontSize: 11, color: '#666' },
  saveEditBtn: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  saveEditText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});