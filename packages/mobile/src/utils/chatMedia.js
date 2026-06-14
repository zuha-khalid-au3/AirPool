import { API_BASE_URL } from '../config/env';
import { isNgrokUrl } from '../config/env.utils';
import api from '../services/api';
import * as SecureStore from 'expo-secure-store';

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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }

  return globalThis.btoa(binary);
}

export async function fetchAuthenticatedImageDataUri(chatRoomId, objectName, fallbackMimeType = 'image/jpeg') {
  if (!chatRoomId || !objectName) return null;

  const response = await api.get(`/chat/${encodeURIComponent(chatRoomId)}/file`, {
    params: { objectName },
    responseType: 'arraybuffer',
  });

  const contentType = response.headers['content-type'] || fallbackMimeType;
  const base64 = arrayBufferToBase64(response.data);
  return `data:${contentType};base64,${base64}`;
}

export function enrichMessageMedia(message, chatRoomId) {
  if (!message?.metadata?.objectName || !chatRoomId) {
    return message;
  }

  // URLs are resolved async in UI components with access_token appended
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
