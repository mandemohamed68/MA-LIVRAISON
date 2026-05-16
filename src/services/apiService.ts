// Service central pour les appels API vers le serveur local (Debian)
// Remplace les appels directs à Firebase SDK

const API_BASE = "/api";

async function request(endpoint: string, method = 'GET', body?: any) {
  const token = localStorage.getItem('auth_token');
  const headers: any = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  auth: {
    login: (credentials: any) => request('/auth/login', 'POST', credentials),
    register: (userData: any) => request('/auth/register', 'POST', userData),
  },
  profile: {
    get: () => request('/profile'),
    update: (data: any) => request('/profile', 'PATCH', data),
  },
  deliveries: {
    list: () => request('/deliveries'),
    create: (data: any) => request('/deliveries', 'POST', data),
    update: (id: string, data: any) => request(`/deliveries/${id}`, 'PATCH', data),
    getMessages: (id: string) => request(`/deliveries/${id}/messages`),
    sendMessage: (id: string, message: any) => request(`/deliveries/${id}/messages`, 'POST', message),
  },
  notifications: {
    list: () => request('/notifications'),
  },
  config: {
    get: (key: string) => request(`/config/${key}`),
    update: (key: string, data: any) => request(`/config/${key}`, 'POST', data),
  },
  admin: {
    users: {
      list: () => request('/admin/users'),
      update: (userId: string, data: any) => request(`/admin/users/${userId}`, 'PATCH', data),
      updateRole: (userId: string, role: string) => request(`/admin/users/${userId}/role`, 'PATCH', { role }),
    }
  }
};
