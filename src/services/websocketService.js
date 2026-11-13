import api from './api';

class WebSocketService {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
  }

  connect() {
    this.disconnect();
    this.eventSource = new EventSource(`${api.defaults.baseURL}/events/logs`, { withCredentials: true });
    this.eventSource.onopen = () => { this.reconnectAttempts = 0; this.emit('connected', { status: 'connected' }); };
    this.eventSource.onmessage = (event) => {
      try { this.emit('message', JSON.parse(event.data)); } catch { this.emit('message', event.data); }
    };
    this.eventSource.onerror = () => { this.emit('error', { status: 'disconnected' }); };
  }

  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(callback); return () => this.listeners.get(type)?.delete(callback); }
  emit(type, value) { this.listeners.get(type)?.forEach((callback) => callback(value)); }
  getStatus() { return this.eventSource?.readyState === EventSource.OPEN ? 'Connected' : 'Disconnected'; }
  disconnect() { this.eventSource?.close(); this.eventSource = null; }
}

export default new WebSocketService();
