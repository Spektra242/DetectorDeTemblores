/**
 * app.js - Controlador principal con Personalización, GPS, Audio Sintetizado y Notificaciones
 */

class SismoApp {
  constructor() {
    this.sismoMap = null;
    this.audioCtx = null;
    this.knownQuakeIds = new Set();
    this.userCoords = null; // { lat, lon }

    // Configuración persistente (guardada en localStorage)
    this.config = this.loadConfig();

    // Estado en ejecución
    this.state = {
      feedKey: 'all_day',
      minMag: 0,
      searchQuery: '',
      distanceFilterKm: 0, // 0 = sin límite
      sortBy: 'time_desc',
      countdown: this.config.autoRefreshSecs,
      timerId: null,
      isLoading: false,
      selectedId: null,
      rawFeatures: [],
      filteredFeatures: []
    };

    // Coordenadas para botones de región rápida
    this.regions = {
      global: { center: [15, 0], zoom: 2.5 },
      sudamerica: { center: [-30, -70], zoom: 4.5 },
      mexico: { center: [20, -100], zoom: 5 },
      japon: { center: [36, 138], zoom: 4.5 },
      usa_west: { center: [37, -120], zoom: 5 }
    };
  }

  loadConfig() {
    const defaults = {
      theme: 'cyberpunk',          // 'cyberpunk', 'graphite', 'tactical', 'light'
      autoLocate: true,            // Activar GPS al inicio
      distanceFilterKm: 0,         // 0 = todos
      soundEnabled: true,
      soundType: 'alarm',          // 'alarm', 'chime', 'synth'
      soundVolume: 0.5,
      soundMinMag: 5.0,
      pushNotifications: false,
      autoRefreshSecs: 60,
      unitDepth: 'km',             // 'km' o 'mi'
      tectonicPlates: true,
      baseMap: 'dark'
    };

    try {
      const saved = localStorage.getItem('sismotracker_config');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch (e) {
      return defaults;
    }
  }

  saveConfig() {
    try {
      localStorage.setItem('sismotracker_config', JSON.stringify(this.config));
    } catch (e) {
      console.warn('No se pudo guardar la configuración en localStorage', e);
    }
  }

  async init() {
    // 1. Aplicar tema visual guardado
    this.applyTheme(this.config.theme);

    // 2. Inicializar el mapa
    this.sismoMap = new SismoMap('map-container');
    this.sismoMap.init((quakeId) => this.selectQuake(quakeId, false));
    this.sismoMap.setBaseLayer(this.config.baseMap);

    // 3. Cargar placas tectónicas
    await this.sismoMap.loadTectonicPlates();
    this.sismoMap.toggleTectonicPlates(this.config.tectonicPlates);

    // 4. Registrar eventos del DOM y sincronizar controles
    this.bindEvents();
    this.syncSettingsUI();

    // 5. Geolocalización automática si está activa
    if (this.config.autoLocate) {
      this.detectUserLocation(true);
    }

    // 6. Cargar datos sísmicos iniciales
    await this.loadData(true);

    // 7. Iniciar temporizador de auto-refresco
    this.startAutoRefresh();
  }

  applyTheme(theme) {
    document.body.classList.remove('theme-cyberpunk', 'theme-graphite', 'theme-tactical', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
    this.config.theme = theme;
  }

  detectUserLocation(zoomTo = false) {
    if (!navigator.geolocation) {
      console.warn('Geolocalización no soportada en este navegador');
      return;
    }

    const gpsStatusEl = document.getElementById('gps-status-indicator');
    if (gpsStatusEl) gpsStatusEl.textContent = 'Buscando GPS...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        this.userCoords = { lat: latitude, lon: longitude };
        this.sismoMap.setUserLocation(latitude, longitude, zoomTo);

        if (gpsStatusEl) {
          gpsStatusEl.textContent = `GPS Activo (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`;
          gpsStatusEl.className = 'text-xs text-cyan-400 font-medium';
        }

        // Habilitar opciones de filtro por distancia
        const distFilter = document.getElementById('distance-filter-select');
        if (distFilter) distFilter.disabled = false;

        this.applyFilters();
      },
      (err) => {
        console.warn('Permiso de GPS denegado o no disponible:', err.message);
        if (gpsStatusEl) {
          gpsStatusEl.textContent = 'GPS no disponible / denegado';
          gpsStatusEl.className = 'text-xs text-slate-500 font-medium';
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  bindEvents() {
    // Selector de Feed (Período)
    const feedSelect = document.getElementById('feed-select');
    if (feedSelect) {
      feedSelect.addEventListener('change', (e) => {
        this.state.feedKey = e.target.value;
        this.loadData();
      });
    }

    // Selector de Magnitud Mínima
    const minMagSelect = document.getElementById('min-mag-select');
    if (minMagSelect) {
      minMagSelect.addEventListener('change', (e) => {
        this.state.minMag = parseFloat(e.target.value) || 0;
        this.applyFilters();
      });
    }

    // Filtro de distancia desde mi ubicación
    const distanceFilter = document.getElementById('distance-filter-select');
    if (distanceFilter) {
      distanceFilter.addEventListener('change', (e) => {
        this.state.distanceFilterKm = parseFloat(e.target.value) || 0;
        this.config.distanceFilterKm = this.state.distanceFilterKm;
        this.saveConfig();
        this.applyFilters();
      });
    }

    // Buscador con debounce
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      let debounceTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          this.state.searchQuery = e.target.value.trim().toLowerCase();
          this.applyFilters();
        }, 250);
      });

      const clearSearchBtn = document.getElementById('clear-search-btn');
      if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
          searchInput.value = '';
          this.state.searchQuery = '';
          this.applyFilters();
        });
      }
    }

    // Selector de Orden
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.state.sortBy = e.target.value;
        this.applyFilters();
      });
    }

    // Botón de Actualizar manual
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadData());
    }

    // Botones de filtro rápido de regiones
    document.querySelectorAll('[data-region]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const regionKey = e.currentTarget.getAttribute('data-region');
        const region = this.regions[regionKey];
        if (region) {
          this.sismoMap.flyToCoordinates(region.center[0], region.center[1], region.zoom);
        }
      });
    });

    // Toggle de Placas Tectónicas
    const platesToggle = document.getElementById('plates-toggle');
    if (platesToggle) {
      platesToggle.addEventListener('change', (e) => {
        this.config.tectonicPlates = e.target.checked;
        this.saveConfig();
        this.sismoMap.toggleTectonicPlates(this.config.tectonicPlates);
      });
    }

    // Selector de Estilo de Mapa
    const mapThemeSelect = document.getElementById('map-theme-select');
    if (mapThemeSelect) {
      mapThemeSelect.addEventListener('change', (e) => {
        this.config.baseMap = e.target.value;
        this.saveConfig();
        this.sismoMap.setBaseLayer(this.config.baseMap);
      });
    }

    // Toggle Rápido de Sonido en Header
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        this.config.soundEnabled = !this.config.soundEnabled;
        this.saveConfig();
        this.updateSoundButtonUI();
        if (this.config.soundEnabled) {
          this.playSound(this.config.soundType);
        }
      });
    }

    // ================= MODAL DE AJUSTES / PERSONALIZACIÓN =================
    const settingsModalBtn = document.getElementById('open-settings-modal');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsModalBtn = document.getElementById('close-settings-modal');

    if (settingsModalBtn && settingsModal && closeSettingsModalBtn) {
      settingsModalBtn.addEventListener('click', () => {
        this.syncSettingsUI();
        settingsModal.classList.remove('hidden');
      });
      closeSettingsModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
      });
    }

    // Controles dentro del modal de ajustes
    this.bindSettingsModalControls();

    // Modal de Información & Protocolos
    const infoModalBtn = document.getElementById('open-info-modal');
    const infoModal = document.getElementById('info-modal');
    const closeInfoModalBtn = document.getElementById('close-info-modal');

    if (infoModalBtn && infoModal && closeInfoModalBtn) {
      infoModalBtn.addEventListener('click', () => infoModal.classList.remove('hidden'));
      closeInfoModalBtn.addEventListener('click', () => infoModal.classList.add('hidden'));
      infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) infoModal.classList.add('hidden');
      });
    }

    // Botón de alternar vista móvil
    const mobileViewToggle = document.getElementById('mobile-view-toggle');
    const sidebarPanel = document.getElementById('sidebar-panel');
    const mapPanel = document.getElementById('map-panel-container');

    if (mobileViewToggle && sidebarPanel && mapPanel) {
      let isListView = false;
      mobileViewToggle.addEventListener('click', () => {
        isListView = !isListView;
        if (isListView) {
          sidebarPanel.classList.remove('hidden');
          sidebarPanel.classList.add('flex', 'w-full', 'z-20');
          mapPanel.classList.add('hidden');
          mobileViewToggle.innerHTML = '🗺️ Ver Mapa';
        } else {
          sidebarPanel.classList.add('hidden');
          sidebarPanel.classList.remove('flex', 'w-full', 'z-20');
          mapPanel.classList.remove('hidden');
          mobileViewToggle.innerHTML = '📋 Ver Lista';
          this.sismoMap.map.invalidateSize();
        }
      });
    }
  }

  bindSettingsModalControls() {
    // Selector de tema
    document.querySelectorAll('[data-theme-choice]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const theme = e.currentTarget.getAttribute('data-theme-choice');
        this.applyTheme(theme);
        this.saveConfig();
        this.syncSettingsUI();
      });
    });

    // Tipo de sonido
    const soundTypeSelect = document.getElementById('setting-sound-type');
    if (soundTypeSelect) {
      soundTypeSelect.addEventListener('change', (e) => {
        this.config.soundType = e.target.value;
        this.saveConfig();
      });
    }

    // Volumen
    const volumeSlider = document.getElementById('setting-sound-volume');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        this.config.soundVolume = parseFloat(e.target.value);
        this.saveConfig();
      });
    }

    // Botón probar sonido
    const testSoundBtn = document.getElementById('test-sound-btn');
    if (testSoundBtn) {
      testSoundBtn.addEventListener('click', () => {
        this.playSound(this.config.soundType);
      });
    }

    // Magnitud mínima para alertar con sonido
    const soundMagSelect = document.getElementById('setting-sound-minmag');
    if (soundMagSelect) {
      soundMagSelect.addEventListener('change', (e) => {
        this.config.soundMinMag = parseFloat(e.target.value);
        this.saveConfig();
      });
    }

    // Activar Notificaciones Push del navegador
    const requestPushBtn = document.getElementById('request-push-btn');
    if (requestPushBtn) {
      requestPushBtn.addEventListener('click', async () => {
        if (!('Notification' in window)) {
          alert('Tu navegador no soporta notificaciones de escritorio.');
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          this.config.pushNotifications = true;
          this.saveConfig();
          this.syncSettingsUI();
          new Notification('⚡ SismoTracker', {
            body: '¡Notificaciones activadas! Te avisaremos de sismos fuertes.',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚡</text></svg>'
          });
        } else {
          this.config.pushNotifications = false;
          this.saveConfig();
          this.syncSettingsUI();
        }
      });
    }

    // Botón re-detectar GPS
    const reLocateBtn = document.getElementById('relocate-gps-btn');
    if (reLocateBtn) {
      reLocateBtn.addEventListener('click', () => {
        this.detectUserLocation(true);
      });
    }

    // Selector de unidades de profundidad
    const unitSelect = document.getElementById('setting-unit-depth');
    if (unitSelect) {
      unitSelect.addEventListener('change', (e) => {
        this.config.unitDepth = e.target.value;
        this.saveConfig();
        this.applyFilters();
      });
    }

    // Intervalo de auto-refresco
    const refreshSecsSelect = document.getElementById('setting-refresh-interval');
    if (refreshSecsSelect) {
      refreshSecsSelect.addEventListener('change', (e) => {
        this.config.autoRefreshSecs = parseInt(e.target.value, 10);
        this.saveConfig();
        this.state.countdown = this.config.autoRefreshSecs;
        this.startAutoRefresh();
      });
    }
  }

  syncSettingsUI() {
    // Sincronizar botones de tema
    document.querySelectorAll('[data-theme-choice]').forEach(btn => {
      const theme = btn.getAttribute('data-theme-choice');
      if (theme === this.config.theme) {
        btn.classList.add('ring-2', 'ring-cyan-400', 'bg-cyan-500/20');
      } else {
        btn.classList.remove('ring-2', 'ring-cyan-400', 'bg-cyan-500/20');
      }
    });

    // Sincronizar controles de sonido
    const soundTypeSelect = document.getElementById('setting-sound-type');
    if (soundTypeSelect) soundTypeSelect.value = this.config.soundType;

    const volumeSlider = document.getElementById('setting-sound-volume');
    if (volumeSlider) volumeSlider.value = this.config.soundVolume;

    const soundMagSelect = document.getElementById('setting-sound-minmag');
    if (soundMagSelect) soundMagSelect.value = this.config.soundMinMag;

    // Estado de Notificaciones
    const pushStatusEl = document.getElementById('push-permission-status');
    if (pushStatusEl) {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          pushStatusEl.textContent = '✅ Notificaciones Permitidas';
          pushStatusEl.className = 'text-xs text-emerald-400 font-semibold';
        } else if (Notification.permission === 'denied') {
          pushStatusEl.textContent = '❌ Notificaciones Bloqueadas en el navegador';
          pushStatusEl.className = 'text-xs text-rose-400 font-semibold';
        } else {
          pushStatusEl.textContent = '⚠️ Permiso no otorgado aún';
          pushStatusEl.className = 'text-xs text-amber-400 font-semibold';
        }
      } else {
        pushStatusEl.textContent = 'No soportado en este navegador';
      }
    }

    // Sincronizar unidades
    const unitSelect = document.getElementById('setting-unit-depth');
    if (unitSelect) unitSelect.value = this.config.unitDepth;

    // Sincronizar intervalo de refresco
    const refreshSecsSelect = document.getElementById('setting-refresh-interval');
    if (refreshSecsSelect) refreshSecsSelect.value = this.config.autoRefreshSecs;

    this.updateSoundButtonUI();
  }

  updateSoundButtonUI() {
    const soundToggle = document.getElementById('sound-toggle');
    if (!soundToggle) return;
    const icon = soundToggle.querySelector('.sound-icon');
    const text = soundToggle.querySelector('.sound-text');

    if (this.config.soundEnabled) {
      soundToggle.classList.add('bg-cyan-500/20', 'text-cyan-300', 'border-cyan-500/40');
      soundToggle.classList.remove('bg-slate-800/80', 'text-slate-400', 'border-slate-700/60');
      if (icon) icon.textContent = '🔊';
      if (text) text.textContent = 'Sonido: ON';
    } else {
      soundToggle.classList.remove('bg-cyan-500/20', 'text-cyan-300', 'border-cyan-500/40');
      soundToggle.classList.add('bg-slate-800/80', 'text-slate-400', 'border-slate-700/60');
      if (icon) icon.textContent = '🔇';
      if (text) text.textContent = 'Sonido: OFF';
    }
  }

  async loadData(isInitial = false) {
    this.setLoading(true);
    try {
      const data = await fetchEarthquakeFeed(this.state.feedKey);
      const incomingFeatures = data.features || [];

      // Detección de nuevos eventos sísmicos para notificaciones / alarmas
      if (!isInitial && incomingFeatures.length > 0) {
        incomingFeatures.forEach(feature => {
          if (!this.knownQuakeIds.has(feature.id)) {
            const mag = feature.properties.mag ?? 0;
            // Alerta si supera el umbral configurado
            if (mag >= this.config.soundMinMag) {
              if (this.config.soundEnabled) {
                this.playSound(this.config.soundType);
              }
              if (this.config.pushNotifications && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(`⚠️ Sismo M ${mag.toFixed(1)} Detectado`, {
                  body: `${feature.properties.place || 'Ubicación'}\nProfundidad: ${feature.geometry.coordinates[2]} km`,
                  icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚠️</text></svg>'
                });
              }
            }
          }
        });
      }

      // Actualizar registro de IDs conocidos
      incomingFeatures.forEach(f => this.knownQuakeIds.add(f.id));

      this.state.rawFeatures = incomingFeatures;
      this.state.countdown = this.config.autoRefreshSecs;
      this.updateStatusTime(data.metadata ? data.metadata.generated : Date.now());
      this.applyFilters();

    } catch (err) {
      console.error('Error cargando datos sísmicos:', err);
      this.showToast('Error al conectar con USGS. Revisa tu conexión a internet.', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  applyFilters() {
    let list = [...this.state.rawFeatures];

    // 1. Filtrar por magnitud mínima
    if (this.state.minMag > 0) {
      list = list.filter(item => (item.properties.mag ?? 0) >= this.state.minMag);
    }

    // 2. Filtrar por búsqueda de texto
    if (this.state.searchQuery) {
      list = list.filter(item => {
        const place = (item.properties.place || '').toLowerCase();
        return place.includes(this.state.searchQuery);
      });
    }

    // 3. Filtrar por radio de distancia desde ubicación del usuario (si hay GPS)
    if (this.userCoords && this.state.distanceFilterKm > 0) {
      list = list.filter(item => {
        const [lon, lat] = item.geometry.coordinates;
        const dist = calculateDistanceKm(this.userCoords.lat, this.userCoords.lon, lat, lon);
        return dist <= this.state.distanceFilterKm;
      });
    }

    // 4. Ordenar
    list.sort((a, b) => {
      const magA = a.properties.mag ?? 0;
      const magB = b.properties.mag ?? 0;
      const timeA = a.properties.time ?? 0;
      const timeB = b.properties.time ?? 0;
      const depthA = a.geometry.coordinates[2] ?? 0;
      const depthB = b.geometry.coordinates[2] ?? 0;

      // Cálculo de distancia si se ordena por cercanía
      if (this.state.sortBy === 'dist_asc' && this.userCoords) {
        const distA = calculateDistanceKm(this.userCoords.lat, this.userCoords.lon, a.geometry.coordinates[1], a.geometry.coordinates[0]);
        const distB = calculateDistanceKm(this.userCoords.lat, this.userCoords.lon, b.geometry.coordinates[1], b.geometry.coordinates[0]);
        return distA - distB;
      }

      switch (this.state.sortBy) {
        case 'time_desc': return timeB - timeA;
        case 'time_asc': return timeA - timeB;
        case 'mag_desc': return magB - magA;
        case 'mag_asc': return magA - magB;
        case 'depth_desc': return depthB - depthA;
        case 'depth_asc': return depthA - depthB;
        default: return timeB - timeA;
      }
    });

    this.state.filteredFeatures = list;

    // Actualizar mapa
    this.sismoMap.renderEarthquakes(list, this.config.unitDepth);

    // Actualizar estadísticas KPI
    this.renderStats();

    // Actualizar lista en panel lateral
    this.renderQuakeList();
  }

  renderStats() {
    const list = this.state.filteredFeatures;
    const totalCountEl = document.getElementById('stat-total-count');
    const maxMagEl = document.getElementById('stat-max-mag');
    const maxPlaceEl = document.getElementById('stat-max-place');
    const tsunamiCountEl = document.getElementById('stat-tsunami-count');

    if (totalCountEl) totalCountEl.textContent = list.length.toLocaleString();

    if (list.length > 0) {
      const maxQuake = [...list].sort((a, b) => (b.properties.mag ?? 0) - (a.properties.mag ?? 0))[0];
      const maxMag = maxQuake.properties.mag;
      if (maxMagEl) {
        maxMagEl.textContent = maxMag !== null ? `M ${maxMag.toFixed(1)}` : 'N/A';
        maxMagEl.style.color = getMagnitudeColor(maxMag);
      }
      if (maxPlaceEl) {
        maxPlaceEl.textContent = maxQuake.properties.place || 'Ubicación';
      }

      const tsunamiCount = list.filter(q => q.properties.tsunami === 1).length;
      if (tsunamiCountEl) {
        tsunamiCountEl.textContent = tsunamiCount;
        if (tsunamiCount > 0) {
          tsunamiCountEl.classList.add('text-rose-400', 'font-bold');
        } else {
          tsunamiCountEl.classList.remove('text-rose-400', 'font-bold');
        }
      }
    } else {
      if (maxMagEl) maxMagEl.textContent = '--';
      if (maxPlaceEl) maxPlaceEl.textContent = 'Sin eventos';
      if (tsunamiCountEl) tsunamiCountEl.textContent = '0';
    }
  }

  renderQuakeList() {
    const container = document.getElementById('quake-list-container');
    if (!container) return;

    if (this.state.filteredFeatures.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-400">
          <div class="text-3xl mb-2">🔍</div>
          <p class="font-medium text-slate-300">No hay sismos con estos filtros</p>
          <p class="text-xs text-slate-500 mt-1">Prueba ampliando el radio o reduciendo la magnitud</p>
        </div>
      `;
      return;
    }

    let html = '';
    this.state.filteredFeatures.forEach(feature => {
      const p = feature.properties;
      const mag = p.mag ?? 0;
      const [lon, lat, depth] = feature.geometry.coordinates;
      const color = getMagnitudeColor(mag);
      const isSelected = feature.id === this.state.selectedId;

      // Distancia desde usuario
      let distanceBadge = '';
      if (this.userCoords) {
        const distKm = calculateDistanceKm(this.userCoords.lat, this.userCoords.lon, lat, lon);
        distanceBadge = `<span class="text-cyan-400 font-medium">📍 a ${formatDistance(distKm, this.config.unitDepth)}</span>`;
      }

      html += `
        <article data-quake-id="${feature.id}"
                 class="quake-card p-3 rounded-xl border border-slate-700/60 bg-slate-800/40 hover:bg-slate-700/40 hover:border-cyan-500/50 cursor-pointer transition-all duration-150 relative ${isSelected ? 'quake-card-active' : ''}">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-lg text-sm font-bold font-mono text-black shadow-sm"
                    style="background-color: ${color}">
                ${mag !== null ? mag.toFixed(1) : 'N/A'}
              </span>
              <div>
                <h4 class="text-xs font-semibold text-slate-100 line-clamp-1 hover:text-cyan-300">
                  ${p.place || 'Ubicación'}
                </h4>
                <div class="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
                  <span>${formatRelativeTime(p.time)}</span>
                  <span>•</span>
                  <span>Prof: <strong class="text-slate-300">${formatDepth(depth, this.config.unitDepth)}</strong></span>
                  ${distanceBadge ? `<span>•</span> ${distanceBadge}` : ''}
                </div>
              </div>
            </div>
            ${p.tsunami === 1 ? '<span class="text-rose-400 text-xs font-bold" title="Alerta de Tsunami">🌊</span>' : ''}
          </div>
        </article>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.quake-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-quake-id');
        this.selectQuake(id, true);
      });
    });
  }

  selectQuake(quakeId, shouldFocusMap = true) {
    this.state.selectedId = quakeId;
    const feature = this.state.rawFeatures.find(f => f.id === quakeId);
    if (!feature) return;

    document.querySelectorAll('.quake-card').forEach(card => {
      if (card.getAttribute('data-quake-id') === quakeId) {
        card.classList.add('quake-card-active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        card.classList.remove('quake-card-active');
      }
    });

    if (shouldFocusMap) {
      this.sismoMap.focusEarthquake(feature);
    }
  }

  startAutoRefresh() {
    if (this.state.timerId) clearInterval(this.state.timerId);
    if (this.config.autoRefreshSecs <= 0) return;

    const countdownEl = document.getElementById('refresh-countdown');

    this.state.timerId = setInterval(() => {
      this.state.countdown--;
      if (countdownEl) {
        countdownEl.textContent = `${this.state.countdown}s`;
      }

      if (this.state.countdown <= 0) {
        this.loadData();
      }
    }, 1000);
  }

  setLoading(loading) {
    this.state.isLoading = loading;
    const loader = document.getElementById('loading-indicator');
    const refreshBtn = document.getElementById('refresh-btn');
    if (loader) {
      if (loading) loader.classList.remove('hidden');
      else loader.classList.add('hidden');
    }
    if (refreshBtn) {
      if (loading) refreshBtn.classList.add('animate-spin');
      else refreshBtn.classList.remove('animate-spin');
    }
  }

  updateStatusTime(timestamp) {
    const el = document.getElementById('last-updated-text');
    if (el) {
      const d = new Date(timestamp);
      el.textContent = `Actualizado: ${d.toLocaleTimeString()}`;
    }
  }

  /**
   * Generador de sonido sintético personalizable con Web Audio API
   */
  playSound(type = 'alarm') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const volume = this.config.soundVolume ?? 0.5;
      const now = this.audioCtx.currentTime;

      if (type === 'alarm') {
        // Alarma Sísmica de dos tonos pulsantes (880Hz y 660Hz)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(660, now + 0.25);
        osc.frequency.setValueAtTime(880, now + 0.5);
        osc.frequency.setValueAtTime(660, now + 0.75);

        gain.gain.setValueAtTime(volume * 0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 1.0);

      } else if (type === 'chime') {
        // Campanilla armónica zen (Do mayor: C5, E5, G5)
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          gain.gain.setValueAtTime(volume * 0.25, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + 1.2);
        });

      } else if (type === 'synth') {
        // Barrido futurista Cyberpunk (300Hz a 1400Hz)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.4);

        gain.gain.setValueAtTime(volume * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      }
    } catch (e) {
      console.warn('Audio no soportado o bloqueado por el navegador', e);
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg text-sm text-white shadow-xl transition-all duration-300 transform translate-y-2 opacity-0 ${
      type === 'error' ? 'bg-rose-600' : 'bg-cyan-600'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new SismoApp();
  window.sismoApp = app;
  app.init();
});
