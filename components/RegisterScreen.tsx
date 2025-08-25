import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

const RegisterScreen = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("❌ Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("❌ Error", "Passwords do not match");
      return;
    }

    if (password.length < 6) {
      Alert.alert("❌ Error", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.register(name, email, password);

      if (response.success) {
        // Store token and user data
        await AsyncStorage.setItem('authToken', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
        
        Alert.alert("✅ Registration Successful", `Welcome ${response.user.name}!`, [
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
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join the chat community</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        editable={!loading}
      />
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
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!loading}
      />
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating Account..." : "Create Account"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/login")} disabled={loading}>
        <Text style={styles.link}>Already have an account? Sign In</Text>
      </TouchableOpacity>
    </View>
  );
};

export default RegisterScreen;

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
