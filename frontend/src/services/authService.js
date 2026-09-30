import apiClient from './apiClient';

export async function login(credentials) {
  const { data } = await apiClient.post('/auth/login', credentials);
  return data.data; // { token, user }
}

export async function register(details) {
  const { data } = await apiClient.post('/auth/register', details);
  return data.data; // { token, user }
}

export async function getCurrentUser() {
  const { data } = await apiClient.get('/auth/me');
  return data.data.user;
}
