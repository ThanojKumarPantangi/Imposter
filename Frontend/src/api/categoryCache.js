import { apiRequest } from './client';

const CACHE_STORAGE_KEY = 'imposter_categories_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Default fallback categories if backend is completely unreachable
const FALLBACK_CATEGORIES = [
  { slug: 'fruits', name: 'Fruits', group: 'FOOD_DRINK', description: 'Fresh fruits, berries, and tropical produce' },
  { slug: 'vegetables', name: 'Vegetables', group: 'FOOD_DRINK', description: 'Garden harvest, leafy greens, and root veg' },
  { slug: 'world-cuisines', name: 'World Cuisines', group: 'FOOD_DRINK', description: 'Global specialties, street food, and dishes', featured: true },
  { slug: 'animals', name: 'Animals & Pets', group: 'ANIMALS_NATURE', description: 'Wild mammals, marine life, and domestic companions' },
  { slug: 'movies', name: 'Movies & Cinema', group: 'ARTS_ENTERTAINMENT', description: 'Blockbusters, iconic directors, and film genres', featured: true },
  { slug: 'gaming', name: 'Video Games', group: 'ARTS_ENTERTAINMENT', description: 'Retro classics, esports titles, and game lore' },
  { slug: 'science', name: 'Science & Cosmos', group: 'ACADEMIC', description: 'Space exploration, elements, physics, and biology' }
];

let memoryCache = null;
let inFlightPromise = null;

/**
 * Read cached categories from localStorage
 */
function readPersistentCache() {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
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

/**
 * Save categories to localStorage
 */
function writePersistentCache(categories) {
  try {
    if (Array.isArray(categories) && categories.length > 0) {
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: categories
      }));
    }
  } catch (err) {
    console.warn('Could not write persistent category cache:', err);
  }
}

/**
 * Fetch available categories once and cache results permanently.
 * Multiple simultaneous calls share the same in-flight Promise.
 */
export async function getCachedCategories(forceRefresh = false) {
  // 1. Return from memory cache if available and not forced
  if (!forceRefresh && memoryCache && memoryCache.length > 0) {
    return memoryCache;
  }

  // 2. Return from localStorage cache if available and not forced
  if (!forceRefresh) {
    const persistent = readPersistentCache();
    if (persistent && persistent.length > 0) {
      memoryCache = persistent;
      return memoryCache;
    }
  }

  // 3. Reuse in-flight request if already pending
  if (inFlightPromise) {
    return inFlightPromise;
  }

  // 4. Make single network request and populate cache
  inFlightPromise = (async () => {
    try {
      const res = await apiRequest('/rooms/categories');
      if (res && res.success && Array.isArray(res.categories) && res.categories.length > 0) {
        memoryCache = res.categories;
        writePersistentCache(res.categories);
        return memoryCache;
      }
      throw new Error('Invalid categories response');
    } catch (err) {
      console.warn('Failed to load categories from API, using fallback data:', err.message);
      // If we had an older cache, return it
      const fallback = memoryCache || readPersistentCache() || FALLBACK_CATEGORIES;
      memoryCache = fallback;
      return fallback;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

/**
 * Invalidate cache to force next request to fetch from server
 */
export function invalidateCategoryCache() {
  memoryCache = null;
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch (e) {}
}

/**
 * Explicitly prefetch categories once during app initialization
 */
export function prefetchCategories() {
  return getCachedCategories(false).catch(() => {});
}

export default {
  getCachedCategories,
  invalidateCategoryCache,
  prefetchCategories
};
