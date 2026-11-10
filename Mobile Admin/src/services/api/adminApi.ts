import { apiRequest } from './client';
import { Category, MatchHistoryEntry, AuditLogEntry } from '../../types';

export const adminApi = {
  getStats: (): Promise<{ success: boolean; stats: any }> => apiRequest('/admin/stats'),

  getCategories: (): Promise<{ success: boolean; categories: Category[] }> =>
    apiRequest('/admin/categories'),

  getCategory: (id: string): Promise<{ success: boolean; category: Category }> =>
    apiRequest(`/admin/categories/${encodeURIComponent(id)}`),

  createCategory: (data: Partial<Category>): Promise<{ success: boolean; category: Category }> =>
    apiRequest('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCategory: (
    id: string,
    data: Partial<Category>
  ): Promise<{ success: boolean; category: Category }> =>
    apiRequest(`/admin/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCategory: (id: string): Promise<{ success: boolean }> =>
    apiRequest(`/admin/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  addWord: (
    categoryId: string,
    wordData: { word: string; hint: string; difficulty?: string }
  ): Promise<{ success: boolean; category: Category }> =>
    apiRequest(`/admin/categories/${encodeURIComponent(categoryId)}/words`, {
      method: 'POST',
      body: JSON.stringify(wordData),
    }),

  deleteWord: (
    categoryId: string,
    wordText: string
  ): Promise<{ success: boolean; category: Category }> =>
    apiRequest(
      `/admin/categories/${encodeURIComponent(categoryId)}/words/${encodeURIComponent(wordText)}`,
      { method: 'DELETE' }
    ),

  getHistory: (
    page = 1,
    limit = 20
  ): Promise<{ success: boolean; history: MatchHistoryEntry[] }> =>
    apiRequest(`/admin/history?page=${page}&limit=${limit}`),

  getAuditLogs: (): Promise<{ success: boolean; logs: AuditLogEntry[] }> =>
    apiRequest('/admin/audit-logs'),

  triggerSeed: (): Promise<{ success: boolean; message: string }> =>
    apiRequest('/admin/seed', { method: 'POST' }),
};

