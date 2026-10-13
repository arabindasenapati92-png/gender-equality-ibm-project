const mapElement = document.querySelector('#map');
const placesList = document.querySelector('#places-list');
const placesCount = document.querySelector('#places-count');
const sosButton = document.querySelector('#sos-button');
const sosStatus = document.querySelector('#sos-status');
const locateButton = document.querySelector('#locate-button');
const reportForm = document.querySelector('#report-form');
const reportStatus = document.querySelector('#report-status');
const reportLocationButton = document.querySelector('#report-location-button');
const reportLocationStatus = document.querySelector('#report-location-status');

let map;
let locationMarker;
let reportLocation = null;
let placeMarkers = [];

function initializeMap() {
  if (!mapElement || !window.L) return;
  map = L.map(mapElement, { scrollWheelZoom: false }).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new Error(error.code === 1
        ? 'Location permission was not granted.'
        : 'Could not get your location. Please try again.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

function setLocationMarker(location) {
  if (!map) return;
  if (locationMarker) locationMarker.remove();
  locationMarker = L.circleMarker([location.latitude, location.longitude], {
    radius: 8,
    color: '#fff',
    weight: 3,
    fillColor: '#e34c45',
    fillOpacity: 1,
  }).addTo(map).bindPopup('Your shared location');
  map.setView([location.latitude, location.longitude], 14);
}

function renderEmptyPlaces(message) {
  placesList.replaceChildren();
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  const icon = document.createElement('span');
  icon.className = 'empty-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '⌖';
  const text = document.createElement('p');
  text.textContent = message;
  empty.append(icon, text);
  placesList.append(empty);
}

function resourceType(tags) {
  if (tags.amenity === 'police') return 'Police';
  if (tags.amenity === 'hospital' || tags.amenity === 'clinic' || tags.amenity === 'doctors') return 'Health service';
  if (tags.amenity === 'community_centre') return 'Community centre';
  return 'Support service';
}

function clearPlaceMarkers() {
  placeMarkers.forEach((marker) => marker.remove());
  placeMarkers = [];
}

function renderPlaces(elements, origin) {
  clearPlaceMarkers();
  placesList.replaceChildren();
  const resources = elements
    .map((element) => {
      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      const tags = element.tags || {};
      const name = tags.name || tags.operator || resourceType(tags);
      const distance = map.distance([origin.latitude, origin.longitude], [latitude, longitude]);
      return { latitude, longitude, name, type: resourceType(tags), distance };
    })
    .filter(Boolean)
    .sort((first, second) => first.distance - second.distance)
    .slice(0, 25);

  if (resources.length === 0) {
    placesCount.textContent = 'No listings found';
    renderEmptyPlaces('No mapped places were found nearby. Try zooming out or contact a local support service directly.');
    return;
  }

  placesCount.textContent = `${resources.length} nearby listings`;
  resources.forEach((resource) => {
    const marker = L.circleMarker([resource.latitude, resource.longitude], {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: resource.type === 'Police' ? '#315d51' : '#d9903d',
      fillOpacity: 1,
    }).addTo(map).bindPopup(`${resource.name} · ${resource.type}`);
    placeMarkers.push(marker);

    const item = document.createElement('article');
    item.className = 'place-item';
    const detail = document.createElement('div');
    detail.className = 'place-detail';
    const name = document.createElement('h4');
    name.textContent = resource.name;
    const type = document.createElement('p');
    type.textContent = `${resource.type} · ${(resource.distance / 1000).toFixed(1)} km`;
    detail.append(name, type);
    const directions = document.createElement('a');
    directions.className = 'direction-link';
    directions.href = `https://www.openstreetmap.org/directions?to=${resource.latitude}%2C${resource.longitude}`;
    directions.target = '_blank';
    directions.rel = 'noreferrer';
    directions.setAttribute('aria-label', `Get directions to ${resource.name}`);
    directions.textContent = '↗';
    item.append(detail, directions);
    item.addEventListener('mouseenter', () => marker.openPopup());
    item.addEventListener('focusin', () => marker.openPopup());
    placesList.append(item);
  });
}

async function findNearbyPlaces(location) {
  placesCount.textContent = 'Searching nearby…';
  renderEmptyPlaces('Looking for public listings in OpenStreetMap…');
  const query = `[out:json][timeout:20];(nwr(around:5000,${location.latitude},${location.longitude})[amenity~"^(police|hospital|clinic|doctors|community_centre)$"];nwr(around:5000,${location.latitude},${location.longitude})[social_facility~"^(shelter|womens_shelter)$"];);out center tags;`;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ data: query }),
    });
    if (!response.ok) throw new Error('The map service is temporarily unavailable.');
    const data = await response.json();
    renderPlaces(data.elements || [], location);
  } catch (_error) {
    placesCount.textContent = 'Search unavailable';
    renderEmptyPlaces('The public map service could not be reached. Please try again later.');
  }
}

async function locateAndSearch(button) {
  button.disabled = true;
  const originalText = button.innerHTML;
  button.textContent = 'Finding you…';
  try {
    const location = await getCurrentPosition();
    setLocationMarker(location);
    await findNearbyPlaces(location);
  } catch (error) {
    placesCount.textContent = 'Location unavailable';
    renderEmptyPlaces(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

async function runSosDemo() {
  sosButton.disabled = true;
  sosStatus.textContent = 'Requesting your location…';
  try {
    const location = await getCurrentPosition();
    sosStatus.textContent = 'Showing what a demo alert would do…';
    const response = await fetch('/api/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(location),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The demo could not process this request.');
    sosStatus.textContent = `${result.message} Your coordinates are visible only in this demo response.`;
  } catch (error) {
    sosStatus.textContent = error.message;
  } finally {
    sosButton.disabled = false;
  }
}

async function addReportLocation() {
  reportLocationButton.disabled = true;
  reportLocationStatus.textContent = 'Requesting your location…';
  try {
    reportLocation = await getCurrentPosition();
    reportLocationStatus.textContent = 'Location added. It will be rounded before storage.';
    reportLocationButton.textContent = 'Remove location';
    reportLocationButton.dataset.attached = 'true';
  } catch (error) {
    reportLocationStatus.textContent = error.message;
  } finally {
    reportLocationButton.disabled = false;
  }
}

async function submitReport(event) {
  event.preventDefault();
  const submitButton = reportForm.querySelector('[type="submit"]');
  const formData = new FormData(reportForm);
  const payload = {
    category: formData.get('category'),
    description: formData.get('description'),
    ...(reportLocation || {}),
  };
  submitButton.disabled = true;
  reportStatus.textContent = 'Submitting your report…';
  try {
    const response = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Your report could not be saved.');
    reportStatus.textContent = `${result.message} Report reference: ${result.id.slice(0, 8)}.`;
    reportForm.reset();
    reportLocation = null;
    reportLocationStatus.textContent = 'No location attached.';
    reportLocationButton.textContent = 'Add location';
    delete reportLocationButton.dataset.attached;
  } catch (error) {
    reportStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
}

initializeMap();
locateButton.addEventListener('click', () => locateAndSearch(locateButton));
sosButton.addEventListener('click', runSosDemo);
reportLocationButton.addEventListener('click', () => {
  if (reportLocationButton.dataset.attached === 'true') {
    reportLocation = null;
    reportLocationStatus.textContent = 'No location attached.';
    reportLocationButton.textContent = 'Add location';
    delete reportLocationButton.dataset.attached;
    return;
  }
  addReportLocation();
});
reportForm.addEventListener('submit', submitReport);