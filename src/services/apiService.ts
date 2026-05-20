// Service central pour les appels API vers le serveur local (Debian)
// Remplace les appels directs à Firebase SDK

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
console.log('API_BASE being used:', API_BASE);

async function request(endpoint: string, method = 'GET', body?: any, retryCount = 0): Promise<any> {
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

  if (response.status === 429 && retryCount < 3) {
    const delay = Math.pow(2, retryCount) * 1000;
    console.warn(`API Rate limit hit. Retrying in ${delay}ms... (Attempt ${retryCount + 1})`);
    await new Promise(r => setTimeout(r, delay));
    return request(endpoint, method, body, retryCount + 1);
  }

  if (!response.ok) {
    const text = await response.text();
    console.error(`API Request failed: ${endpoint} ${method} - Status: ${response.status}`, text);
    let err;
    try {
      err = JSON.parse(text);
    } catch (e) {
      err = { error: `Unknown error (Status ${response.status})` };
    }
    throw new Error(err.details || err.error || `Request failed with status ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return null;
}

export const api = {
  users: {
    get: (id: string) => request(`/users/${id}`),
  },
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
    get: (id: string) => request(`/deliveries/${id}`),
    create: (data: any) => request('/deliveries', 'POST', data),
    update: (id: string, data: any) => request(`/deliveries/${id}`, 'PATCH', data),
    delete: (id: string) => request(`/deliveries/${id}`, 'DELETE'),
    messages: {
      list: (id: string) => request(`/deliveries/${id}/messages`),
      send: (id: string, data: any) => request(`/deliveries/${id}/messages`, 'POST', data),
    },
    bids: {
      list: (id: string) => request(`/deliveries/${id}/bids`),
      place: (id: string, data: any) => request(`/deliveries/${id}/bids`, 'POST', data),
    },
    tracking: {
      update: (id: string, data: any) => request(`/deliveries/${id}/tracking`, 'POST', data),
    }
  },
  notifications: {
    list: () => request('/notifications'),
    create: (data: any) => request('/notifications', 'POST', data),
    markAsRead: (id: string) => request(`/notifications/${id}/read`, 'PATCH'),
    delete: (id: string) => request(`/notifications/${id}`, 'DELETE'),
  },
  drivers: {
    status: () => request('/drivers/status'),
  },
  config: {
    get: (key: string) => request(`/config/${key}`),
    update: (key: string, data: any) => request(`/config/${key}`, 'POST', data),
  },
  health: () => request('/health'),
  admin: {
    users: {
      list: () => request('/admin/users'),
      create: (data: any) => request('/admin/users', 'POST', data),
      update: (userId: string, data: any) => request(`/admin/users/${userId}`, 'PATCH', data),
      delete: (userId: string) => request(`/admin/users/${userId}`, 'DELETE'),
      updateRole: (userId: string, role: string) => request(`/admin/users/${userId}/role`, 'PATCH', { role }),
    },
    reset: () => request('/admin/reset', 'POST'),
    seed: () => request('/admin/seed', 'POST'),
  },
  announcements: {
    list: () => request('/announcements'),
    create: (data: any) => request('/announcements', 'POST', data),
    delete: (id: string) => request(`/announcements/${id}`, 'DELETE'),
  },
  sectors: {
    list: () => request('/sectors'),
    create: (data: any) => request('/sectors', 'POST', data),
    delete: (id: string) => request(`/sectors/${id}`, 'DELETE'),
  }
};
