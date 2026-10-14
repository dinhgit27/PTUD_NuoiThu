import axios from 'axios';

const API_BASE = '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach Authorization Bearer Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('officepet_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // --- Auth ---
  register: (data: any) => apiClient.post('/auth/register', data),
  login: (data: any) => apiClient.post('/auth/login', data),
  requestOtp: (email: string) => apiClient.post('/auth/request-otp', { email }),
  verifyOtp: (email: string, otp: string) => apiClient.post('/auth/verify-otp', { email, otp }),
  getMe: () => apiClient.get('/auth/me'),
  updateProfile: (data: any) => apiClient.patch('/auth/profile', data),

  // --- Departments ---
  createDepartment: (name: string) => apiClient.post('/departments', { name }),
  joinDepartment: (inviteCode: string) => apiClient.post('/departments/join', { inviteCode }),
  leaveDepartment: () => apiClient.post('/departments/leave'),

  // --- Pet ---
  getPet: () => apiClient.get('/pet'),
  getPetTypes: () => apiClient.get('/pet/types'),
  selectPet: (data: { typeId: string; name?: string }) => apiClient.post('/pet/select', data),
  feedPet: () => apiClient.post('/pet/feed'),
  strokePet: () => apiClient.post('/pet/pet'),
  setPetState: (state: string) => apiClient.post('/pet/state', { state }),
  setPetMode: (mode: 'STRICT' | 'RELAXED') => apiClient.post('/pet/mode', { mode }),
  updateTransform: (data: any) => apiClient.patch('/pet/transform', data),
  finishSession: (data: any) => apiClient.post('/pet/session/finish', data),
  chatWithAI: (message: string) => apiClient.post('/pet/chat', { message }),
  checkMood: (score: number, note?: string) => apiClient.post('/pet/mood', { score, note }),
  getLeaderboard: () => apiClient.get('/pet/leaderboard'),

  // --- Garden ---
  getGarden: () => apiClient.get('/garden'),
  getGardenBackgrounds: () => apiClient.get('/garden/backgrounds'),
  setGardenBackground: (backgroundId: string) => apiClient.post('/garden/background', { backgroundId }),
  sendGift: (data: { receiverId: string; itemId: string; message?: string }) => apiClient.post('/garden/gift', data),

  // --- Shop ---
  getShop: () => apiClient.get('/shop'),
  buyShopItem: (itemId: string) => apiClient.post('/shop/buy', { itemId }),
  buyShopPet: (petTypeId: string) => apiClient.post('/shop/buy-pet', { petTypeId }),
  buyShopBackground: (backgroundId: string) => apiClient.post('/shop/buy-background', { backgroundId }),
  useShopItem: (userItemId: string) => apiClient.post('/shop/use', { userItemId }),
  equipShopItem: (userItemId: string, equipped: boolean) =>
    apiClient.post('/shop/equip', { userItemId, equipped }),

  // --- Music ---
  getLofiTracks: () => apiClient.get('/music/lofi'),
  searchMusic: (q?: string) => apiClient.get('/music/search', { params: { q } }),
  selectMusic: (track: any) => apiClient.post('/music/select', { track }),

  // --- Admin ---
  generateSprite: (data: { prompt: string; name: string; description?: string; naturalAspectRatio?: number }) =>
    apiClient.post('/admin/sprite/generate', data),
  generateSpriteFromImage: (formData: FormData) =>
    apiClient.post('/admin/sprite/generate-from-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  updateFrameConfig: (id: string, data: any) => apiClient.patch(`/admin/sprite/${id}/config`, data),
  publishSprite: (id: string, isActive: boolean) => apiClient.patch(`/admin/sprite/${id}/publish`, { isActive }),
  getAdminSprites: () => apiClient.get('/admin/sprites'),
  getAdminBackgrounds: () => apiClient.get('/admin/backgrounds'),
  addAdminBackground: (data: any) => apiClient.post('/admin/backgrounds', data),
  uploadAdminBackground: (data: FormData) => apiClient.post('/admin/backgrounds', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteAdminBackground: (id: string) => apiClient.delete(`/admin/backgrounds/${id}`),
  updateAdminBackgroundShop: (id: string, data: { expPrice: number; isActive: boolean }) =>
    apiClient.patch(`/admin/backgrounds/${id}/shop`, data),
  recommendBackground: (id: string, isRecommended: boolean) => apiClient.patch(`/admin/backgrounds/${id}/recommend`, { isRecommended }),
  getSystemStats: () => apiClient.get('/admin/stats'),
  getAdminUsers: () => apiClient.get('/admin/users'),
  updateUserRole: (id: string, role: 'ADMIN' | 'USER') => apiClient.patch(`/admin/users/${id}/role`, { role }),
  toggleUserStatus: (id: string, status: string) => apiClient.patch(`/admin/users/${id}/status`, { status }),
  getAdminShopItems: () => apiClient.get('/admin/shop/items'),
  createAdminShopItem: (data: FormData) => apiClient.post('/admin/shop/items', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateAdminShopItem: (id: string, data: {
    expPrice?: number;
    isAvailable?: boolean;
    itemType?: string;
    equipSlot?: string;
    effect?: string;
  }) => apiClient.patch(`/admin/shop/items/${id}`, data),
  getAdminShopPets: () => apiClient.get('/admin/shop/pets'),
  updateAdminShopPet: (id: string, data: { isShopEnabled: boolean; expPrice: number }) =>
    apiClient.patch(`/admin/shop/pets/${id}`, data),
  getAuditLogs: () => apiClient.get('/admin/audit-logs'),
};
