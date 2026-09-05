# une-api-client — Estado actual y plan de trabajo

> **LEER PRIMERO.** Este documento es la fuente de verdad sobre el estado real
> del paquete y los pasos que faltan.

---

## Resumen del estado (hoy)

- ✅ **La API real está descubierta.** A partir de un HAR capturado de
  `https://unesonora.com/` (`unesonora.har` en la raíz) se confirmaron los
  endpoints de `https://api.unesonora.com` y el mecanismo de **auth anónima de
  Firebase**. Detalle completo en [`api.md`](./api.md).
- ✅ **El código refleja la API real**: tipos, DTOs, mappers y el cliente
  `UneApiClient` implementan el flujo real (signUp + refresh + header
  `X-Firebase-Token`).
- ✅ **`npm run build` compila** y **`npm test` pasa** (13/13) con datos reales
  del HAR y un `fetch` simulado (nunca toca la red).
- ⚠️ **Pendiente real**: validar el cliente contra la API en vivo (con un
  `fetch` de verdad) y decidir frecuencias de polling en el consumidor.

---

## Lo que ya existe (archivos)

```
une-api-client/
  package.json         ESM, main/types dist, exports solo raíz
  tsconfig.json        strict ESM, rootDir src -> dist
  .gitignore / .npmignore
  .env.example
  unesonora.har        Captura real del tráfico (referencia, no versionado)
  README.md / ARCHITECTURE.md / PLAN.md / api.md
  src/
    api/types.ts       tipos crudos reales del API
    dto/               DTOs públicos (Camion, Ruta, Ciudad, Parada, PuntoReferencia, Coordenada)
    mappers/           decodePolyline + uno por DTO
    errors.ts          UneError y subclases (incl. UneFirebaseError)
    index.ts           UneApiClient (auth Firebase + HTTP) + re-exports
    discover.ts        script manual de descubrimiento (excluido de build/npm)
  tests/
    helpers/mock.ts    data real extraído del HAR
    camion.mapper.test.ts / ruta.mapper.test.ts / mappers.test.ts / client.test.ts
  _samples/            destino de muestras (no versionado)
```

---

## Lo que se sabe de la API (resumen; ver `api.md`)

- **Auth**: anónima Firebase. `signUp` → `refreshToken`; luego
  `securetoken.googleapis.com/v1/token` → `id_token` (~1h). Cada GET a
  `api.unesonora.com` lleva `X-Firebase-Token: <id_token>`.
- **Endpoints**:
  - `GET /cities?disabled=false` → `{count, rows}`
  - `GET /routes/city/{id_city}` → rutas (con `group_id` + `polyline` encoded)
  - `GET /locations/{group_id}` → posiciones de camiones de un grupo
  - `GET /stops?route={id_ruta}` → paradas
  - `GET /rps?id_city={id}` → puntos de referencia
- **Rutas ↔ camiones**: usar `group_id` de la ruta como `{group_id}` de
  `/locations/...`.

---

## Pendiente #1 — Validar el cliente contra la API en vivo ⏳

El cliente ya implementa el flujo, pero **solo se ha probado offline** (con
`fetch` simulado). Falta:

1. Ejecutar una prueba real: construir un `UneApiClient` y llamar
   `listarCiudades()`, `listarRutas()`, `posiciones("1002")`.
2. Verificar que el `signUp` + `refresh` + header funcionan contra Firebase y
   que el 401 se maneja bien si el token se invalida.
3. Comprobar el decode de polilíneas en rutas completas (fidelidad del
   recorrido).
4. Confirmar la `refresh_token` de una sesión anónima NO es sensible a nivel
   crítico (solo da acceso a datos públicos), pero NO debe commitearse.

> Nota: los métodos usan el `fetch` global de Node ≥24. No hay dependencia de
> Playwright en el cliente publicado.

---

## Pendiente #2 — Conectar al bot `whatsapp-une-bot`

Hecho en la branch `new_map`:

- El render del mapa (SVG→PNG) **se movió al bot**: `whatsapp-une-bot` tiene su
  propio módulo `svgMapa.js` adaptado del antiguo `src/render/svgRuta.ts`, por
  lo que este paquete quedó **solo con datos** (HTTP + parseo + mapeo).
- El bot resuelve la ruta por nombre (`listarRutas` / `consultarRuta`), renderiza
  el mapa con su propio SVG y envía la imagen por WhatsApp.
- El paquete se enlaza con `file:../une-api-client` (de momento) y más adelante
  por versión publicada en npm.

---

## Pendiente #3 — Build y publicación

- ✅ devDependencies instaladas; `npm run build` compila y `npm test` pasa con
  datos reales.
- ✅ `LICENSE` (MIT) y `.env.example` presentes.
- ⏳ Públicar cuando la validación en vivo esté lista (revisar `files` en
  `package.json`).

---

## Notas de infraestructura / problemas detectados

- **Playwright en esta máquina** sigue fallando con descargas corruptas/incompletas
  (existe la carpeta pero falta `chrome.exe` / `headless_shell.exe`). Por eso el
  descubrimiento se hizo **desde un HAR** capturado manualmente; `discover.ts`
  sigue siendo útil como script de re-captura si se arregla el install.
- Limpiar antes de reintentar:
  `C:\Users\marco\.cache\puppeteer\chrome` y
  `C:\Users\marco\AppData\Local\ms-playwright\*`.
