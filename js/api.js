/**
 * api.js - Servicio para interactuar con la API de Terremotos del USGS
 * y utilidades de formateo y cálculo de distancias.
 */

const USGS_FEEDS = {
  all_hour: {
    id: 'all_hour',
    name: 'Última hora (Todos)',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson'
  },
  all_day: {
    id: 'all_day',
    name: 'Últimas 24 horas (Todos)',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
  },
  '2.5_day': {
    id: '2.5_day',
    name: 'Últimas 24 horas (M2.5+)',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'
  },
  '4.5_day': {
    id: '4.5_day',
    name: 'Últimas 24 horas (M4.5+)',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'
  },
  all_week: {
    id: 'all_week',
    name: 'Últimos 7 días (Todos)',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson'
  },
  '4.5_week': {
    id: '4.5_week',
    name: 'Últimos 7 días (M4.5+)',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson'
  },
  significant_month: {
    id: 'significant_month',
    name: 'Últimos 30 días (Significativos)',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson'
  }
};

const TECTONIC_PLATES_URL = 'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json';

/**
 * Obtiene los datos sísmicos según el feed seleccionado
 */
async function fetchEarthquakeFeed(feedKey = 'all_day') {
  const feed = USGS_FEEDS[feedKey] || USGS_FEEDS.all_day;
  const response = await fetch(feed.url);
  if (!response.ok) {
    throw new Error(`Error ${response.status}: no se pudieron cargar los datos de sismos.`);
  }
  return await response.json();
}

/**
 * Obtiene los límites de las placas tectónicas
 */
async function fetchTectonicPlates() {
  try {
    const response = await fetch(TECTONIC_PLATES_URL);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('No se pudieron cargar las placas tectónicas:', error);
    return null;
  }
}

/**
 * Fórmula de Haversine para calcular distancia en kilómetros entre dos coordenadas
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formatea la distancia según la unidad elegida (km o millas)
 */
function formatDistance(distanceKm, unit = 'km') {
  if (distanceKm === null || distanceKm === undefined) return '';
  if (unit === 'mi') {
    const miles = distanceKm * 0.621371;
    return `${Math.round(miles)} mi`;
  }
  return `${Math.round(distanceKm)} km`;
}

/**
 * Formatea la profundidad según la unidad elegida (km o millas)
 */
function formatDepth(depthKm, unit = 'km') {
  if (depthKm === null || depthKm === undefined) return 'N/A';
  if (unit === 'mi') {
    const miles = depthKm * 0.621371;
    return `${miles.toFixed(1)} mi`;
  }
  return `${depthKm.toFixed(1)} km`;
}

/**
 * Devuelve el color hexadecimal asociado a una magnitud con estética Neón/Vibrante
 */
function getMagnitudeColor(mag) {
  if (mag === null || mag === undefined) return '#94a3b8';
  if (mag < 2.5) return '#00f2fe'; // Cian neón (menor)
  if (mag < 4.0) return '#38ef7d'; // Verde lima neón (leve)
  if (mag < 5.5) return '#f59e0b'; // Ámbar (moderado)
  if (mag < 7.0) return '#ff0844'; // Rojo / Carmesí neón (fuerte)
  return '#d946ef';               // Magenta eléctrico (mayor / catastrófico)
}

/**
 * Devuelve clases CSS para badges según la magnitud
 */
function getMagnitudeBadgeClass(mag) {
  if (mag === null || mag === undefined) return 'bg-slate-700 text-slate-300 border-slate-600';
  if (mag < 2.5) return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
  if (mag < 4.0) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (mag < 5.5) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (mag < 7.0) return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
  return 'bg-fuchsia-500/25 text-fuchsia-300 border-fuchsia-500/50 animate-pulse';
}

/**
 * Clasificación de la magnitud
 */
function getMagnitudeCategory(mag) {
  if (mag === null || mag === undefined) return 'Indeterminado';
  if (mag < 2.5) return 'Micro / Menor';
  if (mag < 4.0) return 'Leve';
  if (mag < 5.5) return 'Moderado';
  if (mag < 7.0) return 'Fuerte';
  if (mag < 8.0) return 'Mayor';
  return 'Catastrófico';
}

/**
 * Clasificación de profundidad
 */
function getDepthCategory(depthKm) {
  if (depthKm === null || depthKm === undefined) return { label: 'Desconocida', color: 'text-slate-400' };
  if (depthKm < 70) return { label: 'Superficial (< 70 km)', color: 'text-amber-400' };
  if (depthKm <= 300) return { label: 'Intermedia (70-300 km)', color: 'text-sky-400' };
  return { label: 'Profunda (> 300 km)', color: 'text-indigo-400' };
}

/**
 * Formatea tiempo relativo en español (ej: "Hace 15 min")
 */
function formatRelativeTime(timestampMs) {
  if (!timestampMs) return 'Desconocido';
  const now = Date.now();
  const diffSec = Math.floor((now - timestampMs) / 1000);

  if (diffSec < 45) return 'Hace segundos';
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return `Hace ${mins} ${mins === 1 ? 'min' : 'mins'}`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `Hace ${hours} ${hours === 1 ? 'h' : 'hrs'}`;
  }
  const days = Math.floor(diffSec / 86400);
  return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

/**
 * Formato de fecha y hora completa local
 */
function formatExactDate(timestampMs) {
  if (!timestampMs) return 'N/A';
  const d = new Date(timestampMs);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Radio del círculo proporcional a la magnitud
 */
function getMarkerRadius(mag) {
  const m = Math.max(0.5, mag || 1);
  return Math.max(4.5, Math.min(30, Math.pow(m, 1.48) * 2.3));
}
