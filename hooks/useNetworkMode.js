// ekk-mobile/hooks/useNetworkMode.js
// Tracks real network state + user's manual mode preference.
// If online mode is set but network drops → auto-falls back to offline queue.

import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getMode, setMode, subscribeModeChange } from '../utils/offlineQueue';
import { API_BASE } from '../services/api';

async function canReachApiHealth(timeoutMs = 2500) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}/health`, { method: 'GET', signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

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

  // Keep all screen instances in sync when mode changes anywhere in app.
  useEffect(() => {
    const unsubscribe = subscribeModeChange((mode) => {
      setManualMode(mode);
      setNetworkLoading(false);
    });
    return unsubscribe;
  }, []);

  // Listen for real network changes
  useEffect(() => {
    const applyConnectivity = async (state) => {
      const hasLink = !!state?.isConnected;
      const internetReachable = state?.isInternetReachable !== false;

      if (hasLink && internetReachable) {
        setIsConnected(true);
        return;
      }

      // On some field networks/captive setups, internet check fails but LAN API is reachable.
      if (hasLink) {
        const apiReachable = await canReachApiHealth();
        setIsConnected(apiReachable);
        return;
      }

      setIsConnected(false);
    };

    const unsub = NetInfo.addEventListener(state => {
      void applyConnectivity(state);
    });

    // Get current state immediately
    NetInfo.fetch().then(state => {
      void applyConnectivity(state);
    });

    return unsub;
  }, []);

  const toggleMode = useCallback(async (newMode) => {
    setManualMode(newMode);
    await setMode(newMode);
  }, []);

  // Effective mode — what the app actually uses.
  // While loading saved preference, default to offline to avoid accidental online submissions.
  const effectiveMode = networkLoading
    ? 'offline'
    : (manualMode === 'offline' || !isConnected) ? 'offline' : 'online';

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