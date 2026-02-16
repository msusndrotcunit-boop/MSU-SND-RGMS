import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Surface, useTheme } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { Shield } from 'lucide-react-native';

const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { login } = useAuth();
  const theme = useTheme();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(username.trim(), password);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Surface style={styles.logoContainer} elevation={0}>
          <Shield size={80} color={theme.colors.primary} />
          <Text variant="headlineMedium" style={styles.title}>
            ROTC Grading System
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Admin Portal
          </Text>
        </Surface>

        <Surface style={styles.formContainer} elevation={2}>
          <Text variant="titleLarge" style={styles.loginTitle}>
            Sign In
          </Text>

          {error ? (
            <Surface style={styles.errorContainer} elevation={0}>
              <Text style={styles.errorText}>{error}</Text>
            </Surface>
          ) : null}

          <TextInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            left={<TextInput.Icon icon="account" />}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            style={styles.input}
            left={<TextInput.Icon icon="lock" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: 'transparent',
  },
  title: {
    marginTop: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    color: '#666',
  },
  formContainer: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  loginTitle: {
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});

export default LoginScreen;
