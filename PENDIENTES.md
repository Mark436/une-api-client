# PENDIENTES.md — Lista de pendientes para mañana

> Estado generado al final de la sesión. Se actualiza según se avanza.
> Acompaña a [`PLAN.md`](./PLAN.md) (roadmap general) y a
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) (estructura del paquete).

---

## ✅ Ya hecho en esta sesión (resumen)

- Búsqueda de rutas **por nombre** (número de línea y/o parte del nombre):
  - Utilidad pura en `src/rutas/` (`buscarRutasPorNombre`, `numeroLineaDeRuta`,
    `normalizarTexto`).
  - Métodos en `UneApiClient`: `buscarRutasPorNombre`, `buscarRutaPorId`,
    `consultarRuta`.
- **Render a imagen**:
  - Función pura `rutaASvg` (`src/render/svgRuta.ts`) → SVG del recorrido +
    paradas + camiones (rotados por `rumbo`).
  - Conversión SVG→PNG con `sharp` (devDependency) vía `e2e/image-test.ts`.
- El script de imagen resuelve la ruta **por nombre** ("caturegli" → Línea 10
  Caturegli, id 48, Hermosillo) y genera el mapa.
- Se filtran las unidades **inactivas** (la API las marca con `disabled` /
  `deshabilitado`: p. ej. "Unidad fuera de ruta", "Unidad sin datos recientes"),
  igual que el mapa oficial.
- 27 tests offline en verde; build, lint y formato OK.
- 2 commits en `main`.

---

## 🔴 Pendientes para mañana (prioridad)

### 1. Mejorar el estilo del mapa SVG generado

Es lo que dejamos abierto al final: el mapa cumple (recorrido + paradas + buses
con rumbo) pero **visualmente se puede pulir mucho**:

- [ ] **Tipografía y leyenda**: título más legible, leyenda de "recorrido /
      parada / unidad", rótulos de las paradas clave.
- [ ] **Color de las rutas**: usar el `colorPrimario` de forma que contraste con
      el fondo y las paradas (hoy paradas y buses son rojizos y se confunden).
- [ ] **Iconos de bus más vistosos**: forma tipo "flecha/autobús" en vez de
      rectángulo, con `rumbo` bien visible, tamaño que no se pierda entre las
      paradas.
- [ ] **Paradas**: en lugar de un círculo plano, marcador con borde propio de la
      línea; evitar que queden tapadas por los buses.
- [ ] **Zoom/fit**: recorte del bounding box para que la ruta ocupe el lienzo y
      no queden márgenes enormes (o dimensiones variables según la forma).
- [ ] **Fondo/base**: opcional, cartografía ligera (OSM) si se quiere contexto,
      o mantener el fondo plano pero con más contraste.
- [ ] Snapshot de referencia para comparar antes/después al rediseñar.

### 2. Roadmap general — lo que falta por revisar/avanzar

Ver [`PLAN.md`](./PLAN.md) para el detalle. Resumen accionable:

- [ ] **Validar en vivo los endpoints que aún no se prueban de punta a punta**
      (`/stops` con `route`, `/rps`) además de `/routes` y `/locations` que ya
      se validaron. Confirmar `metadata` de las rutas.
- [ ] **Decidir frecuencias de polling** en el consumidor (el mapa en vivo se
      actualiza cada N segundos; falta decidir N y el caché).
- [ ] **Conectar al bot `whatsapp-une-bot`**: recrear el mapa con este render
      (SVG→PNG) en lugar del screenshot de DOM, y enviar la imagen por
      WhatsApp. Enlazar el paquete como dependencia.
- [ ] **Build y publicación**: revisar `files` en `package.json` (excluir
      `e2e/`, `_generadas/`, HAR), reproducir `dist/`, y publicar cuando la
      validación en vivo esté lista.
- [ ] **Revisar `ARCHITECTURE.md` / `README.md`**: documentar los métodos
      nuevos (`buscarRutasPorNombre`, `buscarRutaPorId`, `consultarRuta`,
      `rutaASvg`) y la sección de imagen.

### 3. Revisar/mejorar la funcionalidad de búsqueda y consulta

- [ ] `consultarRuta` hoy resuelve por nombre **si es único** o por id; revisar
      qué hacer cuando el nombre da varias coincidencias (¿devolver todas?
      ¿pedir más datos?).
- [ ] Confirmar el comportamiento del `metadata` de cada ruta y si conviene
      exponer más campos crudos en el DTO `Ruta`.

### 4. Mantenimiento / limpieza

- [ ] Verificar que `e2e/` y `_generadas/` no se publiquen en npm
      (`.npmignore` / `files`).
- [ ] Los HAR (`unesonora.har`, `unesonora2.har`) quedan ignorados; no
      versionarlos.
- [ ] Correr el protocolo completo antes de cerrar: `build`, `test`, `lint`,
      `format:check`.

---

## 📌 Referencias rápidas

- Ejecutar el script de imagen:
  `pnpm exec tsx e2e/image-test.ts`
- Suite offline: `pnpm test`
- Build/lint/formato: `pnpm run build` · `pnpm run lint` · `pnpm run format:check`
