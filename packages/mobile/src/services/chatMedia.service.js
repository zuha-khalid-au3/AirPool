import api from './api';

export async function uploadChatMedia(chatRoomId, file, extra = {}) {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name || `media_${Date.now()}`,
    type: file.mimeType || 'application/octet-stream',
  });

  if (extra.duration != null) formData.append('duration', String(extra.duration));
  if (extra.width != null) formData.append('width', String(extra.width));
  if (extra.height != null) formData.append('height', String(extra.height));

  const response = await api.post(`/chat/${chatRoomId}/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });

  return response.data.data;
}
