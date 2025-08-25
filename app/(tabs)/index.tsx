import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { conversationsAPI } from '../../services/conversations';
import socketService from '../../services/socket';

interface Conversation {
  conversation_id: number;
  other_user_id: number;
  other_user_name: string;
  other_user_email: string;
  other_user_avatar: string;
  other_user_online: boolean;
  other_user_last_seen: string;
  last_message: string;
  last_message_time: string;
  last_message_sender_id: number;
  unread_count: number;
  other_user_typing?: boolean;
}

const HomeScreen = () => {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<Map<number, boolean>>(new Map());
  const [isRefreshingTyping, setIsRefreshingTyping] = useState(false);
  const [isUpdatingConversations, setIsUpdatingConversations] = useState(false);
  const [lastMessageUpdate, setLastMessageUpdate] = useState<number>(0);
  const processedMessageKeysRef = useRef<Set<string>>(new Set());
  
  // Debounce refs to prevent rapid successive calls
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const userData = await AsyncStorage.getItem('user');
        
        if (!token || !userData) {
          router.replace('/login');
          return;
        }

        const user = JSON.parse(userData);
        setCurrentUser(user);
        
        // Only connect to socket after authentication
        await socketService.connect();
        
        // Load conversations
        await loadConversations();
        
        // Setup socket listeners for real-time updates
        setupSocketListeners();
        
        // Start periodic status refresh (less frequent to avoid interference)
        const statusInterval = setInterval(() => {
          refreshUserStatus();
          refreshTypingStatus(); // Also refresh typing status periodically
        }, 30000); // Every 30 seconds to reduce interference
        
        // Start periodic conversation refresh for real-time updates (less frequent)
        const conversationInterval = setInterval(() => {
          updateConversationsSilently();
        }, 20000); // Every 20 seconds to reduce interference
        
        return () => {
          clearInterval(statusInterval);
          clearInterval(conversationInterval);
        };
      } catch (error) {
        console.error('Error checking auth:', error);
        router.replace('/login');
      }
    };

    checkAuthAndLoadData();
    
    // Cleanup socket listeners
    return () => {
      socketService.removeAllListeners();
      // Remove custom event listeners
      socketService.removeCustomEventListener('conversation_opened');
      // Clear typing status to prevent stale data
      setTypingUsers(new Map());
      // Clear any pending timeouts
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Refresh user online status periodically (preserve all other data)
  const refreshUserStatus = async () => {
    try {
      const response = await conversationsAPI.getAll();
      if (response.success) {
        // Update only the online status and last seen, preserve all other data
        setConversations(prev => 
          prev.map(conv => {
            const updatedUser = response.conversations.find(
              (c: any) => c.conversation_id === conv.conversation_id
            );
            if (updatedUser) {
              // Only update online status and last seen, preserve everything else
              return { 
                ...conv, 
                other_user_online: updatedUser.other_user_online,
                other_user_last_seen: updatedUser.other_user_last_seen || conv.other_user_last_seen
              };
            }
            return conv;
          })
        );
        console.log('✅ Refreshed user online status while preserving conversation data');
      }
    } catch (error: any) {
      console.error('Error refreshing user status:', error);
      if (error.response?.status === 401) {
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('user');
        router.replace('/login');
      }
    }
  };

  // Refresh typing status by re-setting up socket listeners
  const refreshTypingStatus = () => {
    if (isRefreshingTyping) {
      console.log('⚠️ Typing status refresh already in progress, skipping...');
      return;
    }
    
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Debounce the refresh to prevent rapid successive calls
    typingTimeoutRef.current = setTimeout(() => {
      try {
        console.log('🔄 Refreshing typing status...');
        setIsRefreshingTyping(true);
        
        // Re-setup socket listeners to ensure they're active
        setupSocketListeners();
        
        // The existing socket listeners will handle current typing status
        // through the global typing status events
        
        // Reset the flag after a short delay
        setTimeout(() => {
          setIsRefreshingTyping(false);
        }, 1000);
      } catch (error) {
        console.error('Error refreshing typing status:', error);
        setIsRefreshingTyping(false);
      }
    }, 300); // 300ms debounce
  };

  // Refresh conversations when user returns to this screen
  useFocusEffect(
    React.useCallback(() => {
      if (currentUser) {
        console.log('🔄 Conversation list focused, refreshing...');
        // Use silent update when returning to screen to avoid loader
        updateConversationsSilently();
        
        // Also do an immediate sync for accurate unread counts
        setTimeout(() => {
          updateConversationsSilently();
        }, 100);
        
        // Refresh typing status with a small delay to ensure socket is stable
        setTimeout(() => {
          refreshTypingStatus();
        }, 500);
      }
      
      // Cleanup function for useFocusEffect
      return () => {
        // Clear any pending timeouts when screen loses focus
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        // Remove custom event listeners when screen loses focus
        socketService.removeCustomEventListener('conversation_opened');
      };
    }, [currentUser])
  );

  // Setup socket listeners for real-time updates
  const setupSocketListeners = () => {
    // Listen for new messages to update conversation list
    socketService.onNewMessage((message: any) => {
      console.log('📨 New message received in conversation list:', message);
      if (message.conversationId) {
        // De-duplicate the same message arriving multiple times
        const messageKey = `${message.id ?? ''}|${message.conversationId}|${message.sender_id}|${message.created_at}|${message.content ?? ''}`;
        if (processedMessageKeysRef.current.has(messageKey)) {
          console.log('🛑 Skipping duplicate message for unread increment:', messageKey);
          return;
        }
        processedMessageKeysRef.current.add(messageKey);

        // Update message content immediately for better UX
        updateConversationWithNewMessage(message);
        
        // Also check if this is a new conversation and add it to the list
        checkAndAddNewConversation(message);
        
        // Track when we last updated for this message
        const now = Date.now();
        setLastMessageUpdate(now);
        
        // Single server sync after a delay to ensure consistency
        setTimeout(() => {
          // Only update if this is still the most recent message update
          if (lastMessageUpdate === now) {
            updateConversationsSilently();
          }
        }, 1000); // Single sync after 1 second to avoid interference
      }
    });

    // Listen for messages marked as read to update unread count (only for current user)
    socketService.onMessageRead((data: any) => {
      console.log('📖 Messages marked as read:', data);
      if (data.conversationId && data.userId === currentUser?.id) {
        // Only clear unread count if it's for the current user
        console.log(`✅ Clearing unread count for conversation ${data.conversationId} - user ${data.userId} marked as read`);
        clearUnreadCountForConversation(data.conversationId);
      } else {
        console.log(`⚠️ Ignoring message read event - not for current user (event: ${data.userId}, current: ${currentUser?.id})`);
      }
    });

    // Listen for conversation opened to clear unread count immediately (only for current user)
    socketService.onConversationOpened((data: any) => {
      console.log('📱 Conversation opened:', data);
      if (data.conversationId && data.userId === currentUser?.id) {
        // Only clear unread count if it's for the current user
        console.log(`✅ Clearing unread count for conversation ${data.conversationId} - user ${data.userId} opened it`);
        clearUnreadCountForConversation(data.conversationId);
      } else {
        console.log(`⚠️ Ignoring conversation opened event - not for current user (event: ${data.userId}, current: ${currentUser?.id})`);
      }
    });

    // Listen for custom conversation opened event from chat screen
    socketService.onCustomEvent('conversation_opened', (data: any) => {
      console.log('📱 Custom conversation opened event:', data);
      if (data.conversationId && data.userId === currentUser?.id) {
        // Only clear unread count if it's for the current user
        console.log(`✅ Clearing unread count for conversation ${data.conversationId} - user ${data.userId} opened it`);
        clearUnreadCountForConversation(data.conversationId);
      } else {
        console.log(`⚠️ Ignoring conversation opened event - not for current user (event: ${data.userId}, current: ${currentUser?.id})`);
      }
    });

    // Listen for conversations updated when user comes online or new conversations created
    socketService.onConversationsUpdated((data: any) => {
      console.log('📊 Conversations updated:', data);
      if (data.userId === currentUser?.id) {
        // Refresh conversation list with latest data silently
        updateConversationsSilently();
        console.log('🔄 Refreshed conversation list after conversations updated');
      }
    });

    // Listen for user status changes
    socketService.onUserStatusChange((data: any) => {
      console.log('👤 User status changed:', data);
      if (data.userId && typeof data.isOnline === 'boolean') {
        updateUserOnlineStatus(data.userId, data.isOnline);
      }
    });

    // Listen for user typing status changes (global)
    socketService.onUserTypingStatus((data: any) => {
      if (data.userId !== currentUser?.id) {
        console.log(`⌨️ Global typing status for user ${data.userId} (${data.userName}): ${data.isTyping ? 'started' : 'stopped'}`);
        
        // Update typing status
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          if (data.isTyping) {
            newMap.set(data.userId, true);
          } else {
            newMap.delete(data.userId);
          }
          return newMap;
        });
      }
    });

    // Listen for local conversation typing events
    socketService.onTypingStart((data: any) => {
      if (data.userId !== currentUser?.id) {
        console.log(`⌨️ Local typing started by user ${data.userId} in conversation ${data.conversationId}`);
        
        // Update typing status
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(data.userId, true);
          return newMap;
        });
      }
    });

    socketService.onTypingStop((data: any) => {
      if (data.userId !== currentUser?.id) {
        console.log(`⌨️ Local typing stopped by user ${data.userId} in conversation ${data.conversationId}`);
        
        // Update typing status
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      }
    });

    // Listen for message delivery confirmations
    socketService.onMessageDelivered((data: any) => {
      console.log('📬 Message delivered:', data);
      // Could update conversation list if needed
    });
  };

  // Update conversation when new message arrives
  const updateConversationWithNewMessage = (message: any) => {
    console.log('🔄 Updating conversation with new message:', message);
    setConversations(prev => 
      prev.map(conv => {
        if (conv.conversation_id === message.conversationId) {
          // Update both message content AND unread count simultaneously for better UX
          // IMPORTANT: Preserve other_user_online status to prevent users going offline
          const currentUnreadCount = typeof conv.unread_count === 'string' ? parseInt(conv.unread_count) || 0 : conv.unread_count || 0;
          const newUnreadCount = message.sender_id !== currentUser?.id ? currentUnreadCount + 1 : currentUnreadCount;
          
          const updatedConv = {
            ...conv,
            last_message: message.content,
            last_message_time: message.created_at,
            last_message_sender_id: message.sender_id,
            unread_count: newUnreadCount,
            // Preserve online status and other important fields
            other_user_online: conv.other_user_online,
            other_user_last_seen: conv.other_user_last_seen,
            other_user_typing: conv.other_user_typing
          };
          console.log(`✅ Updated conversation ${conv.conversation_id} with new message and unread count: ${currentUnreadCount} → ${newUnreadCount} (preserved online status: ${conv.other_user_online})`);
          return updatedConv;
        }
        return conv;
      })
    );
  };

  // Clear unread count for a specific conversation (only for current user's view)
  const clearUnreadCountForConversation = (conversationId: number) => {
    console.log('🧹 Clearing unread count for conversation:', conversationId);
    setConversations(prev => 
      prev.map(conv => {
        if (conv.conversation_id === conversationId) {
          const updatedConv = { ...conv, unread_count: 0 };
          console.log(`✅ Cleared unread count for conversation ${conversationId}: ${conv.unread_count} → 0 (current user's view only)`);
          return updatedConv;
        }
        return conv;
      })
    );
  };

  // Update user online status
  const updateUserOnlineStatus = (userId: number, isOnline: boolean) => {
    console.log(`👤 Updating user ${userId} online status to: ${isOnline}`);
    setConversations(prev => 
      prev.map(conv => {
        if (conv.other_user_id === userId) {
          const updatedConv = { ...conv, other_user_online: isOnline };
          console.log('✅ Updated user online status:', updatedConv);
          return updatedConv;
        }
        return conv;
      })
    );
  };

  // Check and add new conversation if it doesn't exist
  const checkAndAddNewConversation = async (message: any) => {
    try {
      // Check if conversation already exists in the list
      const existingConversation = conversations.find(
        conv => conv.conversation_id === message.conversationId
      );
      
      if (!existingConversation) {
        console.log(`🆕 New conversation detected: ${message.conversationId}, fetching details...`);
        
        // Fetch the new conversation details from the server
        const response = await conversationsAPI.getAll();
        if (response.success) {
          // Find the new conversation in the response
          const newConversation = response.conversations.find(
            (conv: any) => conv.conversation_id === message.conversationId
          );
          
          if (newConversation) {
            console.log(`✅ Adding new conversation to list:`, newConversation);
            // Process unread_count to ensure it's a number
            const processedConversation = {
              ...newConversation,
              unread_count: typeof newConversation.unread_count === 'string' ? parseInt(newConversation.unread_count) || 0 : newConversation.unread_count || 0
            };
            
            // Use functional update to ensure we don't add duplicates
            setConversations(prev => {
              // Double-check we don't already have this conversation
              if (prev.some(conv => conv.conversation_id === message.conversationId)) {
                console.log(`⚠️ Conversation ${message.conversationId} already exists, skipping...`);
                return prev;
              }
              return [processedConversation, ...prev];
            });
          } else {
            // If not found in response, do a silent update to get latest data
            updateConversationsSilently();
          }
        }
      } else {
        // Conversation exists, just update the last message
        console.log(`ℹ️ Conversation ${message.conversationId} already exists in list`);
      }
    } catch (error) {
      console.error('Error checking/adding new conversation:', error);
    }
  };

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await conversationsAPI.getAll();
      if (response.success) {
        // Ensure unread_count is properly parsed as a number for each conversation
        const processedConversations = response.conversations.map((conv: any) => ({
          ...conv,
          unread_count: typeof conv.unread_count === 'string' ? parseInt(conv.unread_count) || 0 : conv.unread_count || 0
        }));
        setConversations(processedConversations);
        console.log(`📱 Loaded ${processedConversations.length} conversations with processed unread counts`);
      }
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      if (error.response?.status === 401) {
        // Token expired, redirect to login
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('user');
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Silent update function that doesn't show loader
  const updateConversationsSilently = async () => {
    if (isUpdatingConversations) {
      console.log('⚠️ Conversation update already in progress, skipping...');
      return;
    }
    
    // Clear any existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // Debounce the update to prevent rapid successive calls
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        setIsUpdatingConversations(true);
        console.log('🔄 Syncing conversations with server for accurate unread counts...');
        
        const response = await conversationsAPI.getAll();
        if (response.success) {
          // Ensure unread_count is properly parsed as a number for each conversation
          const processedConversations = response.conversations.map((conv: any) => ({
            ...conv,
            unread_count: typeof conv.unread_count === 'string' ? parseInt(conv.unread_count) || 0 : conv.unread_count || 0
          }));
          
          // Log unread count changes for debugging
          const currentConversations = conversations;
          processedConversations.forEach((newConv: any) => {
            const oldConv = currentConversations.find(c => c.conversation_id === newConv.conversation_id);
            if (oldConv && oldConv.unread_count !== newConv.unread_count) {
              console.log(`📊 Unread count sync: Conversation ${newConv.conversation_id} (${newConv.other_user_name}): ${oldConv.unread_count} → ${newConv.unread_count}`);
            }
          });
          
          // Update conversations while preserving any local changes that shouldn't be overwritten
          setConversations(prev => {
            return processedConversations.map((newConv: any) => {
              const existingConv = prev.find(c => c.conversation_id === newConv.conversation_id);
              if (existingConv) {
                // Preserve local typing status and other UI state
                // Also preserve local unread count if it was recently updated locally
                const shouldPreserveUnreadCount = existingConv.last_message_time === newConv.last_message_time && 
                  existingConv.last_message === newConv.last_message &&
                  existingConv.last_message_sender_id === newConv.last_message_sender_id;
                
                // If we have a local unread count that's higher than server, preserve it
                // This prevents server from overwriting recent local updates
                const finalUnreadCount = shouldPreserveUnreadCount && existingConv.unread_count > newConv.unread_count 
                  ? existingConv.unread_count 
                  : newConv.unread_count;
                
                return {
                  ...newConv,
                  other_user_typing: existingConv.other_user_typing,
                  unread_count: finalUnreadCount
                };
              }
              return newConv;
            });
          });
          
          console.log(`✅ Synced ${processedConversations.length} conversations with server while preserving local state and recent unread counts`);
        }
      } catch (error: any) {
        console.error('Error silently updating conversations:', error);
        // Don't redirect on silent update errors, just log them
      } finally {
        setIsUpdatingConversations(false);
      }
    }, 500); // 500ms debounce
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const handleNewChat = () => {
    router.push('/users');
  };

  const handleConversationPress = (conversation: Conversation) => {
    console.log(`📱 Opening conversation ${conversation.conversation_id} with ${conversation.other_user_name}`);
    
    // Clear unread count immediately when conversation is opened (only for current user's view)
    if (conversation.unread_count > 0) {
      console.log(`🧹 Clearing unread count (${conversation.unread_count}) for conversation ${conversation.conversation_id} - current user's view only`);
      clearUnreadCountForConversation(conversation.conversation_id);
      
      // Emit conversation opened event to server (this only affects current user's unread count)
      socketService.emitCustomEvent('conversation:opened', {
        conversationId: conversation.conversation_id,
        userId: currentUser?.id,
        timestamp: Date.now()
      });
    }
    
    router.push({
      pathname: '/chat/[id]',
      params: { 
        id: conversation.conversation_id,
        otherUserName: conversation.other_user_name,
        otherUserId: conversation.other_user_id
      }
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => handleConversationPress(item)}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, item.other_user_online && styles.onlineAvatar]}>
          <Text style={styles.avatarText}>
            {item.other_user_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        {item.other_user_online && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName}>{item.other_user_name}</Text>
          <Text style={styles.conversationTime}>
            {item.last_message_time ? formatTime(item.last_message_time) : ''}
          </Text>
        </View>
        
        {/* Status line - show typing or online status */}
        <View style={styles.statusLine}>
          {typingUsers.has(item.other_user_id) ? (
            <Text style={styles.typingStatus}>typing...</Text>
          ) : item.other_user_online ? (
            <Text style={styles.onlineStatus}>Online</Text>
          ) : (
            <Text style={styles.offlineStatus}>Offline</Text>
          )}
        </View>
        
        <View style={styles.conversationFooter}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.last_message_sender_id === currentUser?.id ? 'You: ' : ''}
            {item.last_message || 'No messages yet'}
          </Text>
          
          {/* Unread count badge */}
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>
                {item.unread_count > 99 ? '99+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
          <Text style={styles.newChatButtonText}>+</Text>
        </TouchableOpacity>
      </View> */}

      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No conversations yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Start a new chat to begin messaging
          </Text>
          <TouchableOpacity style={styles.startChatButton} onPress={handleNewChat}>
            <Text style={styles.startChatButtonText}>Start Your First Chat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.conversation_id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newChatButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  startChatButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  startChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineAvatar: {
    backgroundColor: '#34C759',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#fff',
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  statusLine: {
    marginBottom: 5,
  },
  typingStatus: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
  },
  onlineStatus: {
    fontSize: 12,
    color: '#34C759',
  },
  offlineStatus: {
    fontSize: 12,
    color: '#999',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  unreadBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
