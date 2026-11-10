import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import { setCachedConfigForTesting } from '../src/controllers/appConfigController.js';

describe('🚀 App Startup Configuration & Maintenance System Tests', () => {
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
    setCachedConfigForTesting({ server: { enabled: true } });
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Public config API returns valid structure', async () => {
    const res = await fetch(`${baseUrl}/api/v1/app/config?versionCode=4`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(typeof body.data, 'object');

    // Server config fields
    assert.equal(typeof body.data.server.enabled, 'boolean');
    assert.equal(typeof body.data.server.message, 'string');

    // App Update fields
    assert.equal(typeof body.data.appUpdate.enabled, 'boolean');
    assert.equal(typeof body.data.appUpdate.latestVersionCode, 'number');
    assert.equal(typeof body.data.appUpdate.isUpdateRequired, 'boolean');
    assert.equal(typeof body.data.appUpdate.isBlocked, 'boolean');
    assert.equal(typeof body.data.appUpdate.updateUrl, 'string');
    assert.equal(typeof body.data.appUpdate.title, 'string');
    assert.equal(typeof body.data.appUpdate.message, 'string');

    // Version
    assert.equal(typeof body.data.version, 'number');
  });

  test('2. Public config API handles missing or non-numeric versionCode gracefully', async () => {
    const res = await fetch(`${baseUrl}/api/v1/app/config?versionCode=invalid`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(typeof body.data.appUpdate.latestVersionCode, 'number');
  });

  test('3. Admin endpoints are protected by authentication', async () => {
    const getRes = await fetch(`${baseUrl}/api/v1/admin/app-config`);
    assert.equal(getRes.status, 401);

    const putRes = await fetch(`${baseUrl}/api/v1/admin/app-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server: { enabled: false } })
    });
    assert.equal(putRes.status, 401);
  });

  test('4. Server maintenance blocks non-admin traffic with 503', async () => {
    setCachedConfigForTesting({
      server: {
        enabled: false,
        message: 'Scheduled maintenance in progress.'
      }
    });

    // Player endpoint should be blocked
    const playerRes = await fetch(`${baseUrl}/api/v1/rooms/TEST/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: { username: 'Tester' } })
    });
    assert.equal(playerRes.status, 503);
    const body = await playerRes.json();
    assert.equal(body.success, false);
    assert.equal(body.maintenance, true);
    assert.equal(body.error, 'Scheduled maintenance in progress.');
  });

  test('5. Server maintenance bypasses Admin APIs and Public Config API', async () => {
    setCachedConfigForTesting({
      server: {
        enabled: false,
        message: 'Scheduled maintenance in progress.'
      }
    });

    // Public config API must still work so mobile knows it is maintenance
    const configRes = await fetch(`${baseUrl}/api/v1/app/config?versionCode=4`);
    assert.equal(configRes.status, 200);
    const configBody = await configRes.json();
    assert.equal(configBody.data.server.enabled, false);

    // Admin API must NOT return 503 maintenance; it returns 401 (auth check reached, not blocked by 503)
    const adminRes = await fetch(`${baseUrl}/api/v1/admin/app-config`);
    assert.equal(adminRes.status, 401);
    const adminBody = await adminRes.json();
    assert.notEqual(adminBody.maintenance, true);

    // Reset server enabled
    setCachedConfigForTesting({ server: { enabled: true } });
  });
});
