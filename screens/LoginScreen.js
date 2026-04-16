import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { login } from '../services/auth';

export default function LoginScreen({ navigation }) {
  const [email, setEmail]         = useState('admin@ekk.in');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);

  async function handleLogin() {
    if (!email || !password) {
        Alert.alert('Error', 'Enter email and password');
        return;
    }
    setLoading(true);
    try {
        const result = await login(email, password);
        console.log('Login success:', result);
        navigation.replace('Main');
    } catch (e) {
        console.log('Login error full:', JSON.stringify(e));
        console.log('Response:', e?.response?.status, e?.response?.data);
        console.log('Message:', e?.message);
        Alert.alert('Login Failed', JSON.stringify(e?.response?.data) || e?.message || 'Unknown error');
    } finally {
        setLoading(false);
    }
    }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>EKK IDMS</Text>
        <Text style={styles.sub}>Field Capture System</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="engineer@ekk.in"
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passWrap}>
          <TextInput
            style={styles.passInput}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            placeholder="••••••••"
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPass(!showPass)}
          >
            <Text style={styles.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Sign In</Text>
          }
        </TouchableOpacity>

        <Text style={styles.version}>v1.0 · EKK Infrastructure</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f0',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 13,
    color: '#888',
    marginBottom: 28,
    marginTop: 2,
  },
  label: {
    fontSize: 12,
    color: '#555',
    marginBottom: 6,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
    backgroundColor: '#fafafa',
    color: '#1a1a1a',
  },
  passWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  passInput: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  eyeBtn: {
    padding: 12,
  },
  eyeText: {
    fontSize: 16,
  },
  btn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  version: {
    textAlign: 'center',
    color: '#bbb',
    fontSize: 11,
    marginTop: 20,
  },
});