import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { conversationsAPI } from '../../services/conversations';
import socketService from '../../services/socket';
import { getApiUrl, SERVER_CONFIG } from '../../config/server';

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  message_type: string;
  is_delivered: boolean;
  is_read: boolean;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  sender_name: string;
  deliveryStatus?: 'sent' | 'delivered' | 'read';
}

interface ChatParams {
  id: string;
  otherUserName: string;
  otherUserId: string;
  [key: string]: string | string[] | undefined;
}

const ChatScreen = () => {
  const params = useLocalSearchParams<ChatParams>();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [otherUserOnline, setOtherUserOnline] = useState<boolean>(false);

  const conversationId = parseInt(params.id || '0');
  const otherUserName = params.otherUserName || 'Unknown User';
  const otherUserId = parseInt(params.otherUserId || '0');

  useEffect(() => {
    loadUserData();
    loadMessages();
    loadOtherUserStatus();
    setupSocketListeners();
    
    // Refresh online status every 10 seconds
    const statusInterval = setInterval(loadOtherUserStatus, 10000);
    
    return () => {
      // Cleanup socket listeners and interval
      socketService.removeAllListeners();
      clearInterval(statusInterval);
    };
  }, []);

  // Refresh status when user returns to chat
  useFocusEffect(
    React.useCallback(() => {
      loadOtherUserStatus();
      
      // Mark messages as read when returning to chat
      if (currentUser && messages.length > 0) {
        const unreadMessages = messages.filter(
          (msg: Message) => msg.sender_id !== currentUser.id && !msg.is_read
        );
        
        if (unreadMessages.length > 0) {
          console.log(`📖 Found ${unreadMessages.length} unread messages on focus, marking as read`);
          markMessagesAsRead();
          
          // Also notify conversation list immediately to clear unread count
          notifyConversationListUnreadCleared();
        }
      } else if (currentUser && messages.length === 0) {
        // If no messages yet, still notify that conversation was opened
        notifyConversationListUnreadCleared();
      }
    }, [currentUser, messages, conversationId])
  );

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadOtherUserStatus = async () => {
    try {
      // Fetch the other user's current status
      const response = await fetch(getApiUrl(SERVER_CONFIG.ENDPOINTS.USERS), {
        headers: {
          'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const otherUser = data.users.find((user: any) => user.id === otherUserId);
        if (otherUser) {
          setOtherUserOnline(otherUser.is_online);
        }
      }
    } catch (error) {
      console.error('Error loading other user status:', error);
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await conversationsAPI.getMessages(conversationId);
      if (response.success) {
        setMessages(response.messages);
        
        // Mark messages as read when chat is opened
        if (currentUser && response.messages.length > 0) {
          // Find unread messages from the other user
          const unreadMessages = response.messages.filter(
            (msg: Message) => msg.sender_id !== currentUser.id && !msg.is_read
          );
          
          if (unreadMessages.length > 0) {
            console.log(`📖 Found ${unreadMessages.length} unread messages, marking as read`);
            markMessagesAsRead();
            
            // Also notify conversation list immediately to clear unread count
            notifyConversationListUnreadCleared();
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      if (error.response?.status === 401) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Notify conversation list that unread count should be cleared
  const notifyConversationListUnreadCleared = () => {
    // Emit a custom event that the conversation list can listen to
    socketService.emitCustomEvent('conversation_opened', { 
      conversationId: conversationId,
      userId: currentUser?.id
    });
    console.log(`📢 Notified conversation list that conversation ${conversationId} was opened`);
  };

  // Mark messages as read in this conversation
  const markMessagesAsRead = async () => {
    try {
      if (!currentUser) return;
      
      // Find unread messages from the other user
      const unreadMessages = messages.filter(
        (msg: Message) => msg.sender_id !== currentUser.id && !msg.is_read
      );
      
      if (unreadMessages.length === 0) return;
      
      console.log(`📖 Marking ${unreadMessages.length} messages as read in conversation ${conversationId}`);
      
      // Emit message read event to server
      socketService.emitCustomEvent('message:read', {
        conversationId: conversationId,
        userId: currentUser.id
      });
      
      // Update local message state to mark messages as read
      setMessages(prev => 
        prev.map(msg => 
          msg.sender_id !== currentUser.id && !msg.is_read
            ? { ...msg, is_read: true, read_at: new Date().toISOString() }
            : msg
        )
      );
      
      console.log(`✅ Marked ${unreadMessages.length} messages as read locally`);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const setupSocketListeners = () => {
    // Listen for new messages
    socketService.onNewMessage((message: any) => {
      if (message.conversationId === conversationId) {
        console.log('📨 New message received in chat:', message);
        console.log(`📊 Message delivery status: ${message.deliveryStatus}, is_delivered: ${message.is_delivered}`);
        
        setMessages(prev => {
          // Check if message already exists to avoid duplicates
          const exists = prev.find(msg => msg.id === message.id);
          if (exists) {
            console.log('⚠️ Message already exists, skipping duplicate');
            return prev;
          }
          
          // Ensure the message has the correct delivery status based on deliveryStatus field
          const messageWithCorrectStatus = {
            ...message,
            is_delivered: message.deliveryStatus === 'delivered' || message.is_delivered
          };
          
          console.log(`✅ Adding new message to chat with status: ${messageWithCorrectStatus.is_delivered ? 'delivered' : 'sent'}`);
          console.log(`📊 Final message object:`, messageWithCorrectStatus);
          return [...prev, messageWithCorrectStatus];
        });
      }
    });

    // Listen for typing indicators
    socketService.onTypingStart((data: any) => {
      if (data.conversationId === conversationId && data.userId !== currentUser?.id) {
        console.log('⌨️ Typing started by other user');
        setIsTyping(true);
      }
    });

    socketService.onTypingStop((data: any) => {
      if (data.conversationId === conversationId && data.userId !== currentUser?.id) {
        console.log('⌨️ Typing stopped by other user');
        setIsTyping(false);
      }
    });

    // Listen for user status changes
    socketService.onUserStatusChange((data: any) => {
      if (data.userId === otherUserId) {
        console.log(`👤 Other user status changed: ${data.isOnline ? 'Online' : 'Offline'}`);
        setOtherUserOnline(data.isOnline);
        
        // Update delivery status for all pending messages when user comes online
        if (data.isOnline) {
          updatePendingMessageDeliveryStatus();
        }
      }
    });

    // Listen for global typing status changes
    socketService.onUserTypingStatus((data: any) => {
      if (data.userId === otherUserId) {
        console.log(`⌨️ Global typing status for ${data.userName}: ${data.isTyping ? 'started' : 'stopped'}`);
        setIsTyping(data.isTyping);
      }
    });

    // Listen for message delivery confirmation
    socketService.onMessageDelivered((data: any) => {
      if (data.conversationId === conversationId) {
        console.log('📬 Message delivered:', data);
        setMessages(prev => 
          prev.map(msg => 
            msg.id === data.messageId ? { ...msg, is_delivered: true } : msg
          )
        );
        
        // Also update the conversation list to reflect delivery status
        console.log('🔄 Message delivery status updated in chat');
      }
    });

    // Listen for message read confirmation
    socketService.onMessageRead((data: any) => {
      if (data.conversationId === conversationId) {
        console.log('📖 Message read:', data);
        setMessages(prev => 
          prev.map(msg => 
            data.messageIds?.includes(msg.id) ? { ...msg, is_read: true } : msg
          )
        );
      }
    });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    console.log(`📤 Sending message: "${newMessage.trim()}" to conversation ${conversationId}`);
    console.log(`👤 Current user: ${currentUser.id}, Other user: ${otherUserId}`);

    setSending(true);
    try {
      // Ensure conversation exists first
      if (!conversationId || isNaN(conversationId)) {
        console.log('❌ Invalid conversation ID, creating conversation first');
        const response = await conversationsAPI.getOrCreate(otherUserId);
        if (response.success) {
          console.log(`✅ Created/found conversation: ${response.conversation.id}`);
          // Update the conversation ID
          const newConversationId = response.conversation.id;
          // Navigate to the correct conversation
          router.replace({
            pathname: '/chat/[id]',
            params: { 
              id: newConversationId.toString(),
              otherUserName,
              otherUserId: otherUserId.toString()
            }
          });
          return;
        }
      }

      // Send message via socket
      socketService.sendMessage(conversationId, newMessage.trim(), currentUser.id);
      console.log(`✅ Message sent via socket`);
      
      // Clear input
      setNewMessage('');
      
      // Stop typing indicator
      socketService.stopTyping(conversationId, currentUser.id);
      
      // Clear typing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (text: string) => {
    setNewMessage(text);
    
    // Start typing indicator
    if (currentUser) {
      socketService.startTyping(conversationId, currentUser.id);
      
      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      // Set new timeout to stop typing indicator
      const timeout = setTimeout(() => {
        socketService.stopTyping(conversationId, currentUser.id);
        setTypingTimeout(null);
      }, 1000);
      
      setTypingTimeout(timeout);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === currentUser?.id;
    
    // Determine tick status for own messages
    const getTickStatus = () => {
      if (!isOwnMessage) return null;
      
      // WhatsApp-style tick logic - based on actual delivery/read status
      if (item.is_read) {
        return <Text style={[styles.readStatus, styles.readStatusRead]}>✓✓</Text>; // Blue double ticks (read)
      } else if (item.is_delivered) {
        return <Text style={styles.readStatus}>✓✓</Text>; // Gray double ticks (delivered)
      } else {
        return <Text style={styles.readStatus}>✓</Text>; // Single tick (sent)
      }
    };
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownBubble : styles.otherBubble
        ]}>
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>
              {formatTime(item.created_at)}
            </Text>
            {getTickStatus()}
          </View>
        </View>
      </View>
    );
  };



  // Update message delivery status immediately
  const updateMessageDeliveryStatus = (messageId: number, isDelivered: boolean, isRead: boolean = false) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { 
          ...msg, 
          is_delivered: isDelivered,
          is_read: isRead || msg.is_read
        } : msg
      )
    );
  };

  // Update delivery status for all pending messages when user comes online
  const updatePendingMessageDeliveryStatus = () => {
    if (!currentUser) return;
    
    setMessages(prev => 
      prev.map(msg => {
        // Only update messages sent by current user that are not yet delivered
        if (msg.sender_id === currentUser.id && !msg.is_delivered) {
          console.log(`🔄 Updating pending message ${msg.id} to delivered status`);
          return { ...msg, is_delivered: true };
        }
        return msg;
      })
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{otherUserName}</Text>
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusDot,
              { backgroundColor: isTyping ? '#007AFF' : otherUserOnline ? '#4CAF50' : '#999' }
            ]} />
            <Text style={[
              styles.headerStatus,
              { color: isTyping ? '#007AFF' : otherUserOnline ? '#4CAF50' : '#999' }
            ]}>
              {isTyping ? 'typing...' : otherUserOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Typing indicator */}
      {isTyping && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>{otherUserName} is typing...</Text>
        </View>
      )}

      {/* Input area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={handleTyping}
          placeholder="Type a message..."
          multiline
          maxLength={1000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || sending}
        >
          <Text style={styles.sendButtonText}>
            {sending ? '...' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerStatus: {
    fontSize: 14,
    color: '#34C759',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 15,
  },
  messageContainer: {
    marginBottom: 10,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
  },
  ownBubble: {
    backgroundColor: '#fff', // Changed from '#007AFF' to '#fff' to match received messages
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#007AFF', // Blue border to distinguish own messages
  },
  otherBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#333', // Changed from '#fff' to '#333' to be readable on white background
  },
  otherMessageText: {
    color: '#333',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  readStatus: {
    fontSize: 12,
    color: '#999',
    marginLeft: 5,
  },
  readStatusRead: {
    color: '#007AFF', // Blue color for read status
  },
  typingIndicator: {
    padding: 10,
    paddingHorizontal: 15,
  },
  typingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 10,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
});

export default ChatScreen;
