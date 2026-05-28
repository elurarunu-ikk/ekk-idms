import * as Location from 'expo-location';
import api from './api';

export async function dropWaypoint(projectId, note = '') {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const waypoint = {
    project_id: projectId,
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    accuracy_m: loc.coords.accuracy,
    note,
  };

  // Save to API
  await api.post('/api/waypoints/', waypoint);

  return {
    ...waypoint,
    captured_at: new Date().toISOString(),
  };
}

export async function getTodayWaypoints(projectId) {
  const resp = await api.get(`/api/waypoints/?project_id=${projectId}&today=true`);
  return resp.data;
}