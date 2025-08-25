import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

const LoginScreen = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("❌ Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.login(email, password);

      if (response.success) {
        // Store token and user data
        await AsyncStorage.setItem('authToken', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
        
        Alert.alert("✅ Login Successful", `Welcome ${response.user.name}`, [
          {
            text: "Continue",
            onPress: () => router.push("/(tabs)")
          }
        ]);
      } else {
        Alert.alert("❌ Error", response.message);
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.message || "Could not connect to server";
      Alert.alert("❌ Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Sign in to continue chatting</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Signing In..." : "Sign In"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/register")} disabled={loading}>
        <Text style={styles.link}>Don't have an account? Register</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "center", 
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333'
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666'
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd',
    padding: 15, 
    marginVertical: 10, 
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16
  }, 
  button: { 
    backgroundColor: "#007AFF", 
    padding: 15, 
    borderRadius: 8, 
    marginTop: 20,
    marginBottom: 20
  },
  buttonDisabled: {
    backgroundColor: "#ccc"
  },
  buttonText: { 
    color: "#fff", 
    textAlign: "center", 
    fontSize: 16,
    fontWeight: '600'
  }, 
  link: { 
    color: "#007AFF", 
    textAlign: "center", 
    marginTop: 20,
    fontSize: 16
  }, 
});
