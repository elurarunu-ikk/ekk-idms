// ekk-mobile/screens/SettingsScreen.js

import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Switch, TextInput, Modal,
} from 'react-native';
import { Platform, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getInfoAsync } from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useNetworkMode } from '../hooks/useNetworkMode';
import { logout } from '../services/auth';
import {
  loadQueue, removeFromQueue, markFailed,
  updateQueueEntry,
} from '../utils/offlineQueue';
import api from '../services/api';
import { STAGES, ACTIVITY_CODES, ROAD_SIDES } from '../constants/data';

const EDIT_MAX_PHOTOS = 3;
const EDIT_MAX_VIDEOS = 1;
const EDIT_MAX_FILES = 2;

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

export default function SettingsScreen() {
  const navigation = useNavigation();

  // ── Chainage helpers ──────────────────────────────────────────────────────
  function floatToChainageFmt(val) {
    if (val === null || val === undefined || val === '') return '';
    const n = parseFloat(val);
    if (isNaN(n)) return String(val);
    const km = Math.floor(n);
    const m  = Math.round((n - km) * 1000);
    return `${km}+${String(m).padStart(3, '0')}`;
  }

  function chainageFmtToFloat(val) {
    if (!val) return null;
    const m = String(val).match(/^(\d+)\+(\d+)$/);
    if (m) return parseFloat(m[1]) + parseFloat(m[2]) / 1000;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  const {
    isConnected, manualMode, effectiveMode,
    offlineReason, toggleMode,
  } = useNetworkMode();

  const [queue,      setQueue]      = useState([]);
  const [syncing,    setSyncing]    = useState(false);
  const [syncLog,    setSyncLog]    = useState([]);
  const [editItem,   setEditItem]   = useState(null);   // entry being edited
  const [editForm,   setEditForm]   = useState({});     // editable fields
  const [editDate,        setEditDate]        = useState(new Date());
  const [showEditDatePick,setShowEditDatePick] = useState(false);
  const [editMediaItems,  setEditMediaItems]  = useState([]);
  const [editQuantity,    setEditQuantity]    = useState(null);
  const [mediaBusy,       setMediaBusy]       = useState(false);

  useFocusEffect(useCallback(() => {
    refreshQueue();
  }, []));

  async function refreshQueue() {
    const q = await loadQueue();
    setQueue(q);
  }

  // ── Upload media for entry ─────────────────────────────────────────────────
  async function uploadMediaForEntry(entryId, mediaItem) {
    const mediaType = inferMediaType(mediaItem);
    if (!mediaType) {
      throw new Error(`Unsupported media type for ${mediaItem.name || 'file'}. Only photo/video is allowed.`);
    }

    const formData = new FormData();
    formData.append('entry_id', entryId);
    formData.append('media_type', mediaType);

    // Different file format for web vs native
    if (Platform.OS === 'web') {
      // For web, we need to fetch the file as blob
      const response = await fetch(mediaItem.uri);
      const blob = await response.blob();
      formData.append('file', blob, mediaItem.name);
    } else {
      // For native platforms
      formData.append('file', {
        uri:  mediaItem.uri,
        name: mediaItem.name,
        type: inferMimeType(mediaItem, mediaType),
      });
    }

    await api.post('/api/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,   // 60s timeout for large videos
    });
  }

  // ── Sync one entry ─────────────────────────────────────────────────────────
  async function syncOne(item) {
    try {
      // Clean payload before sending — remove any undefined fields
      const payload = { ...item.payload };
      // Ensure entry_date is a string
      if (payload.entry_date && typeof payload.entry_date !== 'string') {
        payload.entry_date = String(payload.entry_date);
      }
      const resp = await api.post('/api/capture/', payload);
      const entryId = resp.data.id;

      // Upload any associated media
      if (item.mediaItems && item.mediaItems.length > 0) {
        console.log(`[sync] Uploading ${item.mediaItems.length} media files for entry ${entryId}`);
        let mediaUploaded = 0;
        let mediaFailed = 0;

        for (const mediaItem of item.mediaItems) {
          try {
            await uploadMediaForEntry(entryId, mediaItem);
            mediaUploaded++;
          } catch (mediaError) {
            console.log(`[sync] Media upload failed for ${mediaItem.name}:`, mediaError.message);
            mediaFailed++;
          }
        }

        console.log(`[sync] Media upload complete: ${mediaUploaded} uploaded, ${mediaFailed} failed`);
      }

      await removeFromQueue(item.localId);
      return { localId: item.localId, ok: true, mediaUploaded: item.mediaItems?.length || 0 };
    } catch (e) {
      const reason = e?.response?.data?.detail
        ? JSON.stringify(e.response.data.detail)
        : e.message || 'Network error';
      await markFailed(item.localId, reason);
      return { localId: item.localId, ok: false, reason };
    }
  }

  // ── Sync all ───────────────────────────────────────────────────────────────
  async function syncAll() {
    if (effectiveMode === 'offline') {
      Alert.alert('Offline Mode', 'Cannot sync while in offline mode. Switch to online mode to sync.');
      return;
    }
    const pending = queue.filter(i => i.syncStatus === 'pending' || i.syncStatus === 'failed');
    if (!pending.length) {
      Alert.alert('Nothing to sync', 'No pending entries in queue.');
      return;
    }
    setSyncing(true);
    setSyncLog([]);
    const log = [];
    for (const item of pending) {
      const result = await syncOne(item);
      log.push(result);
      setSyncLog([...log]);
    }
    await refreshQueue();
    setSyncing(false);
    const ok   = log.filter(r => r.ok).length;
    const fail = log.filter(r => !r.ok).length;
    const totalMedia = log.filter(r => r.ok).reduce((sum, r) => sum + (r.mediaUploaded || 0), 0);
    Alert.alert('Sync complete', `✅ ${ok} entries uploaded${totalMedia > 0 ? ` with ${totalMedia} media files` : ''}${fail > 0 ? `\n❌ ${fail} failed — check errors below` : ''}`);
  }

  // ── Sync single ────────────────────────────────────────────────────────────
  async function syncSingle(item) {
    if (effectiveMode === 'offline') {
      Alert.alert('Offline Mode', 'Cannot sync while in offline mode. Switch to online mode first.');
      return;
    }
    setSyncing(true);
    const result = await syncOne(item);
    await refreshQueue();
    setSyncing(false);
    if (result.ok) {
      const mediaCount = result.mediaUploaded || 0;
      Alert.alert('✅ Uploaded', `Entry synced successfully${mediaCount > 0 ? ` with ${mediaCount} media file(s)` : ''}.`);
    } else {
      Alert.alert('❌ Failed', `${result.reason}\n\nCheck your server is running and reachable.`);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  function confirmDelete(item) {
    Alert.alert(
      'Delete entry?',
      `Activity: ${item.payload.activity_code}\nDate: ${item.payload.entry_date}\nChainage: ${item.payload.chainage_from} → ${item.payload.chainage_to}\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await removeFromQueue(item.localId);
            await refreshQueue();
          },
        },
      ]
    );
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  function openEdit(item) {
    const cf = floatToChainageFmt(item.payload.chainage_from);
    const ct = floatToChainageFmt(item.payload.chainage_to);
    const f  = chainageFmtToFloat(cf);
    const t  = chainageFmtToFloat(ct);
    setEditQuantity(f !== null && t !== null && t > f ? Math.round((t - f) * 1000) : null);
    // Parse stored date string → Date object
    const dateStr = item.payload.entry_date || '';
    const parsedDate = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    setEditDate(isNaN(parsedDate) ? new Date() : parsedDate);
    setEditMediaItems(item.mediaItems ? [...item.mediaItems] : []);
    setEditItem(item);
    setEditForm({
      activity_code:   item.payload.activity_code   || '',
      stage:           item.payload.stage           || '',
      chainage_from:   cf,
      chainage_to:     ct,
      road_side:       item.payload.road_side       || '',
      contractor_name: item.payload.contractor_name || 'Self',
      rfi_number:      item.payload.rfi_number      ? String(item.payload.rfi_number) : '',
      layer_section:   item.payload.layer_section   || '',
      remarks:         item.payload.remarks         || '',
    });
  }

  async function saveEdit() {
    if (!editItem) return;
    const cf = chainageFmtToFloat(editForm.chainage_from);
    const ct = chainageFmtToFloat(editForm.chainage_to);
    const y  = editDate.getFullYear();
    const mo = String(editDate.getMonth() + 1).padStart(2, '0');
    const d  = String(editDate.getDate()).padStart(2, '0');
    const updated = {
      ...editItem.payload,
      activity_code:   editForm.activity_code || editItem.payload.activity_code,
      stage:           editForm.stage         || editItem.payload.stage,
      chainage_from:   cf   ?? editItem.payload.chainage_from,
      chainage_to:     ct   ?? editItem.payload.chainage_to,
      road_side:       editForm.road_side       || null,
      contractor_name: editForm.contractor_name || 'Self',
      rfi_number:      editForm.rfi_number ? parseInt(editForm.rfi_number) : null,
      layer_section:   editForm.layer_section   || null,
      remarks:         editForm.remarks         || null,
      entry_date:      `${y}-${mo}-${d}`,
      quantity_lm:     cf !== null && ct !== null && ct > cf ? Math.round((ct - cf) * 1000) : editItem.payload.quantity_lm,
    };
    await updateQueueEntry(editItem.localId, updated, editMediaItems);
    setEditItem(null);
    await refreshQueue();
    Alert.alert('Saved', 'Entry updated in queue.');
  }

  function onEditChainageChange(key, val) {
    setEditForm(prev => {
      const next = { ...prev, [key]: val };
      const f = chainageFmtToFloat(next.chainage_from);
      const t = chainageFmtToFloat(next.chainage_to);
      setEditQuantity(f !== null && t !== null && t > f ? Math.round((t - f) * 1000) : null);
      return next;
    });
  }

  function getEditMediaCounts() {
    const photos = editMediaItems.filter(m => inferMediaType(m) === 'photo').length;
    const videos = editMediaItems.filter(m => inferMediaType(m) === 'video').length;
    const files = editMediaItems.filter(m => m.source === 'file').length;
    return { photos, videos, files };
  }

  function removeEditMediaAt(index) {
    setEditMediaItems(prev => prev.filter((_, i) => i !== index));
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
    if (photos >= EDIT_MAX_PHOTOS) {
      Alert.alert('Limit reached', `Maximum ${EDIT_MAX_PHOTOS} photos per entry.`);
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
      let sizeMb = 0;
      if (Platform.OS !== 'web') {
        const info = await getInfoAsync(asset.uri, { size: true });
        sizeMb = (info.size || 0) / (1024 * 1024);
      }
      setEditMediaItems(prev => ([
        ...prev,
        {
          uri: asset.uri,
          type: 'photo',
          source: 'camera',
          mimeType: asset.mimeType || 'image/jpeg',
          name: `photo_${Date.now()}.jpg`,
          sizeMb,
        },
      ]));
    } finally {
      setMediaBusy(false);
    }
  }

  async function captureEditVideo() {
    const { videos } = getEditMediaCounts();
    if (videos >= EDIT_MAX_VIDEOS) {
      Alert.alert('Limit reached', `Maximum ${EDIT_MAX_VIDEOS} video per entry.`);
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
      setEditMediaItems(prev => ([
        ...prev,
        {
          uri: asset.uri,
          type: 'video',
          source: 'camera',
          mimeType: asset.mimeType || 'video/mp4',
          name: `video_${Date.now()}.mp4`,
          sizeMb,
        },
      ]));
    } finally {
      setMediaBusy(false);
    }
  }

  async function pickEditFile() {
    const { files } = getEditMediaCounts();
    if (files >= EDIT_MAX_FILES) {
      Alert.alert('Limit reached', `Maximum ${EDIT_MAX_FILES} files per entry.`);
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

      setEditMediaItems(prev => ([
        ...prev,
        {
          uri: asset.uri,
          type: mediaType,
          source: 'file',
          mimeType: asset.mimeType,
          name: asset.name || `${mediaType}_${Date.now()}`,
          sizeMb,
        },
      ]));
    } finally {
      setMediaBusy(false);
    }
  }

  // ── Status badge ───────────────────────────────────────────────────────────
  function StatusBadge({ status }) {
    const map = {
      pending: { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
      failed:  { bg: '#fee2e2', text: '#991b1b', label: 'Failed'  },
    };
    const s = map[status] || map.pending;
    return (
      <View style={[styles.badge, { backgroundColor: s.bg }]}>
        <Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text>
      </View>
    );
  }

  const pendingCount = queue.filter(i => i.syncStatus !== 'synced').length;
  const editPhotos = editMediaItems.filter(m => inferMediaType(m) === 'photo');

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
  const editVideos = editMediaItems.filter(m => inferMediaType(m) === 'video');
  const editFiles = editMediaItems.filter(m => m.source === 'file');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Connectivity and offline queue</Text>
      </View>

      <Text style={styles.sectionLabel}>Network Mode</Text>
      <View style={styles.card}>
        <View style={styles.netRow}>
          <View style={[styles.dot, { backgroundColor: isConnected ? '#16a34a' : '#dc2626' }]} />
          <Text style={styles.netText}>
            {isConnected ? 'Connected' : 'No network'}
          </Text>
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>
              {manualMode === 'offline' ? 'Offline (manual)' : 'Online (manual)'}
            </Text>
            <Text style={styles.toggleSub}>
              Effective mode: {effectiveMode}
              {offlineReason ? ` (${offlineReason})` : ''}
            </Text>
          </View>
          <Switch
            value={manualMode === 'offline'}
            onValueChange={v => toggleMode(v ? 'offline' : 'online')}
            trackColor={{ false: '#e0e0e0', true: '#1a1a1a' }}
            thumbColor="#fff"
          />
        </View>

        {!isConnected && manualMode === 'online' && (
          <View style={styles.autoOfflineBanner}>
            <Text style={styles.autoOfflineText}>
              No network - entries will auto-save to queue
            </Text>
          </View>
        )}
      </View>

      {/* Offline queue */}
      <Text style={styles.sectionLabel}>
        Offline Queue {queue.length > 0 ? `(${pendingCount} pending)` : ''}
      </Text>

      {queue.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>Queue is empty</Text>
          <Text style={styles.emptySubtext}>All entries have been synced</Text>
        </View>
      ) : (
        <View>
          {/* Sync all button */}
          <TouchableOpacity
            style={[styles.syncAllBtn, (!isConnected || syncing) && styles.syncBtnDisabled]}
            onPress={syncAll}
            disabled={!isConnected || syncing}
          >
            {syncing
              ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.syncAllText}> Syncing...</Text></>
              : <Text style={styles.syncAllText}>↑ Sync All {pendingCount} Entries</Text>
            }
          </TouchableOpacity>

          {/* Sync log */}
          {syncLog.length > 0 && (
            <View style={styles.logBox}>
              <Text style={styles.logTitle}>Sync results</Text>
              {syncLog.map((r, i) => (
                <Text key={i} style={[styles.logLine, { color: r.ok ? '#16a34a' : '#dc2626' }]}>
                  {r.ok ? '✅ Uploaded' : `❌ Failed: ${r.reason}`}
                </Text>
              ))}
            </View>
          )}

          {/* Queue entries */}
          {queue.map(item => (
            <View key={item.localId} style={styles.queueCard}>
              {/* Entry info */}
              <View style={styles.queueTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.queueActivity}>
                    {item.payload.activity_code} · {item.payload.stage}
                  </Text>
                  <Text style={styles.queueMeta}>
                    📅 {item.payload.entry_date}
                  </Text>
                  <Text style={styles.queueMeta}>
                    Chainage: {item.payload.chainage_from} → {item.payload.chainage_to} · {item.payload.quantity_lm} LM
                  </Text>
                  {item.payload.road_side && (
                    <Text style={styles.queueMeta}>Road side: {item.payload.road_side}</Text>
                  )}
                  {item.payload.remarks && (
                    <Text style={styles.queueMeta}>Remarks: {item.payload.remarks}</Text>
                  )}
                  {item.mediaItems && item.mediaItems.length > 0 && (
                    <Text style={styles.queueMeta}>📎 {item.mediaItems.length} media file(s)</Text>
                  )}
                  <Text style={styles.queueQueued}>
                    Queued: {new Date(item.queuedAt).toLocaleString('en-IN')}
                  </Text>
                  {item.failReason && (
                    <Text style={styles.failReason}>⚠️ {item.failReason}</Text>
                  )}
                </View>
                <StatusBadge status={item.syncStatus} />
              </View>

              {/* Actions */}
              <View style={styles.queueActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.uploadBtn, (!isConnected || syncing) && { opacity: 0.4 }]}
                  onPress={() => syncSingle(item)}
                  disabled={!isConnected || syncing}
                >
                  <Text style={styles.uploadBtnText}>↑ Upload</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.editBtn]}
                  onPress={() => openEdit(item)}
                >
                  <Text style={styles.editBtnText}>✏️ Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => confirmDelete(item)}
                >
                  <Text style={styles.deleteBtnText}>🗑 Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

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

          {[
            { key: 'activity_code',   label: 'Activity Code',  placeholder: 'GSB / WMM / BC...' },
            { key: 'stage',           label: 'Stage',          placeholder: 'GSB / WMM / BC...' },
            { key: 'chainage_from',   label: 'Chainage From',  placeholder: '1+200',  keyboard: 'numeric' },
            { key: 'chainage_to',     label: 'Chainage To',    placeholder: '1+450',  keyboard: 'numeric' },
            { key: 'road_side',       label: 'Road Side',      placeholder: 'LHS / RHS / Both' },
            { key: 'contractor_name', label: 'Contractor',     placeholder: 'Self' },
            { key: 'rfi_number',      label: 'RFI Number',     placeholder: 'Optional', keyboard: 'numeric' },
            { key: 'layer_section',   label: 'Layer / Section',placeholder: 'L1' },
            { key: 'remarks',         label: 'Remarks',        placeholder: 'Weather, delays...' },
          ].map(f => (
            <View key={f.key} style={styles.modalField}>
              <Text style={styles.modalLabel}>{f.label}</Text>
              <TextInput
                style={[styles.modalInput, f.key === 'remarks' && { height: 72, textAlignVertical: 'top' }]}
                value={editForm[f.key] || ''}
                onChangeText={v => (
                  f.key === 'chainage_from' || f.key === 'chainage_to'
                    ? onEditChainageChange(f.key, v)
                    : setEditForm(prev => ({ ...prev, [f.key]: v }))
                )}
                placeholder={f.placeholder}
                keyboardType={f.keyboard || 'default'}
                multiline={f.key === 'remarks'}
              />
            </View>
          ))}

          {editQuantity !== null && (
            <View style={styles.modalQtyCard}>
              <Text style={styles.modalQtyValue}>{editQuantity.toLocaleString()}</Text>
              <Text style={styles.modalQtyUnit}> linear metres</Text>
            </View>
          )}

          <Text style={styles.modalLabel}>Media (Capture Again)</Text>
          <View style={styles.modalMediaActions}>
            <TouchableOpacity
              style={[styles.modalMediaBtn, editPhotos.length >= EDIT_MAX_PHOTOS && styles.modalMediaBtnDisabled]}
              onPress={captureEditPhoto}
              disabled={mediaBusy || editPhotos.length >= EDIT_MAX_PHOTOS}
            >
              <Text style={styles.modalMediaBtnIcon}>📷</Text>
              <Text style={styles.modalMediaBtnText}>Photo</Text>
              <Text style={styles.modalMediaBtnCount}>{editPhotos.length}/{EDIT_MAX_PHOTOS}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalMediaBtn, editVideos.length >= EDIT_MAX_VIDEOS && styles.modalMediaBtnDisabled]}
              onPress={captureEditVideo}
              disabled={mediaBusy || editVideos.length >= EDIT_MAX_VIDEOS}
            >
              <Text style={styles.modalMediaBtnIcon}>🎥</Text>
              <Text style={styles.modalMediaBtnText}>Video</Text>
              <Text style={styles.modalMediaBtnCount}>{editVideos.length}/{EDIT_MAX_VIDEOS}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalMediaBtn, editFiles.length >= EDIT_MAX_FILES && styles.modalMediaBtnDisabled]}
              onPress={pickEditFile}
              disabled={mediaBusy || editFiles.length >= EDIT_MAX_FILES}
            >
              <Text style={styles.modalMediaBtnIcon}>📎</Text>
              <Text style={styles.modalMediaBtnText}>File</Text>
              <Text style={styles.modalMediaBtnCount}>{editFiles.length}/{EDIT_MAX_FILES}</Text>
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

          {editVideos.length > 0 && editVideos.map((m, i) => {
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
                    <Text style={styles.modalFileChipName} numberOfLines={1}>{m.name || 'media file'}</Text>
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f5f5f0' },
  header:           { backgroundColor: '#1a1a1a', padding: 20, paddingTop: 52 },
  title:            { fontSize: 22, fontWeight: '700', color: '#fff' },
  subtitle:         { fontSize: 12, color: '#777', marginTop: 2 },
  sectionLabel:     { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  card:             { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  netRow:           { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot:              { width: 8, height: 8, borderRadius: 4 },
  netText:          { fontSize: 13, color: '#333', flex: 1 },
  toggleRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel:      { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  toggleSub:        { fontSize: 12, color: '#888', marginTop: 2 },
  autoOfflineBanner:{ backgroundColor: '#fef3c7', borderRadius: 8, padding: 10, marginTop: 10 },
  autoOfflineText:  { fontSize: 12, color: '#92400e' },
  emptyCard:        { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  emptyIcon:        { fontSize: 32, marginBottom: 8 },
  emptyText:        { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  emptySubtext:     { fontSize: 13, color: '#aaa', marginTop: 4 },
  syncAllBtn:       { backgroundColor: '#1a1a1a', borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  syncBtnDisabled:  { opacity: 0.4 },
  syncAllText:      { color: '#fff', fontWeight: '600', fontSize: 15 },
  logBox:           { backgroundColor: '#f8fafc', borderRadius: 10, marginHorizontal: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  logTitle:         { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', marginBottom: 6 },
  logLine:          { fontSize: 12, marginBottom: 3 },
  queueCard:        { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  queueTop:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  queueActivity:    { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  queueMeta:        { fontSize: 12, color: '#555', marginTop: 2 },
  queueQueued:      { fontSize: 11, color: '#aaa', marginTop: 6 },
  failReason:       { fontSize: 11, color: '#dc2626', marginTop: 4, lineHeight: 16 },
  badge:            { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText:        { fontSize: 11, fontWeight: '600' },
  queueActions:     { flexDirection: 'row', gap: 8 },
  actionBtn:        { flex: 1, borderRadius: 8, padding: 9, alignItems: 'center' },
  uploadBtn:        { backgroundColor: '#1a1a1a' },
  uploadBtnText:    { color: '#fff', fontWeight: '600', fontSize: 13 },
  editBtn:          { backgroundColor: '#e0f2fe' },
  editBtnText:      { color: '#075985', fontWeight: '600', fontSize: 13 },
  deleteBtn:        { backgroundColor: '#fee2e2' },
  deleteBtnText:    { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  // Edit modal
  modalContainer:   { flex: 1, backgroundColor: '#f5f5f0', padding: 16 },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 16 },
  modalTitle:       { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  modalClose:       { fontSize: 14, color: '#dc2626', fontWeight: '600' },
  modalField:       { marginBottom: 12 },
  modalLabel:       { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  modalInput:       { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 15, color: '#1a1a1a' },
  modalDatePicker:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  modalDateIcon:    { fontSize: 18 },
  modalDateValue:   { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  modalQtyCard:     { flexDirection: 'row', alignItems: 'baseline', backgroundColor: '#e8f5e9', borderRadius: 8, padding: 10, marginBottom: 12 },
  modalQtyValue:    { fontSize: 20, fontWeight: '700', color: '#2e7d32' },
  modalQtyUnit:     { fontSize: 12, color: '#4caf50' },
  modalMediaActions:{ flexDirection: 'row', gap: 8, marginBottom: 10 },
  modalMediaBtn:    { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  modalMediaBtnDisabled: { opacity: 0.4 },
  modalMediaBtnIcon:{ fontSize: 22, marginBottom: 2 },
  modalMediaBtnText:{ fontSize: 12, fontWeight: '600', color: '#1a1a1a' },
  modalMediaBtnCount:{ fontSize: 10, color: '#999', marginTop: 2 },
  modalUploadingRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  modalUploadingText:{ fontSize: 12, color: '#666' },
  modalThumbWrap:   { marginRight: 10, alignItems: 'center' },
  modalThumb:       { width: 76, height: 76, borderRadius: 8, backgroundColor: '#eee' },
  modalThumbMeta:   { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  modalThumbSize:   { fontSize: 10, color: '#999' },
  modalThumbRemove: { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  modalThumbRemoveText: { fontSize: 11, color: '#dc2626', fontWeight: '700' },
  modalVideoChip:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  modalVideoChipIcon:{ fontSize: 20 },
  modalVideoChipName:{ fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  modalVideoChipMeta:{ fontSize: 11, color: '#888' },
  modalFileChip:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 8, padding: 10, marginRight: 8, minWidth: 220 },
  modalFileChipIcon:{ fontSize: 16, marginRight: 8 },
  modalFileChipName:{ fontSize: 13, fontWeight: '500', color: '#1a1a1a', flex: 1 },
  modalFileChipMeta:{ fontSize: 11, color: '#666' },
  saveEditBtn:      { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  saveEditText:     { color: '#fff', fontWeight: '600', fontSize: 16 },
  signOutBtn:       { margin: 16, marginTop: 24, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#dc2626', alignItems: 'center' },
  signOutText:      { color: '#dc2626', fontWeight: '600', fontSize: 15 },
});