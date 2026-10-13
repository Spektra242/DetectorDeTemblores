# DetectorDeTemblores 🌍

Monitor de sismos y terremotos en tiempo real con mapa interactivo y alertas.

👉 **Pruébalo acá:** [https://spektra242.github.io/DetectorDeTemblores/](https://spektra242.github.io/DetectorDeTemblores/)

---

## De qué trata

Hice esta web para poder revisar sismos recientes en cualquier parte del mundo de forma rápida y sin publicidad ni registros. Los datos se obtienen directamente de los feeds públicos del **USGS (Servicio Geológico de EE.UU.)** y se refrescan automáticamente cada minuto.

## Lo que tiene

- **Mapa en vivo (Leaflet):** Marcadores con tamaño y color según la magnitud del temblor, más las líneas de fallas y placas tectónicas del planeta.
- **Cálculo de distancia por GPS:** Si le das permiso de ubicación, calcula a cuántos kilómetros de ti ocurrió cada sismo y te permite filtrar solo los cercanos (ej. a menos de 500 km).
- **Filtros útiles:** Por período (última hora, 24 horas, semana), magnitud mínima (M 2.5+, 4.5+, 6.0+) y buscador por texto (ej. "Chile", "México", "Japón").
- **Alertas sonoras:** Incluye sintetizador de audio (alarma o campanilla) si se detecta un sismo fuerte (M 5.0+).
- **Temas:** Viene con tema oscuro/neón por defecto, pero tiene selector para cambiar a modo grafito, táctico o claro.
- **Funciona en celular y PC:** Interfaz adaptable con vista de mapa y lista.

## Tecnologías

No usa Node ni herramientas de compilación pesadas; corre directo en el navegador:

- **HTML5 + JavaScript vanilla**
- **Tailwind CSS** (vía CDN)
- **Leaflet.js** con capas base de Esri Canvas (sin marcas de agua)
- **API GeoJSON de USGS**

## Probarlo en local

No hay que instalar nada. Solo clona el repo (o descarga el zip) y abre `index.html`:

```bash
git clone https://github.com/Spektra242/DetectorDeTemblores.git
cd DetectorDeTemblores
# Abre index.html con doble clic en tu navegador
