import { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import CaptureScreen from './screens/CaptureScreen';
import EntriesScreen from './screens/EntriesScreen';
import ApprovalScreen from './screens/ApprovalScreen';
import SettingsScreen from './screens/SettingsScreen';
import authEvents from './utils/authEvents';

export const navigationRef = createNavigationContainerRef();

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

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}