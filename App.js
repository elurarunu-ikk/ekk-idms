import { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Alert, Linking, AppState } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import LoginScreen from './screens/LoginScreen';
import CaptureScreen from './screens/CaptureScreen';
import EntriesScreen from './screens/EntriesScreen';
import ApprovalScreen from './screens/ApprovalScreen';
import SettingsScreen from './screens/SettingsScreen';
import authEvents from './utils/authEvents';
import { API_BASE } from './services/api';

export const navigationRef = createNavigationContainerRef();

function isVersionBehind(installed, minimum) {
  const a = installed.split('.').map(Number);
  const b = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) < (b[i] || 0)) return true;
    if ((a[i] || 0) > (b[i] || 0)) return false;
  }
  return false;
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
    return (
      <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#1a1a1a' }}>
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ tabBarLabel: 'Settings', tabBarIcon: () => <Text>⚙️</Text> }}
        />
        <Tab.Screen
          name="Capture"
          component={CaptureScreen}
          options={{ tabBarLabel: 'Capture', tabBarIcon: () => <Text>📍</Text> }}
        />
        <Tab.Screen
          name="Entries"
          component={EntriesScreen}
          options={{ tabBarLabel: 'My Entries', tabBarIcon: () => <Text>📋</Text> }}
        />
        <Tab.Screen
          name="Approvals"
          component={ApprovalScreen}
          options={{ tabBarLabel: 'Approvals', tabBarIcon: () => <Text>✅</Text> }}
        />
      </Tab.Navigator>
    );
 }

export default function App() {
  const [versionChecked, setVersionChecked] = useState(false);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/app/version`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        const data = await res.json();
        const installedVersion =
          Constants.expoConfig?.version ||
          Constants.manifest?.version ||
          '0.0.0';

        if (data.force_update && isVersionBehind(installedVersion, data.minimum_version)) {
          setUpdateInfo(data);
          setUpdateRequired(true);
          Alert.alert(
            '⬆️ Update Required',
            data.message,
            [{ text: 'Download Update', onPress: () => Linking.openURL(data.download_url) }],
            { cancelable: false }
          );
        }
      } catch (e) {
        // Version check failed (offline etc.) — allow app to continue.
        // Never block the app just because the version endpoint
        // was unreachable. Field engineers may be offline.
        console.warn('[version] Check failed, continuing:', e.message);
      } finally {
        setVersionChecked(true);
      }
    };
    checkVersion();
  }, []);

  useEffect(() => {
    if (!updateRequired || !updateInfo) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        Alert.alert(
          '⬆️ Update Required',
          updateInfo.message,
          [{ text: 'Download Update', onPress: () => Linking.openURL(updateInfo.download_url) }],
          { cancelable: false }
        );
      }
    });
    return () => subscription.remove();
  }, [updateRequired, updateInfo]);

  useEffect(() => {
    const handler = () => {
      navigationRef.current?.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    };
    authEvents.on('unauthorized', handler);
    return () => authEvents.off('unauthorized', handler);
  }, []);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        if (__DEV__) return; // Skip update check in development
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          setUpdateAvailable(true);
        }
      } catch (e) {
        // Silently ignore — network error, offline, etc.
        console.warn('[updates] Check failed:', e.message);
      }
    };
    checkForUpdates();
  }, []);

  useEffect(() => {
    if (!updateAvailable) return;
    Alert.alert(
      '🆕 Update Ready',
      'A new version of EKK IDMS has been downloaded.\n\nTap "Restart Now" to apply the update immediately.',
      [
        {
          text: 'Later',
          style: 'cancel',
        },
        {
          text: 'Restart Now',
          onPress: async () => {
            await Updates.reloadAsync();
          },
        },
      ],
      { cancelable: false }
    );
  }, [updateAvailable]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}