import apiClient from './apiClient';

// filters: { objectClass, from, to, minConfidence, page, limit }
export async function listDetections(filters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  );
  const { data } = await apiClient.get('/detections', { params });
  return data.data; // { items, pagination }
}

export async function updateDetectionStatus(id, status) {
  const { data } = await apiClient.patch(`/detections/${id}`, { status });
  return data.data;
}

export async function deleteDetection(id) {
  await apiClient.delete(`/detections/${id}`);
}
