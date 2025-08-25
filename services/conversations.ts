import api from './api';
import { SERVER_CONFIG } from '../config/server';

export const conversationsAPI = {
  // Get all conversations for current user
  getAll: async () => {
    try {
      const response = await api.get(SERVER_CONFIG.ENDPOINTS.CONVERSATIONS);
      return response.data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  },

  // Get or create conversation with another user
  getOrCreate: async (otherUserId: number) => {
    try {
      const response = await api.get(`${SERVER_CONFIG.ENDPOINTS.CONVERSATIONS}/${otherUserId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      throw error;
    }
  },

  // Get messages for a conversation
  getMessages: async (conversationId: number) => {
    try {
      const response = await api.get(`${SERVER_CONFIG.ENDPOINTS.CONVERSATIONS}/${conversationId}/messages`);
      return response.data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  },
};
