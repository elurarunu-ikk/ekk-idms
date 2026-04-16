// ekk-mobile/hooks/useNetworkMode.js
// Tracks real network state + user's manual mode preference.
// If online mode is set but network drops → auto-falls back to offline queue.

import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getMode, setMode } from '../utils/offlineQueue';

/**
 * Returns:
 *   isConnected     — actual network state (from NetInfo)
 *   manualMode      — user preference: 'online' | 'offline'
 *   effectiveMode   — what the app actually uses:
 *                     'offline' if manualMode=offline OR network is down
 *                     'online'  only if manualMode=online AND connected
 *   toggleMode      — switch between online/offline preference
 *   networkLoading  — true while checking initial state
 */
export function useNetworkMode() {
  const [isConnected,    setIsConnected]    = useState(true);
  const [manualMode,     setManualMode]     = useState('online');
  const [networkLoading, setNetworkLoading] = useState(true);

  // Load saved mode preference on mount
  useEffect(() => {
    getMode().then(mode => {
      setManualMode(mode);
      setNetworkLoading(false);
    });
  }, []);

  // Listen for real network changes
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsConnected(!!state.isConnected && !!state.isInternetReachable);
    });
    // Get current state immediately
    NetInfo.fetch().then(state => {
      setIsConnected(!!state.isConnected && !!state.isInternetReachable);
    });
    return unsub;
  }, []);

  const toggleMode = useCallback(async (newMode) => {
    setManualMode(newMode);
    await setMode(newMode);
  }, []);

  // Effective mode — what the app actually uses
  const effectiveMode = (manualMode === 'offline' || !isConnected) ? 'offline' : 'online';

  // Why offline — for showing the right message to user
  const offlineReason = !isConnected
    ? 'no_network'           // network is down regardless of preference
    : manualMode === 'offline'
      ? 'manual'             // user chose offline mode
      : null;

  return {
    isConnected,
    manualMode,
    effectiveMode,
    offlineReason,
    toggleMode,
    networkLoading,
    isOffline: effectiveMode === 'offline',
    isOnline:  effectiveMode === 'online',
  };
}