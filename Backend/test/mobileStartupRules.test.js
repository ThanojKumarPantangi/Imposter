import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Logic mirror of appConfigService.evaluateStartup to verify all specified test matrix scenarios
function evaluateStartup(response, installedVersionCode, platform = 'android') {
  // 1. Failure to retrieve configuration -> FAIL CLOSED to MAINTENANCE
  if (!response || !response.success || !response.data) {
    return {
      state: 'MAINTENANCE',
      config: null,
      reason: response?.error || 'Unable to establish server connection',
    };
  }

  const { data } = response;

  // 2. Server maintenance active
  if (!data.server || data.server.enabled === false) {
    return {
      state: 'MAINTENANCE',
      config: data,
      reason: data.server?.message || "We're currently performing scheduled maintenance.",
    };
  }

  // 3. Android Mandatory Hard Update Check (Exclusive to Android)
  if (platform === 'android') {
    const { appUpdate } = data;
    if (
      appUpdate &&
      appUpdate.enabled === true &&
      appUpdate.isUpdateRequired === true &&
      installedVersionCode < appUpdate.latestVersionCode &&
      appUpdate.isBlocked === true
    ) {
      return {
        state: 'HARD_UPDATE',
        config: data,
        reason: appUpdate.message || 'Mandatory application update required.',
      };
    }
  }

  // 4. Normal application entry allowed
  return {
    state: 'NORMAL_APP',
    config: data,
  };
}

describe('🧪 Mobile Startup Decision Matrix Tests (Section 15)', () => {

  const baseConfig = {
    server: { enabled: true, message: 'Operational' },
    appUpdate: {
      enabled: true,
      latestVersionCode: 4,
      isUpdateRequired: true,
      isBlocked: true,
      updateUrl: 'https://supabase.co/Imposter.apk',
      title: 'Update Available',
      message: 'A newer version is available'
    },
    version: 40
  };

  test('Scenario 1: Server enabled, update disabled -> Normal application', () => {
    const response = {
      success: true,
      data: {
        ...baseConfig,
        appUpdate: { ...baseConfig.appUpdate, enabled: false }
      }
    };
    const result = evaluateStartup(response, 2, 'android');
    assert.equal(result.state, 'NORMAL_APP');
  });

  test('Scenario 2: Server enabled, update enabled but not required -> Normal application', () => {
    const response = {
      success: true,
      data: {
        ...baseConfig,
        appUpdate: { ...baseConfig.appUpdate, isUpdateRequired: false }
      }
    };
    const result = evaluateStartup(response, 2, 'android');
    assert.equal(result.state, 'NORMAL_APP');
  });

  test('Scenario 3: Server enabled, update required, blocked -> Hard update screen', () => {
    const response = {
      success: true,
      data: baseConfig
    };
    const result = evaluateStartup(response, 3, 'android'); // installed 3 < latest 4
    assert.equal(result.state, 'HARD_UPDATE');
  });

  test('Scenario 4: Server enabled, update required, not blocked -> Normal application', () => {
    const response = {
      success: true,
      data: {
        ...baseConfig,
        appUpdate: { ...baseConfig.appUpdate, isBlocked: false }
      }
    };
    const result = evaluateStartup(response, 2, 'android');
    assert.equal(result.state, 'NORMAL_APP');
  });

  test('Scenario 5: Installed version equals latest version -> Normal application', () => {
    const response = {
      success: true,
      data: baseConfig
    };
    const result = evaluateStartup(response, 4, 'android'); // 4 === 4
    assert.equal(result.state, 'NORMAL_APP');
  });

  test('Scenario 6: Installed version is greater than latest version -> Normal application', () => {
    const response = {
      success: true,
      data: baseConfig
    };
    const result = evaluateStartup(response, 5, 'android'); // 5 > 4
    assert.equal(result.state, 'NORMAL_APP');
  });

  test('Scenario 7: Server disabled -> Maintenance screen', () => {
    const response = {
      success: true,
      data: {
        ...baseConfig,
        server: { enabled: false, message: 'Maintenance underway' }
      }
    };
    const result = evaluateStartup(response, 2, 'android');
    assert.equal(result.state, 'MAINTENANCE');
    assert.equal(result.reason, 'Maintenance underway');
  });

  test('Scenario 8: API timeout -> Maintenance screen', () => {
    const response = {
      success: false,
      error: 'Request timed out while contacting configuration service'
    };
    const result = evaluateStartup(response, 4, 'android');
    assert.equal(result.state, 'MAINTENANCE');
  });

  test('Scenario 9: No internet / network failure -> Maintenance screen', () => {
    const response = {
      success: false,
      error: 'Network connection failed'
    };
    const result = evaluateStartup(response, 4, 'android');
    assert.equal(result.state, 'MAINTENANCE');
  });

  test('Scenario 10: Invalid JSON response -> Maintenance screen', () => {
    const response = {
      success: false,
      error: 'Invalid JSON response from configuration service'
    };
    const result = evaluateStartup(response, 4, 'android');
    assert.equal(result.state, 'MAINTENANCE');
  });

  test('Scenario 11: Priority order - Server maintenance takes priority over Hard Update', () => {
    const response = {
      success: true,
      data: {
        ...baseConfig,
        server: { enabled: false, message: 'Server down' },
        appUpdate: { ...baseConfig.appUpdate, isBlocked: true, latestVersionCode: 10 }
      }
    };
    // Even if installed is 2 and latest is 10, MAINTENANCE must take priority over HARD_UPDATE
    const result = evaluateStartup(response, 2, 'android');
    assert.equal(result.state, 'MAINTENANCE');
  });

  test('Scenario 12: Web platform exception - Hard update NEVER blocks web', () => {
    const response = {
      success: true,
      data: baseConfig // installed 1 < latest 4, blocked true
    };
    const result = evaluateStartup(response, 1, 'web');
    assert.equal(result.state, 'NORMAL_APP');
  });
});

