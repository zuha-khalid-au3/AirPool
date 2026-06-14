import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL } from '../config/env';
import { isNgrokUrl } from '../config/env.utils';
import api from '../services/api';
import * as SecureStore from 'expo-secure-store';

const MEDIA_CACHE_ROOT = FileSystem.cacheDirectory || FileSystem.documentDirectory;
const MEDIA_CACHE_DIR = `${MEDIA_CACHE_ROOT}airpool-chat/`;

async function getAccessToken() {
  try {
    const tokenData = await SecureStore.getItemAsync('auth_tokens');
    if (!tokenData) return null;
    const { accessToken } = JSON.parse(tokenData);
    return accessToken || null;
  } catch {
    return null;
  }
}

export function parseObjectNameFromMediaUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('objectName');
  } catch {
    return null;
  }
}

export function buildChatMediaUrl(chatRoomId, objectName, accessToken = null) {
  if (!chatRoomId || !objectName) return null;

  const params = new URLSearchParams();
  params.set('objectName', objectName);
  if (accessToken) {
    params.set('access_token', accessToken);
  }
  if (isNgrokUrl(API_BASE_URL)) {
    params.set('ngrok-skip-browser-warning', 'true');
  }

  return `${API_BASE_URL}/chat/${encodeURIComponent(chatRoomId)}/file?${params.toString()}`;
}

export async function buildAuthenticatedChatMediaUrl(chatRoomId, objectName) {
  const token = await getAccessToken();
  return buildChatMediaUrl(chatRoomId, objectName, token);
}

export async function getMediaAuthHeaders() {
  const headers = {};

  if (isNgrokUrl(API_BASE_URL)) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  const accessToken = await getAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function getMediaCachePath(objectName) {
  const safeName = objectName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${MEDIA_CACHE_DIR}${safeName}`;
}

export function normalizeLocalFileUri(uri) {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('data:')) {
    return uri;
  }
  return `file://${uri.replace(/^\/+/, '')}`;
}

async function ensureMediaCacheDir() {
  const info = await FileSystem.getInfoAsync(MEDIA_CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_CACHE_DIR, { intermediates: true });
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }

  return globalThis.btoa(binary);
}

async function downloadViaApi(chatRoomId, objectName, localUri) {
  const response = await api.get(`/chat/${encodeURIComponent(chatRoomId)}/file`, {
    params: { objectName },
    responseType: 'arraybuffer',
  });

  const base64 = arrayBufferToBase64(response.data);
  await FileSystem.writeAsStringAsync(localUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return normalizeLocalFileUri(localUri);
}

async function downloadViaFileSystem(chatRoomId, objectName, localUri) {
  const token = await getAccessToken();
  const url = buildChatMediaUrl(chatRoomId, objectName, token);
  const headers = await getMediaAuthHeaders();

  const result = await FileSystem.downloadAsync(url, localUri, { headers });
  if (result.status !== 200) {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
    throw new Error(`Media download failed (${result.status})`);
  }

  return normalizeLocalFileUri(result.uri || localUri);
}

export async function downloadAuthenticatedMediaFile(chatRoomId, objectName) {
  if (!chatRoomId || !objectName) return null;
  if (!MEDIA_CACHE_ROOT) {
    throw new Error('Local file storage is unavailable on this device.');
  }

  await ensureMediaCacheDir();

  const localUri = getMediaCachePath(objectName);
  const cached = await FileSystem.getInfoAsync(localUri);
  if (cached.exists && cached.size > 0) {
    return normalizeLocalFileUri(localUri);
  }

  try {
    return await downloadViaApi(chatRoomId, objectName, localUri);
  } catch (apiError) {
    try {
      return await downloadViaFileSystem(chatRoomId, objectName, localUri);
    } catch {
      throw apiError;
    }
  }
}

export function sanitizeOutgoingMetadata(metadata) {
  if (!metadata) return null;

  const { localUri, imageUrl, audioUrl, ...persisted } = metadata;
  return Object.keys(persisted).length > 0 ? persisted : null;
}

export function enrichMessageMedia(message, chatRoomId) {
  if (!message?.metadata?.objectName || !chatRoomId) {
    return message;
  }

  return message;
}

export async function enrichMessageMediaAsync(message, chatRoomId) {
  if (!message?.metadata?.objectName || !chatRoomId) {
    return message;
  }

  const url = await buildAuthenticatedChatMediaUrl(chatRoomId, message.metadata.objectName);
  if (!url) return message;

  const metadata = { ...message.metadata };

  if (message.messageType === 'image') {
    metadata.imageUrl = url;
  } else if (message.messageType === 'voice' || message.messageType === 'audio') {
    metadata.audioUrl = url;
  }

  return { ...message, metadata };
}
