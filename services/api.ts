import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl, SERVER_CONFIG } from '../config/server';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: getApiUrl(''),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear storage and redirect to login
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      // You might want to emit an event here to redirect to login
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    try {
      const response = await api.post(SERVER_CONFIG.ENDPOINTS.AUTH.LOGIN, {
        email,
        password,
      });
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  register: async (name: string, email: string, password: string) => {
    try {
      const response = await api.post(SERVER_CONFIG.ENDPOINTS.AUTH.REGISTER, {
        name,
        email,
        password,
      });
      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },
};

// Users API
export const usersAPI = {
  getAll: async () => {
    const response = await api.get('/users');
    return response.data;
  },
};

// Conversations API
export const conversationsAPI = {
  getAll: async () => {
    const response = await api.get('/conversations');
    return response.data;
  },

  getOrCreate: async (otherUserId: number) => {
    const response = await api.get(`/conversations/${otherUserId}`);
    return response.data;
  },

  getMessages: async (conversationId: number) => {
    const response = await api.get(`/conversations/${conversationId}/messages`);
    return response.data;
  },
};

export default api;
