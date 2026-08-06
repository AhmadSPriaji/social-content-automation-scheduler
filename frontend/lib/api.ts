import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  withCredentials: true, // Required for cookies (refresh tokens, etc)
});

// Optionally, add interceptors here to handle global errors (like 401s for token refresh)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If the error is 401 and not from the refresh endpoint, we could attempt to refresh
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/refresh')) {
      originalRequest._retry = true;
      try {
        await api.post('/auth/refresh');
        return api(originalRequest);
      } catch (e) {
        if (typeof window !== 'undefined') {
          const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
          const isPublic = publicRoutes.some(r => window.location.pathname.startsWith(r));
          if (!isPublic) {
            window.location.href = '/login?clear=true';
          }
        }
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);
