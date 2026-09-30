import axios from 'axios';

const TOKEN_KEY = 'visionguard_token';

// The JWT lives in localStorage so a page refresh keeps the user logged in.
// Trade-off: readable by any script on the page (XSS). An httpOnly cookie is
// the stricter alternative - see README "Future improvements".
export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
});

// Attach the JWT to every request.
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// AuthContext registers a handler so an expired/invalid token logs the user out.
let unauthorizedHandler = null;
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && sentToken && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

// Turns any axios error into a message that can be shown to the user.
export function getErrorMessage(error) {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error?.request && !error.response) {
    return 'Cannot reach the VisionGuard backend. Make sure the API server is running.';
  }
  return error?.message || 'Something went wrong.';
}

export default apiClient;
