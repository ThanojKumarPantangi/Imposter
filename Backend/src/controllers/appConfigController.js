import mongoose from 'mongoose';
import AppConfig from '../models/AppConfig.js';
import AuditLog from '../models/AuditLog.js';

// In-memory cache for fast access and maintenance checks
let cachedConfig = null;

export async function getActiveConfigFromDB() {
  try {
    if (mongoose.connection.readyState !== 1) {
      return cachedConfig;
    }

    let config = await AppConfig.findOne({ key: 'GLOBAL_APP_CONFIG' }).lean();
    if (!config) {
      config = await AppConfig.create({ key: 'GLOBAL_APP_CONFIG' });
      config = config.toObject();
    }

    cachedConfig = {
      server: {
        enabled: config.server?.enabled ?? true,
        message: config.server?.message || ''
      },
      appUpdate: {
        enabled: config.appUpdate?.enabled ?? false,
        latestVersionCode: config.appUpdate?.latestVersionCode ?? 1,
        isUpdateRequired: config.appUpdate?.isUpdateRequired ?? false,
        isBlocked: config.appUpdate?.isBlocked ?? false,
        updateUrl: config.appUpdate?.updateUrl || '',
        title: config.appUpdate?.title || '',
        message: config.appUpdate?.message || ''
      },
      version: config.version ?? 1
    };

    return cachedConfig;
  } catch (err) {
    console.warn('[AppConfig] Error fetching config from DB:', err.message);
    return cachedConfig;
  }
}

// For testing purposes
export function setCachedConfigForTesting(testConfig) {
  cachedConfig = {
    server: { enabled: true, message: '' },
    appUpdate: {
      enabled: false,
      latestVersionCode: 1,
      isUpdateRequired: false,
      isBlocked: false,
      updateUrl: '',
      title: '',
      message: ''
    },
    version: 1,
    ...cachedConfig,
    ...testConfig,
    server: { ...(cachedConfig?.server || {}), ...(testConfig.server || {}) },
    appUpdate: { ...(cachedConfig?.appUpdate || {}), ...(testConfig.appUpdate || {}) }
  };
  return cachedConfig;
}

// Public API: GET /api/v1/app/config?versionCode=4
export async function getPublicAppConfig(req, res) {
  try {
    const rawVersionCode = req.query.versionCode;
    let parsedVersionCode = null;
    
    if (rawVersionCode !== undefined && rawVersionCode !== null && rawVersionCode !== '') {
      parsedVersionCode = parseInt(rawVersionCode, 10);
      if (isNaN(parsedVersionCode)) {
        parsedVersionCode = null;
      }
    }

    const config = await getActiveConfigFromDB();

    // Default configuration if none found in DB
    if (!config) {
      return res.status(200).json({
        success: true,
        message: 'App configuration retrieved successfully',
        data: {
          server: { enabled: true, message: '' },
          appUpdate: {
            enabled: false,
            latestVersionCode: 1,
            isUpdateRequired: false,
            isBlocked: false,
            updateUrl: '',
            title: '',
            message: ''
          },
          version: 1
        }
      });
    }

    const appUpdateEnabled = Boolean(config.appUpdate?.enabled ?? false);
    const latestVersionCode = Number(config.appUpdate?.latestVersionCode ?? 1);

    // Dynamically calculate if the user needs an update
    let requiresUpdate = false;
    if (appUpdateEnabled && parsedVersionCode !== null && parsedVersionCode < latestVersionCode) {
      requiresUpdate = true;
    }

    return res.status(200).json({
      success: true,
      message: 'App configuration retrieved successfully',
      data: {
        server: {
          enabled: Boolean(config.server?.enabled ?? true),
          message: String(config.server?.message || '')
        },
        appUpdate: {
          enabled: appUpdateEnabled,
          latestVersionCode: latestVersionCode,
          isUpdateRequired: requiresUpdate, // Auto-computed based on client's version
          isBlocked: requiresUpdate,        // Automatically blocks if an update is required
          updateUrl: String(config.appUpdate?.updateUrl || ''),
          title: String(config.appUpdate?.title || ''),
          message: String(config.appUpdate?.message || '')
        },
        version: Number(config.version ?? 1)
      }
    });
  } catch (error) {
    console.error('[AppConfig] Error in getPublicAppConfig:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve application configuration'
    });
  }
}

// Admin API: GET /api/v1/admin/app-config
export async function getAdminAppConfig(req, res) {
  try {
    const config = await getActiveConfigFromDB();
    return res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch administrative app config'
    });
  }
}

// Admin API: PUT /api/v1/admin/server-status
export async function updateServerStatus(req, res) {
  try {
    const { server } = req.body;

    const current = (await getActiveConfigFromDB()) || {
      server: { enabled: true, message: '' },
      appUpdate: {
        enabled: false,
        latestVersionCode: 1,
        updateUrl: '',
        title: '',
        message: ''
      },
      version: 0
    };

    const updatedData = {
      ...current, // Keep existing appUpdate data intact
      server: {
        enabled: server?.enabled !== undefined ? Boolean(server.enabled) : current.server.enabled,
        message: server?.message !== undefined ? String(server.message) : current.server.message
      },
      version: (current.version || 0) + 1
    };

    const doc = await AppConfig.findOneAndUpdate(
      { key: 'GLOBAL_APP_CONFIG' },
      { $set: updatedData },
      { new: true, upsert: true }
    );

    cachedConfig = {
      server: doc.server,
      appUpdate: doc.appUpdate,
      version: doc.version
    };

    // Log to AuditLog
    await AuditLog.create({
      action: 'UPDATE_SERVER_STATUS',
      adminEmail: req.user?.email || 'admin@imposter.game',
      target: 'AppConfig',
      details: { server: updatedData.server, newVersion: updatedData.version },
      ip: req.ip || req.headers['x-forwarded-for'] || null
    }).catch(e => console.warn('[AuditLog] Failed to record server status change:', e.message));

    return res.status(200).json({
      success: true,
      message: 'Server status updated successfully',
      data: cachedConfig
    });
  } catch (error) {
    console.error('[AppConfig] Error updating server status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update server status'
    });
  }
}

// Admin API: PUT /api/v1/admin/app-update
export async function updateAppUpdateStatus(req, res) {
  try {
    const { appUpdate } = req.body;

    const current = (await getActiveConfigFromDB()) || {
      server: { enabled: true, message: '' },
      appUpdate: {
        enabled: false,
        latestVersionCode: 1,
        updateUrl: '',
        title: '',
        message: ''
      },
      version: 0 
    };

    const updatedData = {
      ...current, // Keep existing server data intact
      appUpdate: {
        enabled: appUpdate?.enabled !== undefined ? Boolean(appUpdate.enabled) : current.appUpdate.enabled,
        latestVersionCode: appUpdate?.latestVersionCode !== undefined ? Number(appUpdate.latestVersionCode) : current.appUpdate.latestVersionCode,
        updateUrl: appUpdate?.updateUrl !== undefined ? String(appUpdate.updateUrl) : current.appUpdate.updateUrl,
        title: appUpdate?.title !== undefined ? String(appUpdate.title) : current.appUpdate.title,
        message: appUpdate?.message !== undefined ? String(appUpdate.message) : current.appUpdate.message
      },
      version: (current.version || 0) + 1 
    };

    // Validate updateUrl if provided
    if (updatedData.appUpdate.updateUrl && !updatedData.appUpdate.updateUrl.startsWith('https://') && !updatedData.appUpdate.updateUrl.startsWith('http://')) {
      return res.status(400).json({
        success: false,
        error: 'Update URL must be a valid HTTP/HTTPS URL'
      });
    }

    const doc = await AppConfig.findOneAndUpdate(
      { key: 'GLOBAL_APP_CONFIG' },
      { $set: updatedData },
      { new: true, upsert: true }
    );

    cachedConfig = {
      server: doc.server,
      appUpdate: doc.appUpdate,
      version: doc.version
    };

    // Log to AuditLog
    await AuditLog.create({
      action: 'UPDATE_APP_UPDATE_STATUS',
      adminEmail: req.user?.email || 'admin@imposter.game',
      target: 'AppConfig',
      details: { appUpdate: updatedData.appUpdate, newVersion: updatedData.version },
      ip: req.ip || req.headers['x-forwarded-for'] || null
    }).catch(e => console.warn('[AuditLog] Failed to record app update status change:', e.message));

    return res.status(200).json({
      success: true,
      message: 'App update settings updated successfully',
      data: cachedConfig
    });
  } catch (error) {
    console.error('[AppConfig] Error updating app update status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update app update settings'
    });
  }
}

// Middleware: server maintenance check with admin and public bypass
export function checkServerMaintenance(req, res, next) {
  // Always allow admin routes, admin auth, health check, and public app config
  const path = req.path || '';
  const originalUrl = req.originalUrl || '';

  const isBypassed =
    originalUrl.includes('/api/v1/admin') ||
    originalUrl.includes('/api/v1/auth/admin') ||
    originalUrl.includes('/api/v1/app/config') ||
    originalUrl.includes('/health') ||
    path === '/' ||
    req.method === 'OPTIONS';

  if (isBypassed) {
    return next();
  }

  // If server is disabled, block player traffic
  if (cachedConfig?.server && cachedConfig.server.enabled === false) {
    return res.status(503).json({
      success: false,
      maintenance: true,
      error: cachedConfig.server.message || "We're currently performing scheduled maintenance. We'll be back shortly. Stay tuned!"
    });
  }

  next();
}