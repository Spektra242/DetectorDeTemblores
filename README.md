# 🌍 SismoTracker Pro - Monitor Sísmico en Tiempo Real Personalizable

Una aplicación web interactiva, moderna y personalizable para monitorear temblores y terremotos en todo el mundo en tiempo real con datos oficiales del **USGS (Servicio Geológico de los Estados Unidos)**.

Desarrollada para ser alojada de forma 100% gratuita en **GitHub Pages** sin configuraciones de backend ni instalación de dependencias de compilación.

---

## 🎨 Opciones de Personalización Integradas

La aplicación cuenta con un **Panel de Personalización (`⚙️ Personalizar`)** integrado directamente en la interfaz que guarda tus elecciones en el navegador (`localStorage`):

1. **🎨 Temas Visuales:**
   - ⚡ **Cyberpunk Neón** (predeterminado): Fondo negro profundo, acentos en azul eléctrico, cian y magenta fosforescente con efectos de resplandor.
   - ⬛ **Grafito Minimalista**: Tonos neutros, grises oscuros y estética técnica limpia.
   - 🎯 **Radar Táctico**: Verde militar fosforescente y estilo de centro de comando de defensa.
   - ☀️ **Modo Claro**: Fondo blanco y contraste optimizado para lectura diurna.

2. **📍 Geolocalización & Filtro por Distancia:**
   - Detección automática por GPS de tu ubicación actual.
   - Marcador animado tipo radar sobre tu ciudad.
   - Medición exacta en kilómetros (o millas) de la distancia entre cada epicentro y tu ubicación actual (*"📍 a 180 km de ti"*).
   - Filtro de radio: Ver solo sismos a menos de **250 km**, **500 km**, **1.000 km**, **2.500 km** o el mundo entero.
   - Ordenar sismos por proximidad ("Más cercano a mí").

3. **🔊 Alertas Sonoras y Sintetizador de Audio:**
   - Generador nativo Web Audio API (sin archivos de audio pesados).
   - 3 tipos de sonido seleccionables:
     - 🚨 **Alarma Sísmica:** Dos tonos alternantes de alerta temprana.
     - 🔔 **Campanilla Zen:** Acorde armónico sutil y agradable.
     - ⚡ **Sintetizador Cyberpunk:** Barrido de frecuencia futurista.
   - Control de volumen ajustable y botón para probar el sonido.
   - Umbral de magnitud para activar la alarma ($M \ge 4.0$, $5.0$ o $6.0$).

4. **📲 Notificaciones Push en Escritorio:**
   - Alertas nativas del navegador cuando se detecte un nuevo sismo de magnitud relevante, incluso con la pestaña en segundo plano.

5. **📏 Unidades y Frecuencia de Refresco:**
   - Cambia entre **Kilómetros (km)** y **Millas (mi)**.
   - Intervalos de sincronización automática: cada **30s**, **60s**, **120s** o modo manual.

---

## 🚀 Cómo publicarlo en GitHub Pages (Paso a Paso)

Tu sitio estará disponible públicamente en una URL como: `https://TU-USUARIO.github.io/sismo-tracker/`

### Opción Rápida: Desde la Web de GitHub (Sin instalar nada)

1. **Crear Repositorio:**
   - Entra a [github.com/new](https://github.com/new).
   - Nombre: `sismo-tracker`.
   - Selecciona **Public** y haz clic en **Create repository**.

2. **Subir los Archivos:**
   - Haz clic en **"uploading an existing file"**.
   - Arrastra todos los archivos de esta carpeta:
     - `index.html`
     - Carpeta `css/` (`styles.css`)
     - Carpeta `js/` (`api.js`, `map.js`, `app.js`)
     - `README.md`
   - Haz clic en **Commit changes**.

3. **Activar GitHub Pages:**
   - Ve a **Settings > Pages**.
   - En **Branch**, selecciona `main` y la carpeta `/(root)`.
   - Haz clic en **Save**. En 1 o 2 minutos tu app estará en vivo.

---

## 💻 Cómo probarlo localmente

Simplemente haz doble clic sobre el archivo [index.html](file:///C:/Users/Spectre/.gemini/antigravity/scratch/sismo-tracker/index.html) para abrirlo en cualquier navegador (Chrome, Edge, Firefox, Brave, Safari), o usa Python:

```powershell
python -m http.server 8000
```
Y visita `http://localhost:8000`.

---

## 📁 Estructura del Código

```text
sismo-tracker/
├── index.html          # Interfaz completa, panel de ajustes y visor Leaflet
├── README.md           # Guía de personalización y despliegue
├── .gitignore          # Filtro de control de versiones
├── css/
│   └── styles.css      # Variables de temas (Cyberpunk, Grafito, Radar, Claro) y animaciones
└── js/
    ├── api.js          # API del USGS, fórmula de Haversine y helpers de distancia
    ├── map.js          # Leaflet, capas de mapa, fallas tectónicas y punto GPS
    └── app.js          # Sintetizador de audio, push notifications, GPS y filtros
```
