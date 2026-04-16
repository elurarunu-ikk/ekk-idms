// ekk-mobile/hooks/useMediaCapture.js
// Handles photo/video capture, client-side compression, and background upload.
// Upload happens AFTER form submit — never blocks the user.

import { useState, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getInfoAsync } from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import api from '../services/api';
import { getMode, loadRetryQueue, saveRetryQueue } from '../utils/offlineQueue';

// ── Limits ────────────────────────────────────────────────────────────────────
const MAX_PHOTOS       = 3;
const MAX_VIDEOS       = 1;
const MAX_FILES        = 2;
const MAX_VIDEO_SEC    = 30;
const WARN_VIDEO_MB    = 15;
const PHOTO_MAX_WIDTH  = 1280;
const PHOTO_QUALITY    = 0.75;   // 0-1, compress to ~75%

// ── Types ─────────────────────────────────────────────────────────────────────
/**
 * @typedef {{ uri: string, type: 'photo'|'video', name: string, sizeMb: number }} MediaItem
 * @typedef {{ entryId: string, uri: string, type: string, name: string, retries: number }} QueuedUpload
 */

function inferMediaType(item = {}) {
  const type = String(item.type || '').toLowerCase();
  if (type === 'photo' || type === 'video') return type;

  const mime = String(item.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';

  const name = String(item.name || item.uri || '').toLowerCase();
  if (/\.(jpg|jpeg|png|gif|bmp|webp|heic)$/.test(name)) return 'photo';
  if (/\.(mp4|mov|avi|mkv|3gp|webm|m4v)$/.test(name)) return 'video';

  return null;
}

function inferMimeType(item = {}, mediaType) {
  const mime = String(item.mimeType || '').toLowerCase();
  if (mime) return mime;
  return mediaType === 'photo' ? 'image/jpeg' : 'video/mp4';
}

export function useMediaCapture() {
  /** @type {[MediaItem[], Function]} */
  const [photos, setPhotos] = useState([]);
  /** @type {[MediaItem|null, Function]} */
  const [video,  setVideo]  = useState(null);
  /** @type {[MediaItem[], Function]} */
  const [files,  setFiles]  = useState([]);
  const [uploading, setUploading] = useState(false);

  // ── Permissions ─────────────────────────────────────────────────────────
  async function requestPermissions() {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (cam.status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to capture photos and videos.');
      return false;
    }
    return true;
  }

  // ── Capture photo ────────────────────────────────────────────────────────
  async function capturePhoto() {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `Maximum ${MAX_PHOTOS} photos per entry.`);
      return;
    }
    const ok = await requestPermissions();
    if (!ok) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,   // capture full quality, compress manually below
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    // Compress: resize to max 1280px width, quality 75%
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: Math.min(asset.width || PHOTO_MAX_WIDTH, PHOTO_MAX_WIDTH) } }],
      { compress: PHOTO_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );

    let sizeMb = 0;
    if (Platform.OS !== 'web') {
      try {
        const info = await getInfoAsync(compressed.uri, { size: true });
        sizeMb = (info.size || 0) / (1024 * 1024);
      } catch (e) {
        console.log('[media] Could not get file size:', e.message);
      }
    }
    const name = `photo_${Date.now()}.jpg`;

    console.log(`[media] Photo captured: ${sizeMb.toFixed(2)}MB after compression`);

    setPhotos(prev => [...prev, { uri: compressed.uri, type: 'photo', name, sizeMb }]);
  }

  // ── Capture video ────────────────────────────────────────────────────────
  async function captureVideo() {
    if (video) {
      Alert.alert('Limit reached', 'Maximum 1 video per entry.');
      return;
    }
    const ok = await requestPermissions();
    if (!ok) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: MAX_VIDEO_SEC,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    let sizeMb = 0;
    if (Platform.OS !== 'web') {
      try {
        const info  = await getInfoAsync(asset.uri, { size: true });
        sizeMb = (info.size || 0) / (1024 * 1024);
      } catch (e) {
        console.log('[media] Could not get file size:', e.message);
      }
    }
    const name  = `video_${Date.now()}.mp4`;

    if (sizeMb > WARN_VIDEO_MB) {
      Alert.alert(
        'Large video',
        `This video is ${sizeMb.toFixed(1)}MB. It may take longer to upload on mobile data. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Keep', onPress: () => setVideo({ uri: asset.uri, type: 'video', name, sizeMb }) },
        ]
      );
      return;
    }

    console.log(`[media] Video captured: ${sizeMb.toFixed(2)}MB`);
    setVideo({ uri: asset.uri, type: 'video', name, sizeMb });
  }

  // ── Browse and attach file ────────────────────────────────────────────────
  async function browseFile() {
    if (files.length >= MAX_FILES) {
      Alert.alert('Limit reached', `Maximum ${MAX_FILES} files per entry.`);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      let sizeMb = 0;

      if (Platform.OS !== 'web') {
        try {
          const info = await getInfoAsync(asset.uri, { size: true });
          sizeMb = (info.size || 0) / (1024 * 1024);
        } catch (e) {
          console.log('[media] Could not get file size:', e.message);
        }
      }

      const name = asset.name || `file_${Date.now()}.${asset.uri.split('.').pop()}`;
      const inferredType = inferMediaType({
        type: asset.type,
        mimeType: asset.mimeType,
        name,
        uri: asset.uri,
      });

      if (!inferredType) {
        Alert.alert('Unsupported file', 'Only image or video files can be uploaded.');
        return;
      }

      console.log(`[media] File selected: ${sizeMb.toFixed(2)}MB`);

      setFiles(prev => [...prev, {
        uri: asset.uri,
        type: inferredType,
        mimeType: asset.mimeType,
        name,
        sizeMb,
      }]);
    } catch (error) {
      console.log('[media] File picker error:', error);
      Alert.alert('Error', 'Unable to open file browser. Please check storage permissions and try again.');
    }
  }

  // ── Remove items ─────────────────────────────────────────────────────────
  function removePhoto(index) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  function removeVideo() {
    setVideo(null);
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  // ── Upload a single file ──────────────────────────────────────────────────
  async function uploadOne(entryId, item) {
    console.log('[media] Uploading:', { entryId, item });

    const mediaType = inferMediaType(item);
    if (!mediaType) {
      throw new Error('Unsupported media file type. Only photo or video is allowed.');
    }

    const formData = new FormData();
    formData.append('entry_id', entryId);
    formData.append('media_type', mediaType);

    // Different file format for web vs native
    if (Platform.OS === 'web') {
      // For web, we need to fetch the file as blob
      const response = await fetch(item.uri);
      const blob = await response.blob();
      formData.append('file', blob, item.name);
    } else {
      // For native platforms
      formData.append('file', {
        uri:  item.uri,
        name: item.name,
        type: inferMimeType(item, mediaType),
      });
    }

    try {
      const response = await api.post('/api/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,   // 60s timeout for large videos
      });
      console.log('[media] Upload success:', response.data);
    } catch (error) {
      console.log('[media] Upload error details:', error.response?.data);
      throw error;
    }

    console.log(`[media] Uploaded ${mediaType}: ${item.name}`);
  }

  // ── Add failed uploads to retry queue ────────────────────────────────────
  async function enqueueRetry(entryId, item) {
    try {
      const queue = await loadRetryQueue();
      queue.push({
        entryId,
        uri: item.uri,
        type: item.type,
        mimeType: item.mimeType,
        name: item.name,
        retries: 0,
      });
      await saveRetryQueue(queue);
      console.log(`[media] Queued for retry: ${item.name}`);
    } catch (e) {
      console.log('[media] Failed to enqueue retry:', e.message);
    }
  }

  // ── Flush retry queue (call on app resume / network restore) ─────────────
  async function flushRetryQueue() {
    try {
      const queue = await loadRetryQueue();
      if (!queue.length) return;

      const remaining = [];
      for (const item of queue) {
        try {
          await uploadOne(item.entryId, item);
        } catch {
          if (item.retries < 3) {
            remaining.push({ ...item, retries: item.retries + 1 });
          } else {
            console.log(`[media] Dropping after 3 retries: ${item.name}`);
          }
        }
      }
      await saveRetryQueue(remaining);
    } catch (e) {
      console.log('[media] Retry flush error:', e.message);
    }
  }

  // ── Main: upload all after form submit ───────────────────────────────────
  async function uploadAllForEntry(entryId) {
    const allItems = [...photos, ...(video ? [video] : []), ...files];
    if (!allItems.length) return;

    setUploading(true);
    let failed = 0;

    for (const item of allItems) {
      try {
        await uploadOne(entryId, item);
      } catch (e) {
        console.log(`[media] Upload failed for ${item.name}:`, e.message);
        await enqueueRetry(entryId, item);
        failed++;
      }
    }

    setUploading(false);

    if (failed > 0) {
      Alert.alert(
        'Media upload pending',
        `${failed} file(s) will retry when connection improves.`
      );
    }
  }

  // ── Reset after form clear ────────────────────────────────────────────────
  function resetMedia() {
    setPhotos([]);
    setVideo(null);
    setFiles([]);
  }

  return {
    photos,
    video,
    files,
    uploading,
    capturePhoto,
    captureVideo,
    browseFile,
    removePhoto,
    removeVideo,
    removeFile,
    uploadAllForEntry,
    flushRetryQueue,
    resetMedia,
    // Counts for UI
    photoCount: photos.length,
    videoCount: video ? 1 : 0,
    fileCount: files.length,
    maxPhotos: MAX_PHOTOS,
    maxVideos: MAX_VIDEOS,
    maxFiles: MAX_FILES,
  };
}