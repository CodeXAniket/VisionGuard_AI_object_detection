import apiClient from './apiClient';

// "Today" is the user's local day, so the browser sends its own midnight.
export async function getStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { data } = await apiClient.get('/dashboard/stats', {
    params: { since: startOfToday.toISOString() },
  });
  return data.data;
}
