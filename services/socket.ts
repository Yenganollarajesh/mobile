import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSocketUrl } from '../config/server';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private appStateListener: any = null; // For AppState event listener

  async connect(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.log('ERROR ❌ Error connecting to socket: [Error: No auth token available]');
        return false;
      }

      // Use config for socket URL
      const socketUrl = getSocketUrl();
      console.log(`🔌 Connecting to socket at: ${socketUrl}`);
      
      this.socket = io(socketUrl, {
        transports: ['websocket'],
        autoConnect: true,
      });

      this.socket.on('connect', async () => {
        console.log('Socket connected successfully');
        this.isConnected = true;
        
        // Authenticate immediately after connection
        try {
          this.socket?.emit('authenticate', token);
        } catch (error) {
          console.error('Error authenticating socket:', error);
        }
      });

      this.socket.on('authenticated', (data) => {
        console.log('Socket authenticated successfully:', data);
        // Start heartbeat after authentication
        this.startHeartbeat();
      });

      this.socket.on('authentication_error', (error) => {
        console.error('Socket authentication failed:', error);
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.isConnected = false;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.isConnected = false;
        this.stopHeartbeat();
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        this.isConnected = true;
        
        // Re-authenticate after reconnection
        this.socket?.emit('authenticate', token);
      });

      return true;
    } catch (error) {
      console.error('Error connecting to socket:', error);
      return false;
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Start heartbeat to keep connection alive
  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        this.socket.emit('heartbeat');
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  // Stop heartbeat
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Update app state (call this when app goes to background/foreground)
  updateAppState(state: 'active' | 'background' | 'inactive') {
    if (this.socket && this.isConnected) {
      this.socket.emit('app_state_change', { state });
    }
  }

  // Join a conversation room
  joinConversation(conversationId: number) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join', { conversationId });
    }
  }

  // Leave a conversation room
  leaveConversation(conversationId: number) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave', { conversationId });
    }
  }

  // Send a message
  sendMessage(conversationId: number, content: string, senderId: number) {
    if (this.socket && this.isConnected) {
      this.socket.emit('message:send', {
        conversationId,
        content,
        senderId,
      });
    }
  }

  // Start typing indicator
  startTyping(conversationId: number, userId: number) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing:start', { conversationId, userId });
    }
  }

  // Stop typing indicator
  stopTyping(conversationId: number, userId: number) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing:stop', { conversationId, userId });
    }
  }

  // Mark messages as read
  markAsRead(conversationId: number, userId: number) {
    if (this.socket && this.isConnected) {
      this.socket.emit('message:read', { conversationId, userId });
    }
  }

  // Emit custom event
  emitCustomEvent(eventName: string, data: any) {
    if (this.socket && this.isConnected) {
      this.socket.emit(eventName, data);
    }
  }

  // Listen for new messages
  onNewMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('message:new', callback);
    }
  }

  // Listen for typing indicators
  onTypingStart(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('typing:start', callback);
    }
  }

  onTypingStop(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('typing:stop', callback);
    }
  }

  // Listen for read receipts
  onMessageRead(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('message:read', callback);
    }
  }

  // Listen for message delivery confirmations
  onMessageDelivered(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('message:delivered', callback);
    }
  }

  // Listen for user status changes
  onUserStatusChange(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user_status_change', callback);
    }
  }

  // Listen for user typing status changes
  onUserTypingStatus(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('user_typing_status', callback);
    }
  }

  // Listen for conversation opened events
  onConversationOpened(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('conversation_opened', callback);
    }
  }

  // Listen for conversations updated events
  onConversationsUpdated(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('conversations_updated', callback);
    }
  }

  // Listen for custom events
  onCustomEvent(eventName: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(eventName, callback);
    }
  }

  // Remove all listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  // Remove specific custom event listener
  removeCustomEventListener(eventName: string) {
    if (this.socket) {
      this.socket.off(eventName);
    }
  }

  // Get connection status
  getConnectionStatus() {
    return this.isConnected;
  }
}

export default new SocketService();
