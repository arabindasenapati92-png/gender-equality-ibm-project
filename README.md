# Saheli | Women Safety & Support

Saheli is a learning-project web application aligned with **UN Sustainable Development Goal 5: Gender Equality**. It brings together an OpenStreetMap-based public-service locator, a clearly labeled SOS simulation, anonymous incident reporting, and introductory rights and support resources.

> **Safety notice:** This student demo is not an emergency service. SOS does not send a text, email, or alert to anyone. Reports are not monitored or forwarded to authorities. Do not rely on this application for immediate help, and do not submit identifying or sensitive personal details.

## Features

- **Nearby public services:** Leaflet maps OpenStreetMap tiles and searches OpenStreetMap's Overpass service for mapped police, health, community, and shelter resources within 5 km of a location you choose to share. Listings can be missing, out of date, or unverified.
- **SOS demonstration:** Requests browser geolocation only after a click and posts the coordinates to a demo API. The API explicitly returns `sent: false`; no messaging integration exists.
- **Anonymous reports:** Accepts an incident category, description, and optional location. It does not ask for a name or contact information; saved coordinates are rounded to three decimal places. The local JSON file is not available through a public API.
- **Rights and support learning hub:** Offers general safety and documentation guidance with links to external organizations. It is not legal advice, and service availability varies by location.
- **Responsive and accessible UI:** Keyboard focus styles, a skip link, live status announcements, mobile layouts, and reduced-motion support.

## Project structure

```text
.
├── data/
│   └── incidents.json       # Local demo store; runtime data is git-ignored
├── public/
│   ├── app.js               # Map, geolocation, API requests, and form behavior
│   ├── index.html           # Responsive single-page interface
│   └── style.css            # Layout, responsive styles, and visual theme
├── test/
│   └── server.test.js       # API and data-privacy checks
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js                # Express API and static-file server
```

## Requirements

- Node.js 20 or newer
- npm
- An internet connection for OpenStreetMap tiles, Overpass searches, Leaflet, and Google Fonts
- HTTPS when deployed: browser geolocation is restricted to secure contexts (localhost is allowed during development)

## Run locally

```bash
npm install
cp .env.example .env
npm start
```

Open [http://localhost:3000](http://localhost:3000). To restart the server automatically during development, use `npm run dev`. The server creates the incident-store directory and JSON file on the first report if they do not exist.

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `INCIDENT_STORE_PATH` | `./data/incidents.json` | Local JSON incident store |

## API

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Basic health check |
| `POST` | `/api/sos` | Validates coordinates and returns a non-delivery simulation |
| `POST` | `/api/incidents` | Validates and stores an anonymous incident report |

Both write endpoints have in-memory rate limits. Reports are stored on the server's local filesystem and are not backed up, encrypted, or suitable for real-world sensitive data. For a real service, obtain appropriate safety, legal, and privacy review before launch; add access controls, retention/deletion policies, secure database storage, operational support, and a real, tested emergency-notification provider with informed consent. Never represent a demo request as a real emergency alert.

## Tests

```bash
npm test
```

The API tests use Node's built-in test runner and a temporary JSON store.

## Deployment notes

- Deploy behind HTTPS and set a production `PORT` and a private writable `INCIDENT_STORE_PATH`.
- The JSON store is a classroom mock, not a multi-instance database. Use an appropriately secured managed database before scaling or collecting real reports.
- Review the Content Security Policy in `server.js` if you change map, font, or tile providers.
- Overpass and OpenStreetMap are third-party services with their own availability, usage policies, and privacy implications. Location is sent to Overpass only when a visitor asks to search nearby; review provider terms before deployment.
- Do not commit `.env`, runtime reports, credentials, or real personal data.

## IBM certificate submission checklist

1. Add your name, course cohort, and repository URL to your submission materials; do not add private user data.
2. Include screenshots of the desktop and mobile interface, plus a short walkthrough of the map, SOS simulation, and report form.
3. Describe the architecture: Express API, static frontend, Leaflet/OpenStreetMap locator, and JSON mock store.
4. Include test output from `npm test` and setup instructions from this README.
5. State clearly that SOS delivery is simulated and that reports are not monitored. Do not deploy or present this classroom build as a live emergency-response service.

## Learning alignment

The project supports awareness, access to public information, and discussion of safer and more inclusive communities in the spirit of **UN SDG 5**. It is an educational prototype, not a substitute for local professional or emergency support.