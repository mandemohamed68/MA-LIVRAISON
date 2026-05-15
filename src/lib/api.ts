/**
 * API SERVICE - BRIDGE FOR SQL BACKEND
 * -----------------------------------
 * This replaces direct Firestore calls with Express API calls.
 */

const API_BASE = ''; // Empty string means Same-Origin (relative to the current domain)

export const api = {
  // --- USERS ---
  async getUsers() {
    const res = await fetch(`${API_BASE}/api/users`);
    return res.json();
  },

  async getUser(userId: string) {
    const res = await fetch(`${API_BASE}/api/users/${userId}`);
    if (!res.ok) throw new Error('User not found');
    return res.json();
  },

  async updateUser(userId: string, updates: any) {
    const res = await fetch(`${API_BASE}/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.json();
  },

  async syncUser(userData: any) {
    const res = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return res.json();
  },

  // --- DELIVERIES ---
  async getDeliveries(filters: { clientId?: string; driverId?: string; status?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.clientId) params.append('clientId', filters.clientId);
    if (filters.driverId) params.append('driverId', filters.driverId);
    if (filters.status) params.append('status', filters.status);

    const res = await fetch(`${API_BASE}/api/deliveries?${params.toString()}`);
    return res.json();
  },

  async getDelivery(id: string) {
    const res = await fetch(`${API_BASE}/api/deliveries/${id}`);
    return res.json();
  },

  async createDelivery(data: any) {
    const res = await fetch(`${API_BASE}/api/deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateDelivery(id: string, updates: any) {
    const res = await fetch(`${API_BASE}/api/deliveries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.json();
  },

  async deleteDelivery(id: string) {
    const res = await fetch(`${API_BASE}/api/deliveries/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // --- CHAT ---
  async getMessages(deliveryId: string) {
    const res = await fetch(`${API_BASE}/api/deliveries/${deliveryId}/messages`);
    return res.json();
  },

  async sendMessage(deliveryId: string, messageData: { senderId: string; text: string; isAdmin?: boolean }) {
    const res = await fetch(`${API_BASE}/api/deliveries/${deliveryId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });
    return res.json();
  },

  // --- BIDS ---
  async getBids(deliveryId: string) {
    const res = await fetch(`${API_BASE}/api/deliveries/${deliveryId}/bids`);
    return res.json();
  },

  async placeBid(deliveryId: string, bidData: { driverId: string; driverName: string; price: number; timeEstimateMins: number }) {
    const res = await fetch(`${API_BASE}/api/deliveries/${deliveryId}/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bidData)
    });
    return res.json();
  },

  // --- NOTIFICATIONS ---
  async getNotifications(userId: string) {
    const res = await fetch(`${API_BASE}/api/notifications/${userId}`);
    return res.json();
  },

  async markNotificationRead(id: number) {
    const res = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: 'PATCH'
    });
    return res.json();
  },

  // --- CONFIG ---
  async getInitialConfig() {
    const res = await fetch(`${API_BASE}/api/settings/app_config`);
    return res.json();
  },

  async updateConfig(updates: any) {
    const res = await fetch(`${API_BASE}/api/settings/app_config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.json();
  }
};
