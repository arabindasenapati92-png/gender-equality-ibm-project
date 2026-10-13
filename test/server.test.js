const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

let server;
let baseUrl;
let temporaryDirectory;
let incidentFile;

before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'saheli-test-'));
  incidentFile = path.join(temporaryDirectory, 'incidents.json');
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '0', INCIDENT_STORE_PATH: incidentFile },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Server did not start in time.')), 5000);
    server.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        baseUrl = `http://127.0.0.1:${match[1]}`;
        resolve();
      }
    });
    server.once('error', reject);
    server.once('exit', (code) => reject(new Error(`Server exited with code ${code}.`)));
  });
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
  if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test('SOS validates coordinates and clearly reports that no notification was sent', async () => {
  const invalidResponse = await fetch(`${baseUrl}/api/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: 120, longitude: 10 }),
  });
  assert.equal(invalidResponse.status, 400);

  const response = await fetch(`${baseUrl}/api/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: 12.345678, longitude: 67.890123 }),
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.simulated, true);
  assert.equal(result.sent, false);
  assert.match(result.message, /No SMS, email, or emergency-service notification was sent/);
});

test('anonymous incident reports validate input and round saved coordinates', async () => {
  const invalidResponse = await fetch(`${baseUrl}/api/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'harassment', description: 'Too short', latitude: 1, longitude: 2 }),
  });
  assert.equal(invalidResponse.status, 400);

  const response = await fetch(`${baseUrl}/api/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'unsafe-area',
      description: 'The path near the station has no lights after dark.',
      latitude: 12.345678,
      longitude: 67.890123,
      email: 'must-not-be-stored@example.com',
    }),
  });
  const result = await response.json();
  const stored = JSON.parse(await fs.readFile(incidentFile, 'utf8'));
  assert.equal(response.status, 201);
  assert.equal(result.locationStored, true);
  assert.deepEqual(stored[0].location, { latitude: 12.346, longitude: 67.89 });
  assert.equal(Object.hasOwn(stored[0], 'email'), false);
});