/**
 * map.js - Gestión del mapa interactivo con Leaflet.js
 */

class SismoMap {
  constructor(containerId = 'map-container') {
    this.containerId = containerId;
    this.map = null;
    this.markersLayer = null;
    this.platesLayer = null;
    this.userLocationLayer = null;
    this.markersMap = new Map(); // id -> leaflet marker
    this.currentBaseLayer = null;
    this.baseLayers = {};
    this.onSelectQuake = null;
    this.userLocation = null; // { lat, lon }
  }

  init(onSelectQuakeCallback) {
    this.onSelectQuake = onSelectQuakeCallback;

    // Crear mapa Leaflet
    this.map = L.map(this.containerId, {
      center: [15, 0],
      zoom: 2.5,
      minZoom: 2,
      maxZoom: 18,
      worldCopyJump: true,
      zoomControl: false
    });

    // Control de zoom en la esquina superior derecha
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Definir capas base (100% gratuitas, sin marcas de agua ni API key requerida)
    this.baseLayers = {
      dark: L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 16
        }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 16
        })
      ]),
      light: L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri',
          maxZoom: 16
        }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 16
        })
      ]),
      satellite: L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Earthstar Geographics',
          maxZoom: 18
        }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 18
        })
      ]),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      })
    };

    // Capa base por defecto: Dark (Esri Dark Gray Canvas)
    this.currentBaseLayer = this.baseLayers.dark;
    this.currentBaseLayer.addTo(this.map);

    // Capas
    this.platesLayer = L.layerGroup().addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.userLocationLayer = L.layerGroup().addTo(this.map);
  }

  setBaseLayer(type) {
    if (!this.baseLayers[type]) return;
    if (this.currentBaseLayer) {
      this.map.removeLayer(this.currentBaseLayer);
    }
    this.currentBaseLayer = this.baseLayers[type];
    this.currentBaseLayer.addTo(this.map);
  }

  async loadTectonicPlates() {
    const geojson = await fetchTectonicPlates();
    if (!geojson) return;

    this.platesLayer.clearLayers();
    L.geoJSON(geojson, {
      style: {
        color: '#ff007f', // Neón magenta para coincidir con tema Cyberpunk
        weight: 1.8,
        opacity: 0.7,
        dashArray: '4, 4'
      }
    }).addTo(this.platesLayer);
  }

  toggleTectonicPlates(visible) {
    if (visible) {
      if (!this.map.hasLayer(this.platesLayer)) {
        this.map.addLayer(this.platesLayer);
      }
    } else {
      if (this.map.hasLayer(this.platesLayer)) {
        this.map.removeLayer(this.platesLayer);
      }
    }
  }

  /**
   * Establece y marca la ubicación GPS del usuario en el mapa
   */
  setUserLocation(lat, lon, zoomTo = true) {
    this.userLocation = { lat, lon };
    this.userLocationLayer.clearLayers();

    // Marcador con icono HTML personalizado pulsante
    const userIcon = L.divIcon({
      className: 'user-location-marker-container',
      html: '<div class="user-location-marker" title="Tu ubicación"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    const marker = L.marker([lat, lon], { icon: userIcon }).addTo(this.userLocationLayer);
    marker.bindPopup(`
      <div class="p-2 text-center text-xs font-sans text-slate-100">
        <strong class="text-cyan-400 block font-bold mb-0.5">📍 Tu ubicación actual</strong>
        <span class="text-slate-400 text-[10px]">${lat.toFixed(3)}°, ${lon.toFixed(3)}°</span>
      </div>
    `);

    if (zoomTo) {
      this.map.flyTo([lat, lon], 5, { duration: 1.5 });
    }
  }

  /**
   * Renderiza todos los sismos en el mapa
   */
  renderEarthquakes(features, units = 'km') {
    this.markersLayer.clearLayers();
    this.markersMap.clear();

    features.forEach(feature => {
      const [lon, lat, depth] = feature.geometry.coordinates;
      const props = feature.properties;
      const mag = props.mag ?? 0;
      const color = getMagnitudeColor(mag);
      const radius = getMarkerRadius(mag);

      // Calcular distancia si la ubicación del usuario está disponible
      let distText = '';
      if (this.userLocation) {
        const distKm = calculateDistanceKm(this.userLocation.lat, this.userLocation.lon, lat, lon);
        distText = `📍 a ${formatDistance(distKm, units)} de tu posición`;
      }

      // Marcador de círculo con estilo dinámico
      const marker = L.circleMarker([lat, lon], {
        radius: radius,
        fillColor: color,
        color: mag >= 6.0 ? '#ffffff' : color,
        weight: mag >= 6.0 ? 2.5 : 1,
        opacity: 0.95,
        fillOpacity: 0.8,
        className: mag >= 6.0 ? 'earthquake-marker-pulse' : 'earthquake-marker'
      });

      const depthInfo = getDepthCategory(depth);
      const relativeTime = formatRelativeTime(props.time);
      const exactTime = formatExactDate(props.time);
      const category = getMagnitudeCategory(mag);

      const popupContent = `
        <div class="sismo-popup p-3.5 min-w-[250px] text-slate-100 font-sans">
          <div class="flex items-center justify-between gap-3 mb-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-mono text-black shadow-sm" style="background-color: ${color}">
              M ${mag !== null ? mag.toFixed(1) : 'N/A'}
            </span>
            <span class="text-[11px] font-medium text-slate-400">${relativeTime}</span>
          </div>

          <h4 class="text-sm font-semibold text-white leading-tight mb-1">
            ${props.place || 'Ubicación no especificada'}
          </h4>

          ${distText ? `<div class="text-[11px] text-cyan-400 font-medium mb-2">${distText}</div>` : ''}

          <div class="grid grid-cols-2 gap-2 text-xs border-t border-slate-700/60 pt-2 mb-2.5">
            <div>
              <span class="text-[10px] uppercase text-slate-400 block font-medium">Clasificación</span>
              <span class="font-medium text-slate-200">${category}</span>
            </div>
            <div>
              <span class="text-[10px] uppercase text-slate-400 block font-medium">Profundidad</span>
              <span class="font-medium ${depthInfo.color}">${formatDepth(depth, units)}</span>
            </div>
            <div>
              <span class="text-[10px] uppercase text-slate-400 block font-medium">Coordenadas</span>
              <span class="font-mono text-slate-300 text-[11px]">${lat.toFixed(2)}°, ${lon.toFixed(2)}°</span>
            </div>
            <div>
              <span class="text-[10px] uppercase text-slate-400 block font-medium">Tsunami</span>
              <span class="font-medium ${props.tsunami === 1 ? 'text-rose-400 font-bold' : 'text-slate-400'}">
                ${props.tsunami === 1 ? '⚠️ Alerta generada' : 'Sin alerta'}
              </span>
            </div>
          </div>

          <div class="text-[10px] text-slate-400 mb-2.5">
            🕒 ${exactTime}
          </div>

          <div class="pt-1 flex gap-2">
            <a href="${props.url}" target="_blank" rel="noopener noreferrer"
               class="flex-1 text-center text-xs py-1.5 px-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors shadow">
              Ver reporte oficial USGS &rarr;
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'sismo-custom-leaflet-popup',
        maxWidth: 320
      });

      marker.on('click', () => {
        if (this.onSelectQuake) {
          this.onSelectQuake(feature.id);
        }
      });

      marker.addTo(this.markersLayer);
      this.markersMap.set(feature.id, marker);
    });
  }

  focusEarthquake(feature) {
    if (!feature || !feature.geometry) return;
    const [lon, lat] = feature.geometry.coordinates;
    const marker = this.markersMap.get(feature.id);

    this.map.flyTo([lat, lon], Math.max(this.map.getZoom(), 6.5), {
      duration: 1.2,
      easeLinearity: 0.25
    });

    if (marker) {
      setTimeout(() => {
        marker.openPopup();
      }, 700);
    }
  }

  resetView() {
    this.map.flyTo([15, 0], 2.5, { duration: 1.2 });
  }

  flyToCoordinates(lat, lon, zoom = 5) {
    this.map.flyTo([lat, lon], zoom, { duration: 1.2 });
  }
}

window.SismoMap = SismoMap;
