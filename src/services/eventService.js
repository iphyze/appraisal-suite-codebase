import api from './api';

class EventService {
  constructor() {
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.listeners = new Map();
  }

  connect() {
    this.disconnect();
    const baseURL = api.defaults.baseURL;
    this.eventSource = new EventSource(`${baseURL}/events/logs`, { withCredentials: true });
    this.eventSource.onopen = () => { this.reconnectAttempts = 0; this.dispatchEvent('connected', { status: 'connected' }); };
    this.eventSource.onerror = () => {
      this.dispatchEvent('error', { error: 'Connection error' });
      if (this.eventSource?.readyState === EventSource.CLOSED) this.reconnect();
    };
    ['log', 'response', 'reminder', 'reminderError', 'connected', 'error'].forEach((type) => {
      this.eventSource.addEventListener(type, (event) => {
        try { this.dispatchEvent(type, JSON.parse(event.data)); } catch { this.dispatchEvent(type, event.data); }
      });
    });
    return this.eventSource;
  }

  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(callback); return () => this.removeEventListener(type, callback); }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatchEvent(type, data) { this.listeners.get(type)?.forEach((callback) => callback(data)); }
  reconnect() { if (this.reconnectAttempts >= 5) return; this.reconnectAttempts += 1; window.setTimeout(() => this.connect(), 1000 * (2 ** this.reconnectAttempts)); }
  disconnect() { this.eventSource?.close(); this.eventSource = null; }
}

export default new EventService();
