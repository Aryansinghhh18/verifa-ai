import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Initialize Authorization header from existing token
const storedToken = localStorage.getItem('verifa_token');
if (storedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}

// Request interceptor to ensure latest JWT token is always attached
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('verifa_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle unauthenticated 401s on protected pages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('verifa_token');
      delete api.defaults.headers.common['Authorization'];
      
      const currentPath = window.location.pathname;
      const isPublicAuthPage =
        currentPath === '/login' ||
        currentPath === '/register' ||
        currentPath === '/signup' ||
        currentPath.startsWith('/auth') ||
        currentPath === '/';

      if (!isPublicAuthPage) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
