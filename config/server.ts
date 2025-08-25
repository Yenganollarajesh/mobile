// Server Configuration
export const SERVER_CONFIG = {
  // Development server URLs
  BASE_URL: 'http://10.160.204.181:5000',
  SOCKET_URL: 'http://10.160.204.181:5000',
  
  // Alternative URLs for different environments
  LOCALHOST: 'http://localhost:5000',
  LOCAL_IP: 'http://10.160.204.181:5000',
  
  // API Endpoints
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
    },
    USERS: '/users',
    CONVERSATIONS: '/conversations',
    MESSAGES: '/messages',
    DB_STATUS: '/db/status',
    DEBUG_ONLINE: '/debug/online-status',
  }
};

// Helper function to get full API URL
export const getApiUrl = (endpoint: string) => {
  return `${SERVER_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to get socket URL
export const getSocketUrl = () => {
  return SERVER_CONFIG.SOCKET_URL;
};
