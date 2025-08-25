import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import socketService from '../services/socket';

export default function RootLayout() {
  useEffect(() => {
    // Track app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('App state changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        // App came to foreground
        socketService.updateAppState('active');
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background
        socketService.updateAppState('background');
      }
    };

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
