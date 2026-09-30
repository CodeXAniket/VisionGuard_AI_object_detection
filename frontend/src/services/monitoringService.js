import apiClient from './apiClient';

export async function getConfig() {
  const { data } = await apiClient.get('/monitoring/config');
  return data.data;
}

export async function updateConfig(config) {
  const { data } = await apiClient.put('/monitoring/config', config);
  return data.data;
}

export async function getClasses() {
  const { data } = await apiClient.get('/monitoring/classes');
  return data.data;
}

export async function getHealth() {
  const { data } = await apiClient.get('/monitoring/health');
  return data.data;
}

// Sends one JPEG frame for detection.
// Returns { detections, frameWidth, frameHeight, inferenceMs, events }.
export async function sendFrame(frameBlob, signal) {
  const formData = new FormData();
  formData.append('frame', frameBlob, 'frame.jpg');
  const { data } = await apiClient.post('/monitoring/detect', formData, { signal });
  return data.data;
}
