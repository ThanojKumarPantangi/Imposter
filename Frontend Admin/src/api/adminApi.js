import { apiRequest } from './client';

export const adminApi = {
  getStats: () => apiRequest('/admin/stats'),
  getCategories: () => apiRequest('/admin/categories'),
  getCategory: (id) => apiRequest(`/admin/categories/${encodeURIComponent(id)}`),
  createCategory: (data) => apiRequest('/admin/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id, data) => apiRequest(`/admin/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id) => apiRequest(`/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addWord: (categoryId, wordData) => apiRequest(`/admin/categories/${encodeURIComponent(categoryId)}/words`, { method: 'POST', body: JSON.stringify(wordData) }),
  updateWordHint: (categoryId, wordText, data) => apiRequest(`/admin/categories/${encodeURIComponent(categoryId)}/words/${encodeURIComponent(wordText)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWord: (categoryId, wordText) => apiRequest(`/admin/categories/${encodeURIComponent(categoryId)}/words/${encodeURIComponent(wordText)}`, { method: 'DELETE' }),
  getHistory: (page = 1, limit = 20) => apiRequest(`/admin/history?page=${page}&limit=${limit}`),
  getAuditLogs: () => apiRequest('/admin/audit-logs'),
  triggerSeed: () => apiRequest('/admin/seed', { method: 'POST' }),
  getAppConfig: () => apiRequest('/admin/app-config'),
  updateServerStatus: (data) => apiRequest('/admin/server-status', { method: 'PUT', body: JSON.stringify(data) }),
  updateAppUpdateStatus: (data) => apiRequest('/admin/app-update', { method: 'PUT', body: JSON.stringify(data) })
};

