import { Linking, Platform } from 'react-native';

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km) {
  if (km == null || Number.isNaN(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export async function openDirectionsTo(latitude, longitude, label = 'Destination') {
  const encodedLabel = encodeURIComponent(label);
  const coords = `${latitude},${longitude}`;

  const candidates = Platform.select({
    ios: [
      `maps://?daddr=${coords}&dirflg=d`,
      `http://maps.apple.com/?daddr=${coords}&dirflg=d`,
    ],
    android: [
      `google.navigation:q=${coords}`,
      `geo:${coords}?q=${coords}(${encodedLabel})`,
    ],
    default: [`https://www.google.com/maps/dir/?api=1&destination=${coords}`],
  });

  for (const url of candidates) {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
  }

  await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${coords}`);
}

export function createLiveSessionId(userId) {
  return `live_${userId}_${Date.now()}`;
}
