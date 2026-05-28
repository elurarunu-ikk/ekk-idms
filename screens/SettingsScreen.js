// ekk-mobile/screens/SettingsScreen.js

import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNetworkMode } from '../hooks/useNetworkMode';
import { logout } from '../services/auth';
import { getAccessibleProjects, getSelectedProjectId, setSelectedProjectId, getSttLang, setSttLang, STT_LANGUAGES } from '../services/session';
import { loadQueue, removeFromQueue, markFailed } from '../utils/offlineQueue';
import api, { API_BASE, getApiErrorMessage } from '../services/api';

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

  const {
    isConnected, manualMode, effectiveMode,
    offlineReason, toggleMode,
  } = useNetworkMode();

  const [queue, setQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectIdState] = useState('');
  const [sttLang, setSttLangState] = useState('en-IN');

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshQueue();
      void refreshProjects();
    });
    return unsubscribe;
  }, [navigation]);

  async function refreshProjects() {
    const available = await getAccessibleProjects();
    const selected = await getSelectedProjectId();
    const lang = await getSttLang();
    setProjects(available);
    setSelectedProjectIdState(selected);
    setSttLangState(lang);
  }

  async function handleSttLangChange(code) {
    await setSttLang(code);
    setSttLangState(code);
  }

  async function handleProjectChange(projectId) {
    await setSelectedProjectId(projectId);
    setSelectedProjectIdState(projectId);
    Alert.alert('Project switched', 'Capture and entries now use the selected project.');
  }

  async function refreshQueue() {
    const q = await loadQueue();
    setQueue(q);
  }

  async function uploadMediaForEntry(entryId, mediaItem) {
    const mediaType = inferMediaType(mediaItem);
    if (!mediaType) {
      throw new Error(`Unsupported media type for ${mediaItem.name || 'file'}. Only photo/video is allowed.`);
    }

    const formData = new FormData();
    formData.append('entry_id', entryId);
    formData.append('media_type', mediaType);

    formData.append('file', {
      uri: mediaItem.uri,
      name: mediaItem.name,
      type: inferMimeType(mediaItem, mediaType),
    });

    await api.post('/api/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  }

  async function syncOne(item) {
    try {
      const payload = { ...item.payload };
      if (payload.entry_date && typeof payload.entry_date !== 'string') {
        payload.entry_date = String(payload.entry_date);
      }
      const resp = await api.post('/api/capture/', payload);
      const entryId = resp.data.id;

      if (item.mediaItems && item.mediaItems.length > 0) {
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
      }

      await removeFromQueue(item.localId);
      return { localId: item.localId, ok: true, mediaUploaded: item.mediaItems?.length || 0 };
    } catch (e) {
      const reason = getApiErrorMessage(e);
      await markFailed(item.localId, reason);
      return { localId: item.localId, ok: false, reason };
    }
  }

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

  const pendingCount = queue.filter(i => i.syncStatus !== 'synced').length;

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

        <Text style={styles.apiBaseText}>API: {API_BASE}</Text>

        {!isConnected && manualMode === 'online' && (
          <View style={styles.autoOfflineBanner}>
            <Text style={styles.autoOfflineText}>
              No network - entries will auto-save to queue
            </Text>
          </View>
        )}
      </View>

      {projects.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Current Project</Text>
          <View style={styles.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectChipRow}>
              {projects.map((project) => {
                const active = selectedProjectId === project.id;
                return (
                  <TouchableOpacity
                    key={project.id}
                    style={[styles.projectChip, active && styles.projectChipActive]}
                    onPress={() => void handleProjectChange(project.id)}
                  >
                    <Text style={[styles.projectChipText, active && styles.projectChipTextActive]}>
                      {project.project_code}
                    </Text>
                    <Text style={[styles.projectChipSubText, active && styles.projectChipTextActive]} numberOfLines={1}>
                      {project.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}

      {/* Voice Language */}
      <Text style={styles.sectionLabel}>Voice Language (STT)</Text>
      <View style={styles.card}>
        <Text style={styles.langNote}>
          Used for real-time speech recognition while speaking. Whisper AI (online) auto-detects any language regardless of this setting.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {STT_LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.langChip, sttLang === lang.code && styles.langChipActive]}
              onPress={() => void handleSttLangChange(lang.code)}
            >
              <Text style={[styles.langChipText, sttLang === lang.code && styles.langChipTextActive]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Offline queue summary */}
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
          {/* Bulk sync button */}
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

          {/* Queue overview card */}
          <View style={styles.queueOverviewCard}>
            <Text style={styles.queueOverviewTitle}>Queue Overview</Text>
            <Text style={styles.queueOverviewText}>
              📋 {queue.length} total entries{queue.length > 0 ? ` (${pendingCount} pending)` : ''}
            </Text>
            <Text style={styles.queueOverviewText}>
              💡 Go to <Text style={{ fontWeight: '700' }}>My Entries</Text> tab to view details, edit, and retry failed entries.
            </Text>
          </View>
        </View>
      )}

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f0' },
  header: { backgroundColor: '#1a1a1a', padding: 20, paddingTop: 52 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 12, color: '#777', marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, padding: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  netRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  netText: { fontSize: 13, color: '#333', flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  toggleSub: { fontSize: 12, color: '#888', marginTop: 2 },
  apiBaseText: { fontSize: 11, color: '#666', marginTop: 8 },
  projectChipRow: { gap: 8 },
  projectChip: {
    minWidth: 170,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  projectChipActive: {
    borderColor: '#1a1a1a',
    backgroundColor: '#1a1a1a',
  },
  projectChipText: { fontSize: 12, fontWeight: '700', color: '#111827' },
  projectChipSubText: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  projectChipTextActive: { color: '#fff' },
  autoOfflineBanner: { backgroundColor: '#fef3c7', borderRadius: 8, padding: 10, marginTop: 10 },
  autoOfflineText: { fontSize: 12, color: '#92400e' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  emptySubtext: { fontSize: 13, color: '#aaa', marginTop: 4 },
  syncAllBtn: { backgroundColor: '#1a1a1a', borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  syncBtnDisabled: { opacity: 0.4 },
  syncAllText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  logBox: { backgroundColor: '#f8fafc', borderRadius: 10, marginHorizontal: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  logTitle: { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', marginBottom: 6 },
  logLine: { fontSize: 12, marginBottom: 3 },
  queueOverviewCard: { backgroundColor: '#e3f2fd', borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 14, borderWidth: 1, borderColor: '#90caf9' },
  queueOverviewTitle: { fontSize: 13, fontWeight: '700', color: '#01579b', marginBottom: 8 },
  queueOverviewText: { fontSize: 12, color: '#0277bd', lineHeight: 18, marginBottom: 6 },
  signOutBtn: { margin: 16, marginTop: 24, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#dc2626', alignItems: 'center' },
  signOutText: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
  langNote: { fontSize: 12, color: '#888', marginBottom: 10, lineHeight: 17 },
  langChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  langChipActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  langChipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  langChipTextActive: { color: '#fff' },
});