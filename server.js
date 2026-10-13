require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const app = express();
const port = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
const storePath = process.env.INCIDENT_STORE_PATH
  ? path.resolve(process.env.INCIDENT_STORE_PATH)
  : path.join(__dirname, 'data', 'incidents.json');
const allowedCategories = new Set([
  'harassment',
  'unsafe-area',
  'stalking',
  'online-abuse',
  'other',
]);

class JsonIncidentStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.writeQueue = Promise.resolve();
  }

  async read() {
    try {
      const contents = await fs.readFile(this.filePath, 'utf8');
      const incidents = JSON.parse(contents);
      return Array.isArray(incidents) ? incidents : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  create(incident) {
    const operation = this.writeQueue.catch(() => {}).then(async () => {
      const incidents = await this.read();
      incidents.push(incident);
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
      await fs.writeFile(temporaryPath, `${JSON.stringify(incidents, null, 2)}\n`, { mode: 0o600 });
      await fs.rename(temporaryPath, this.filePath);
      return incident;
    });
    this.writeQueue = operation;
    return operation;
  }
}

const incidentStore = new JsonIncidentStore(storePath);

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      connectSrc: ["'self'", 'https://overpass-api.de', 'https://*.tile.openstreetmap.org'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));
app.use(express.json({ limit: '10kb', strict: true }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const sosLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Please wait before trying the SOS demo again.' },
});

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Please wait before submitting another report.' },
});

function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/api/sos', sosLimiter, (request, response) => {
  const { latitude, longitude } = request.body || {};
  if (!validCoordinates(latitude, longitude)) {
    return response.status(400).json({ error: 'Valid latitude and longitude are required.' });
  }

  return response.json({
    simulated: true,
    sent: false,
    message: 'Demo only. No SMS, email, or emergency-service notification was sent.',
    location: { latitude, longitude },
    channels: ['SMS', 'Email'],
  });
});

app.post('/api/incidents', reportLimiter, async (request, response, next) => {
  const { category, description, latitude, longitude } = request.body || {};
  if (!allowedCategories.has(category)) {
    return response.status(400).json({ error: 'Choose a valid report category.' });
  }
  if (typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 2000) {
    return response.status(400).json({ error: 'Description must be between 10 and 2000 characters.' });
  }

  const hasCoordinates = latitude !== undefined || longitude !== undefined;
  if (hasCoordinates && !validCoordinates(latitude, longitude)) {
    return response.status(400).json({ error: 'Provide both valid location coordinates or leave location blank.' });
  }

  const incident = {
    id: randomUUID(),
    category,
    description: description.trim(),
    createdAt: new Date().toISOString(),
    location: hasCoordinates
      ? {
          latitude: Math.round(latitude * 1000) / 1000,
          longitude: Math.round(longitude * 1000) / 1000,
        }
      : null,
  };

  try {
    await incidentStore.create(incident);
    return response.status(201).json({
      id: incident.id,
      message: 'Your anonymous report was saved on this demo server.',
      locationStored: Boolean(incident.location),
    });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  console.error('Request failed:', error.message);
  return response.status(500).json({ error: 'Something went wrong. Please try again later.' });
});

if (require.main === module) {
  const server = app.listen(port, () => {
    console.log(`Women Safety & Support is running at http://localhost:${server.address().port}`);
  });
}

module.exports = { app, JsonIncidentStore, validCoordinates };