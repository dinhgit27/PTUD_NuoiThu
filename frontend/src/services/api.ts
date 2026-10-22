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
  requestRegisterOtp: (email: string) => apiClient.post('/auth/request-register-otp', { email }),
  login: (data: any) => apiClient.post('/auth/login', data),
  requestOtp: (email: string) => apiClient.post('/auth/request-otp', { email }),
  verifyOtp: (email: string, otp: string) => apiClient.post('/auth/verify-otp', { email, otp }),
  requestPasswordReset: (email: string) => apiClient.post('/auth/forgot-password', { email }),
  resetPasswordWithOtp: (data: { email: string; otp: string; password: string }) => apiClient.post('/auth/reset-password-otp', data),
  resetPassword: (token: string, password: string) => apiClient.post('/auth/reset-password', { token, password }),
  getMe: () => apiClient.get('/auth/me'),
  updateProfile: (data: any) => apiClient.patch('/auth/profile', data),

  // --- Departments ---
  createDepartment: (name: string) => apiClient.post('/departments', { name }),
  joinDepartment: (inviteCode: string) => apiClient.post('/departments/join', { inviteCode }),
  leaveDepartment: () => apiClient.post('/departments/leave'),
  getDepartmentMembers: () => apiClient.get('/departments/members'),
  getDepartmentMessages: () => apiClient.get('/departments/messages'),
  sendDepartmentMessage: (content: string) => apiClient.post('/departments/messages', { content }),

  // --- Friends & Direct Messaging ---
  getFriends: () => apiClient.get('/friends'),
  searchUsers: (q: string) => apiClient.get('/friends/search', { params: { q } }),
  addFriend: (friendId: string) => apiClient.post('/friends/request', { friendId }),
  removeFriend: (friendId: string) => apiClient.delete(`/friends/${friendId}`),
  getDirectMessages: (friendId: string) => apiClient.get(`/friends/${friendId}/messages`),
  sendDirectMessage: (friendId: string, content: string) => apiClient.post(`/friends/${friendId}/messages`, { content }),

  // --- Pet ---
  getPet: () => apiClient.get('/pet'),
  getPetTypes: () => apiClient.get('/pet/types'),
  selectPet: (data: { typeId: string; name?: string }) => apiClient.post('/pet/select', data),
  renamePet: (name: string) => apiClient.patch('/pet/name', { name }),
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

  // --- Quests ---
  getQuests: () => apiClient.get('/quests'),
  claimQuest: (id: string) => apiClient.post(`/quests/${id}/claim`),
  recordQuestAction: (actionType: string, count: number = 1) => apiClient.post('/quests/action', { actionType, count }),

  // --- Admin ---
  generateSprite: (data: { prompt: string; name: string; description?: string; naturalAspectRatio?: number }) =>
    apiClient.post('/admin/sprite/generate', data),
  importSpriteSheet: (formData: FormData) =>
    apiClient.post('/admin/sprite/import-sheet', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  createPetFromActions: (formData: FormData) =>
    apiClient.post('/admin/sprite/create-by-actions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  updateFrameConfig: (id: string, data: any) => apiClient.patch(`/admin/sprite/${id}/config`, data),
  updatePetTypeDetails: (id: string, data: { name: string; description: string }) =>
    apiClient.patch(`/admin/sprite/${id}/details`, data),
  publishSprite: (id: string, isActive: boolean) => apiClient.patch(`/admin/sprite/${id}/publish`, { isActive }),
  getAdminSprites: () => apiClient.get('/admin/sprites'),
  getAdminBackgrounds: () => apiClient.get('/admin/backgrounds'),
  addAdminBackground: (data: {
    name: string;
    imageUrl: string;
    description?: string;
    isRecommended?: boolean;
    animationFrames?: number;
    animationFps?: number;
    animationColumns?: number;
    animationRows?: number;
  }) => apiClient.post('/admin/backgrounds', data),
  uploadAdminBackground: (data: FormData) => apiClient.post('/admin/backgrounds', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteAdminBackground: (id: string) => apiClient.delete(`/admin/backgrounds/${id}`),
  updateAdminBackgroundAnimation: (id: string, data: {
    animationFrames: number;
    animationFps: number;
    animationColumns?: number;
    animationRows?: number;
  }) =>
    apiClient.patch(`/admin/backgrounds/${id}/animation`, data),
  updateAdminBackgroundShop: (id: string, data: { expPrice: number; isActive: boolean }) =>
    apiClient.patch(`/admin/backgrounds/${id}/shop`, data),
  recommendBackground: (id: string, isRecommended: boolean) => apiClient.patch(`/admin/backgrounds/${id}/recommend`, { isRecommended }),
  getSystemStats: () => apiClient.get('/admin/stats'),
  getAdminAnalytics: () => apiClient.get('/admin/analytics'),
  getAdminUsers: (params: { page?: number; pageSize?: number; search?: string; role?: string; status?: string } = {}) =>
    apiClient.get('/admin/users', { params }),
  getUserViolations: (id: string) => apiClient.get(`/admin/users/${id}/violations`),
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
    effectValue?: number;
    compatiblePetIds?: string[] | null;
  }) => apiClient.patch(`/admin/shop/items/${id}`, data),
  uploadItemPetSheet: (id: string, formData: FormData) =>
    apiClient.post(`/admin/shop/items/${id}/sheet`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  deleteItemPetSheet: (id: string, petTypeId: string) =>
    apiClient.delete(`/admin/shop/items/${id}/sheet/${petTypeId}`),
  getAdminShopPets: () => apiClient.get('/admin/shop/pets'),
  updateAdminShopPet: (id: string, data: { isShopEnabled: boolean; expPrice: number }) =>
    apiClient.patch(`/admin/shop/pets/${id}`, data),
  getAuditLogs: () => apiClient.get('/admin/audit-logs'),

  // --- Admin Quests ---
  getAdminQuests: () => apiClient.get('/admin/quests'),
  createAdminQuest: (data: {
    title: string;
    description: string;
    category: string;
    actionType: string;
    targetCount: number;
    rewardExp: number;
    rewardItemId?: string | null;
    isActive?: boolean;
  }) => apiClient.post('/admin/quests', data),
  updateAdminQuest: (id: string, data: {
    title?: string;
    description?: string;
    category?: string;
    actionType?: string;
    targetCount?: number;
    rewardExp?: number;
    rewardItemId?: string | null;
    isActive?: boolean;
  }) => apiClient.put(`/admin/quests/${id}`, data),
  toggleAdminQuest: (id: string) => apiClient.patch(`/admin/quests/${id}/toggle`),
  deleteAdminQuest: (id: string) => apiClient.delete(`/admin/quests/${id}`),
};
