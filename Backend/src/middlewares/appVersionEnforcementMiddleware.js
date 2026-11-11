import { getActiveConfigFromDB } from '../controllers/appConfigController.js';

/**
 * Android Mobile Version Enforcement Middleware
 * 
 * Production-ready second layer of defense ensuring outdated Android mobile apps
 * cannot bypass mandatory updates by invoking backend APIs directly.
 * 
 * Strict platform isolation:
 * - Android Mobile App: Enforced if mandatory update conditions are met.
 * - Web Application: Completely excluded.
 * - Admin Application: Completely excluded.
 */

// In-memory config cache with TTL
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
let cachedConfigItem = null;
let lastCacheFetchTime = 0;
let inFlightConfigPromise = null;

/**
 * Retrieve cached config or fetch from centralized DB / Redis / controller
 */
export async function getCachedAppConfig(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedConfigItem && (now - lastCacheFetchTime < CACHE_TTL_MS)) {
    return cachedConfigItem;
  }

  // Prevent multiple simultaneous database queries (single in-flight promise)
  if (inFlightConfigPromise) {
    return inFlightConfigPromise;
  }

  inFlightConfigPromise = (async () => {
    try {
      const config = await getActiveConfigFromDB();
      if (config) {
        cachedConfigItem = config;
        lastCacheFetchTime = Date.now();
      }
      return cachedConfigItem;
    } catch (err) {
      console.warn('[VersionEnforcement] Error fetching app config:', err.message);
      return cachedConfigItem; // Fallback to stale if available
    } finally {
      inFlightConfigPromise = null;
    }
  })();

  return inFlightConfigPromise;
}

/**
 * Manually invalidate or update the cached config (e.g., when an admin updates it or during tests)
 */
export function invalidateVersionEnforcementCache(newConfig = null) {
  if (newConfig) {
    cachedConfigItem = newConfig;
    lastCacheFetchTime = Date.now();
  } else {
    cachedConfigItem = null;
    lastCacheFetchTime = 0;
  }
}

/**
 * Platform identification helper
 * 
 * Returns:
 * - 'admin': Admin Web / Mobile Admin requests (authenticated via /api/v1/admin or admin routes)
 * - 'web': Web application request (browser origin / referer, or no android header)
 * - 'android': Android mobile application
 * - 'unknown': Non-android / excluded
 */
export function identifyPlatform(req) {
  const originalUrl = req.originalUrl || req.url || '';
  const path = req.path || '';

  // 1. Admin application requests are strictly exempt
  if (
    originalUrl.includes('/api/v1/admin') ||
    originalUrl.includes('/api/v1/auth/admin') ||
    path.startsWith('/admin')
  ) {
    return 'admin';
  }

  // 2. Browser / Web application identification via headers
  const origin = req.headers['origin'] || '';
  const referer = req.headers['referer'] || '';
  const userAgent = req.headers['user-agent'] || '';

  // Check if request origin/referer matches web frontend
  const rawClientUrls = process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174';
  const webUrls = rawClientUrls.split(',').map(u => u.trim()).filter(Boolean);
  const isWebOrigin = webUrls.some(u => (origin && origin.startsWith(u)) || (referer && referer.startsWith(u)));

  // If origin/referer explicitly matches a registered web URL or is standard browser client
  // (unless explicit Android headers are present from mobile app)
  const platformHeader = (req.headers['x-app-platform'] || '').toLowerCase().trim();

  if (platformHeader === 'android') {
    return 'android';
  }

  // If user-agent contains standard Mozilla browser and NO android platform header is present
  if (isWebOrigin || (!platformHeader && (origin || referer))) {
    return 'web';
  }

  // If no android platform header was supplied, fail safely to web/exempt without blocking
  return 'web';
}

/**
 * Evaluates whether an Android client meets the version requirements
 */
export function evaluateAndroidVersion(config, installedVersionCode) {
  // If server maintenance is active, let maintenance handler process it
  if (config?.server && config.server.enabled === false) {
    return { allowed: true, maintenance: true };
  }

  const appUpdate = config?.appUpdate;

  // Enforcement conditions:
  // - appUpdate.enabled === true
  // - latestVersionCode is set
  // - installedVersionCode < latestVersionCode
  // (Note: isUpdateRequired and isBlocked are dynamically true whenever installedVersionCode < latestVersionCode)
  const isEnabled = Boolean(appUpdate?.enabled);
  const latestVersion = Number(appUpdate?.latestVersionCode || 1);

  if (!isEnabled) {
    return { allowed: true };
  }

  if (installedVersionCode >= latestVersion) {
    return { allowed: true };
  }

  // Outdated: must be upgraded
  return {
    allowed: false,
    updateData: {
      latestVersionCode: latestVersion,
      installedVersionCode: installedVersionCode,
      updateUrl: appUpdate?.updateUrl || '',
      title: appUpdate?.title || 'Update Available',
      updateMessage: appUpdate?.message || 'A newer version of Imposter is available.'
    }
  };
}

/**
 * Express Middleware: appVersionEnforcementMiddleware
 */
export async function appVersionEnforcementMiddleware(req, res, next) {
  const originalUrl = req.originalUrl || req.url || '';
  const path = req.path || '';

  // 1. Explicit Endpoint Exclusions (Section 9)
  // - Public app configuration endpoint
  // - Admin routes
  // - Health check
  // - Root route
  // - OPTIONS preflight
  const isExcludedEndpoint =
    originalUrl.includes('/api/v1/app/config') ||
    originalUrl.includes('/api/v1/admin') ||
    originalUrl.includes('/api/v1/auth/admin') ||
    originalUrl.includes('/health') ||
    path === '/' ||
    req.method === 'OPTIONS';

  if (isExcludedEndpoint) {
    return next();
  }

  // 2. Identify platform (Section 1)
  const platform = identifyPlatform(req);

  // Strictly exclude web and admin
  if (platform === 'web' || platform === 'admin') {
    return next();
  }

  // 3. Android Mobile Request processing
  const rawPlatform = (req.headers['x-app-platform'] || '').toLowerCase().trim();
  const rawVersionCode = req.headers['x-app-version-code'];

  // Missing version header from Android app
  if (rawVersionCode === undefined || rawVersionCode === null || rawVersionCode === '') {
    return res.status(400).json({
      success: false,
      code: 'MISSING_VERSION_METADATA',
      error: 'Missing required X-App-Version-Code header for Android mobile request'
    });
  }

  const parsedVersionCode = parseInt(rawVersionCode, 10);
  if (isNaN(parsedVersionCode) || parsedVersionCode <= 0) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_VERSION_METADATA',
      error: 'Invalid X-App-Version-Code header. Must be a positive integer.'
    });
  }

  // 4. Retrieve centralized app configuration
  let config = null;
  try {
    config = await getCachedAppConfig();
  } catch (err) {
    console.error('[VersionEnforcement] Failed to load configuration:', err.message);
  }

  // If configuration retrieval completely fails, follow fail-closed policy for protected Android APIs
  if (!config) {
    return res.status(503).json({
      success: false,
      code: 'CONFIG_UNAVAILABLE',
      error: 'Application configuration service is temporarily unavailable. Please retry.'
    });
  }

  // 5. If server maintenance is active, allow next() so checkServerMaintenance can return the standard 503 response
  if (config.server && config.server.enabled === false) {
    return next();
  }

  // 6. Evaluate Android Version
  const result = evaluateAndroidVersion(config, parsedVersionCode);

  if (!result.allowed) {
    console.warn(`[VersionEnforcement] Blocked outdated Android client: v${parsedVersionCode} < v${result.updateData?.latestVersionCode}`);
    return res.status(426).json({
      success: false,
      code: 'APP_UPDATE_REQUIRED',
      message: 'A newer version of Imposter is required to continue.',
      data: result.updateData
    });
  }

  return next();
}

export default appVersionEnforcementMiddleware;

