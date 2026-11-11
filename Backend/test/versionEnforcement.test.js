import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import { setCachedConfigForTesting } from '../src/controllers/appConfigController.js';
import { invalidateVersionEnforcementCache } from '../src/middlewares/appVersionEnforcementMiddleware.js';

describe('🛡️ Android Mobile Version Enforcement Middleware Test Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app).listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    setCachedConfigForTesting({
      server: { enabled: true },
      appUpdate: { enabled: false, latestVersionCode: 1 }
    });
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // Helper to configure appUpdate settings for tests
  const configureUpdate = (opts) => {
    setCachedConfigForTesting({
      server: { enabled: true, message: '' },
      appUpdate: {
        enabled: opts.enabled ?? true,
        latestVersionCode: opts.latestVersionCode ?? 5,
        updateUrl: opts.updateUrl || 'https://imposter.game/download/app-release.apk',
        title: opts.title || 'Update Available',
        message: opts.message || 'A newer version of Imposter is available.'
      }
    });
  };

  test('1. Android v4 with latestVersionCode 5 returns HTTP 426 Upgrade Required with correct JSON', async () => {
    configureUpdate({ enabled: true, latestVersionCode: 5 });

    const res = await fetch(`${baseUrl}/api/v1/auth/profile?deviceId=test_device`, {
      headers: {
        'X-App-Platform': 'android',
        'X-App-Version-Code': '4'
      }
    });

    assert.equal(res.status, 426);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'APP_UPDATE_REQUIRED');
    assert.equal(body.message, 'A newer version of Imposter is required to continue.');
    assert.equal(body.data.latestVersionCode, 5);
    assert.equal(body.data.installedVersionCode, 4);
    assert.equal(body.data.updateUrl, 'https://imposter.game/download/app-release.apk');
  });

  test('2. Android v5 with latestVersionCode 5 is allowed (equal version)', async () => {
    configureUpdate({ enabled: true, latestVersionCode: 5 });

    // Using an endpoint like /rooms/TEST/join which doesn't wait on mongoose
    const res = await fetch(`${baseUrl}/api/v1/rooms/TEST/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Platform': 'android',
        'X-App-Version-Code': '5'
      },
      body: JSON.stringify({ player: { id: 'p1', username: 'Tester' } })
    });

    // Request is allowed past version enforcement (reaches roomController: returns room or error, NOT 426)
    assert.notEqual(res.status, 426);
  });

  test('3. Android v6 with latestVersionCode 5 is allowed (greater version)', async () => {
    configureUpdate({ enabled: true, latestVersionCode: 5 });

    const res = await fetch(`${baseUrl}/api/v1/rooms/TEST/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Platform': 'android',
        'X-App-Version-Code': '6'
      },
      body: JSON.stringify({ player: { id: 'p1', username: 'Tester' } })
    });

    assert.notEqual(res.status, 426);
  });

  test('4. Update enforcement disabled allows older Android client', async () => {
    configureUpdate({ enabled: false, latestVersionCode: 5 });

    const res = await fetch(`${baseUrl}/api/v1/rooms/TEST/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Platform': 'android',
        'X-App-Version-Code': '2'
      },
      body: JSON.stringify({ player: { id: 'p1', username: 'Tester' } })
    });

    assert.notEqual(res.status, 426);
  });

  test('5. Web request with Origin/Referer is completely excluded from enforcement', async () => {
    configureUpdate({ enabled: true, latestVersionCode: 5 });

    const res = await fetch(`${baseUrl}/api/v1/rooms/TEST/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify({ player: { id: 'p1', username: 'Tester' } })
    });

    assert.notEqual(res.status, 426);
  });

  test('6. Admin application request is completely excluded from enforcement', async () => {
    configureUpdate({ enabled: true, latestVersionCode: 10 });

    const res = await fetch(`${baseUrl}/api/v1/admin/categories`, {
      headers: {
        'X-App-Platform': 'admin'
      }
    });

    // Admin endpoint should hit requireAdmin (returns 401 unauthenticated), NOT 426
    assert.equal(res.status, 401);
  });

  test('7. Web request without any version headers is allowed without blocking', async () => {
    configureUpdate({ enabled: true, latestVersionCode: 10 });

    const res = await fetch(`${baseUrl}/api/v1/rooms/TEST/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ player: { id: 'p1', username: 'Tester' } })
    });
    assert.notEqual(res.status, 426);
  });

  test('8. Android request missing X-App-Version-Code header is rejected appropriately', async () => {
    configureUpdate({ enabled: true, latestVersionCode: 5 });

    const res = await fetch(`${baseUrl}/api/v1/rooms/TEST/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Platform': 'android'
      },
      body: JSON.stringify({ player: { id: 'p1', username: 'Tester' } })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'MISSING_VERSION_METADATA');
  });

  test('9. Android request with invalid X-App-Version-Code header is rejected appropriately', async () => {
    configureUpdate({ enabled: true, latestVersionCode: 5 });

    const res = await fetch(`${baseUrl}/api/v1/rooms/TEST/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Platform': 'android',
        'X-App-Version-Code': 'not-a-number'
      },
      body: JSON.stringify({ player: { id: 'p1', username: 'Tester' } })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'INVALID_VERSION_METADATA');
  });

  test('10. Public app configuration endpoint is exempt from version enforcement', async () => {
    configureUpdate({ enabled: true, latestVersionCode: 10 });

    const res = await fetch(`${baseUrl}/api/v1/app/config?versionCode=2`, {
      headers: {
        'X-App-Platform': 'android',
        'X-App-Version-Code': '2'
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.appUpdate.latestVersionCode, 10);
  });

  test('11. Server maintenance takes priority and preserves existing 503 maintenance response', async () => {
    setCachedConfigForTesting({
      server: { enabled: false, message: 'Maintenance underway.' },
      appUpdate: { enabled: true, latestVersionCode: 10 }
    });

    const res = await fetch(`${baseUrl}/api/v1/rooms/TEST/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Platform': 'android',
        'X-App-Version-Code': '2' // Outdated version
      },
      body: JSON.stringify({ player: { username: 'Tester' } })
    });

    // Maintenance 503 must take precedence over 426
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.maintenance, true);
    assert.equal(body.error, 'Maintenance underway.');

    // Reset server status
    setCachedConfigForTesting({ server: { enabled: true, message: '' } });
  });

  test('12. Invalidation and cache refresh updates immediately on admin changes', async () => {
    configureUpdate({ enabled: true, latestVersionCode: 5 });

    // Client at version 5 is initially permitted
    let res = await fetch(`${baseUrl}/api/v1/rooms/TEST/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Platform': 'android',
        'X-App-Version-Code': '5'
      },
      body: JSON.stringify({ player: { id: 'p1', username: 'Tester' } })
    });
    assert.notEqual(res.status, 426);

    // Admin bumps latestVersionCode to 6
    configureUpdate({ enabled: true, latestVersionCode: 6 });

    // Same client at version 5 is now immediately blocked with HTTP 426
    res = await fetch(`${baseUrl}/api/v1/rooms/TEST/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Platform': 'android',
        'X-App-Version-Code': '5'
      },
      body: JSON.stringify({ player: { id: 'p1', username: 'Tester' } })
    });
    assert.equal(res.status, 426);
    const body = await res.json();
    assert.equal(body.data.latestVersionCode, 6);
  });
});
