import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './client';
import { Category } from '../../types';
import { STORAGE_KEYS } from '../../config/constants';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const FALLBACK_CATEGORIES: Category[] = [
  { slug: 'fruits', name: 'Fruits', group: 'FOOD_DRINK', description: 'Fresh fruits, berries, and tropical produce' },
  { slug: 'vegetables', name: 'Vegetables', group: 'FOOD_DRINK', description: 'Garden harvest, leafy greens, and root veg' },
  { slug: 'world-cuisines', name: 'World Cuisines', group: 'FOOD_DRINK', description: 'Global specialties, street food, and dishes', featured: true },
  { slug: 'animals', name: 'Animals & Pets', group: 'ANIMALS_NATURE', description: 'Wild mammals, marine life, and domestic companions' },
  { slug: 'movies', name: 'Movies & Cinema', group: 'ARTS_ENTERTAINMENT', description: 'Blockbusters, iconic directors, and film genres', featured: true },
  { slug: 'gaming', name: 'Video Games', group: 'ARTS_ENTERTAINMENT', description: 'Retro classics, esports titles, and game lore' },
  { slug: 'science', name: 'Science & Cosmos', group: 'ACADEMIC', description: 'Space exploration, elements, physics, and biology' },
];

let memoryCache: Category[] | null = null;
let inFlightPromise: Promise<Category[]> | null = null;

async function readPersistentCache(): Promise<Category[] | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
      const age = Date.now() - (parsed.timestamp || 0);
      if (age < CACHE_TTL_MS) {
        return parsed.data;
      }
    }
  } catch (err) {
    console.warn('Could not read persistent category cache:', err);
  }
  return null;
}

async function writePersistentCache(categories: Category[]): Promise<void> {
  try {
    if (Array.isArray(categories) && categories.length > 0) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CATEGORIES_CACHE,
        JSON.stringify({
          timestamp: Date.now(),
          data: categories,
        })
      );
    }
  } catch (err) {
    console.warn('Could not write persistent category cache:', err);
  }
}

export async function getCachedCategories(forceRefresh = false): Promise<Category[]> {
  if (!forceRefresh && memoryCache && memoryCache.length > 0) {
    return memoryCache;
  }

  if (!forceRefresh) {
    const persistent = await readPersistentCache();
    if (persistent && persistent.length > 0) {
      memoryCache = persistent;
      return memoryCache;
    }
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const res = await apiRequest<{ success: boolean; categories: Category[] }>('/rooms/categories');
      if (res && res.success && Array.isArray(res.categories) && res.categories.length > 0) {
        memoryCache = res.categories;
        writePersistentCache(res.categories);
        return memoryCache;
      }
      throw new Error('Invalid categories response');
    } catch (err: any) {
      console.warn('Failed to load categories from API, using fallback data:', err.message);
      const fallback = memoryCache || (await readPersistentCache()) || FALLBACK_CATEGORIES;
      memoryCache = fallback;
      return fallback;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

export function invalidateCategoryCache(): void {
  memoryCache = null;
  AsyncStorage.removeItem(STORAGE_KEYS.CATEGORIES_CACHE).catch(() => {});
}

