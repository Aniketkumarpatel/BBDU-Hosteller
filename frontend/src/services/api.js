import axios from 'axios';

// In dev, Vite proxies /api to http://localhost:5000. In production, configure VITE_API_URL.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: automatically attach Authorization Bearer token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bbdu_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: normalize error messages and handle 401 token expiry
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the server explicitly rejected the token with 401 on an authenticated call,
    // clear stale local credentials (unless the call was itself to /auth/login)
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/login')
    ) {
      localStorage.removeItem('bbdu_auth_token');
      localStorage.removeItem('bbdu_auth_user');
    }

    error.userMessage =
      error.response?.data?.message ||
      error.response?.data?.details?.[0]?.message ||
      error.message ||
      'Something went wrong. Please try again.';

    return Promise.reject(error);
  }
);

export default api;
