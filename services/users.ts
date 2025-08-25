import api from './api';
import { SERVER_CONFIG } from '../config/server';

export const usersAPI = {
  // Get all users (excluding current user)
  getAll: async () => {
    try {
      const response = await api.get(SERVER_CONFIG.ENDPOINTS.USERS);
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },
};
