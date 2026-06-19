// Simple event emitter for React Native — does not use Node's
// 'events' module which is not available in the RN bundle environment.
const listeners = {};

const authEvents = {
  on(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
  },
  off(event, handler) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(h => h !== handler);
  },
  emit(event, ...args) {
    if (!listeners[event]) return;
    listeners[event].forEach(h => h(...args));
  },
};

export default authEvents;
