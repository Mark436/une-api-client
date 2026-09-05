# AGENTS.md — Guía de referencia para agentes

Documento de contexto para agentes/LLMs que trabajen sobre este repositorio.
**Léelo antes de modificar el código.** Refleja el estado actual del paquete.

> Documentación: [`README.md`](./README.md) (uso), [`PLAN.md`](./PLAN.md)
> (pendientes), [`ARCHITECTURE.md`](./ARCHITECTURE.md) (estructura),
> [`api.md`](./api.md) (endpoints de la API real), [`FLUJO_API.md`](./FLUJO_API.md).

---

## ¿Qué es este proyecto?

`une-api-client`: consumidor TypeScript **no oficial** de la API de camiones
de UNE (Unión de Usuarios de Hermosillo), la que alimenta el mapa en vivo de
`https://unesonora.com/`.

- **ESM**, `strict`, sin dependencias de runtime (usa `node:tls`/`node:url` y el
  `fetch` global de Node `>=24`).
- Dueño del HTTP, del parseo y del mapeo a DTOs. El consumidor decide cuándo,
  cómo cachear y cómo presentar.
- **La API real ya está descubierta** (HAR en `unesonora.har` y `unesonora2.har`,
  resumen en [`api.md`](./api.md)). El código ya refleja los endpoints y el
  payload reales. NO es un boceto: es la implementación funcional.

---

## Estado real (importante)

- **El descubrimiento de la API está completo.** Los DTOs, mappers y clientes
  reflejan el payload real capturado en los HAR. `AGENTS.md` anterior decía que
  era un "bosquejo provisional ⚠️ Fase de prueba" — eso quedó desactualizado.
- Base de la API: `https://api.unesonora.com`. Auth: Firebase anónima.
- DevDependencies instaladas; `dist/` construible con `pnpm run build`.

---

## Arquitectura (capas)

```
src/
  api/types.ts              Tipos CRUDOS con los nombres tal como llegan del API
  dto/                      DTOs PÚBLICOS legibles
    Coordenada.ts { lat, lng }
    Camion.ts / Ruta.ts / Ciudad.ts / Parada.ts / PuntoReferencia.ts
  mappers/                  Funciones puras raw -> DTO
    decodePolyline.ts       Decodifica Google Encoded Polyline (recorrido)
    camion.mapper.ts / ruta.mapper.ts / ciudad.mapper.ts
    parada.mapper.ts / puntoReferencia.mapper.ts
  rutas/                    Utilidades puras de búsqueda de rutas
    buscarRutas.ts          buscarRutasPorNombre / numeroLineaDeRuta
    normalizar.ts           normalizarTexto (acentos, minúsculas, espacios)
  errors.ts                 Jerarquía UneError
  http.ts                   Transporte HTTP tolerante (httpsGetRaw) por sockets TLS
  index.ts                  UneApiClient (Firebase auth + HTTP) + re-exports
  discover.ts               Script manual (Playwright) — excluido de build y npm
tests/                      Suite unitaria offline (node:test vía tsx)
e2e/                        Test end-to-end (ruta10.e2e.test.ts) que toca la red
_samples/                   Muestras reales (vacío / no versionado)
```

Principio: el paquete dueño hace HTTP + parseo + mapeo; el consumidor decide
cuándo/cómo y **cómo presentar** (el render del mapa SVG→PNG ya no vive aquí:
se movió a `whatsapp-une-bot` como `svgMapa.js`). `package.json` `exports` sólo
expone la raíz; los tipos públicos se re-exportan desde `src/index.ts`.

---

## Cliente y autenticación

**`UneApiClient`** (`src/index.ts`):

- `constructor(options?: { firebaseApiKey?, baseUrl?, refreshToken?,
ciudadDefault?, fetch?, http? })`
  - Defaults: `baseUrl=https://api.unesonora.com`, `ciudadDefault="1"`
    (Hermosillo), `firebaseApiKey` público del proyecto UNE (o `UNE_FIREBASE_API_KEY`).
  - `refreshToken` reutiliza una sesión anónima previa.
  - `fetch` y `http` son inyectables para testing offline.
- La API de UNE **requiere token**: el cliente hace el ciclo de auth anónima de
  Firebase internamente (`signUp` + `refresh`, header `X-Firebase-Token`).
- El token se refresca con 5 min de margen; un 401/403 limpia el token.

### Métodos públicos

| Método                           | Endpoint                      | Retorna                   |
| -------------------------------- | ----------------------------- | ------------------------- |
| `listarCiudades()`               | `GET /cities?disabled=false`  | `Ciudad[]`                |
| `listarRutas(idCiudad?)`         | `GET /routes/city/{id}`       | `Ruta[]`                  |
| `posiciones(groupId)`            | `GET /locations/{groupId}`    | `Camion[]`                |
| `paradas(idRuta)`                | `GET /stops?route={id}`       | `Parada[]`                |
| `puntosReferencia(idCiudad?)`    | `GET /rps?id_city={id}`       | `PuntoReferencia[]`       |
| `buscarRutasPorNombre(consulta)` | (busca en rutas)              | `Ruta[]`                  |
| `buscarRutaPorId(idRuta)`        | (busca en rutas)              | `Ruta \| null`            |
| `consultarRuta(identificador)`   | (ruta + paradas + posiciones) | `InformacionRuta \| null` |
| `getRefreshToken()`              | —                             | `string \| null`          |

---

## Transporte HTTP (`src/http.ts`)

El `fetch` global de Node **no puede consumir** los endpoints `/locations/*` de
UNE: el servidor devuelve un header `X-Debug-Limit` con bytes binarios (un CR
sin LF) que lanza `Parse Error: Missing expected LF after header value` y aborta
la respuesta.

Por eso el cliente usa un transporte **por socket TLS crudo** (`httpsGetRaw`)
que lee la cabeza HTTP y descarta cada línea de header inválida
(`cuidarCabecera`). Expone `HttpRequestOptions { url, method?, headers?, body?,
timeoutMs? }` → `HttpResult { status, statusText, headers, body }`. El tipo
`UneHttpTransport` es inyectable en el cliente. Firebase auth sí usa `fetch`.

> URL del HAR: [`unesonora.har`](./unesonora.har) / [`unesonora2.har`](./unesonora2.har).

---

## DTOs públicos (CONFIRMADOS sobre el payload real)

- **`Camion`**: `id`, `code`, `ubicacion { lat, lng }`, `velocidad` (número o
  `"--"`), `rumbo`, `timestamp`, `motorEncendido`, `groupId`, `sentido`,
  `deshabilitado`, `motivoInactividad`, `paradaActual`, `proximaParada`,
  `enParada`, `rutaId?`.
- **`Ruta`**: `id`, `nombre`, `groupId`, `recorrido` (polilínea decodificada a
  `Coordenada[]`), `colorPrimario`, `colorSecundario`, `accesible`, `habilitado`,
  `metadata`.
- **`Ciudad`**: `id`, `nombre`, `color`, `limites { ne, sw }`, `routingHabilitado`,
  `descripcion`.
- **`Parada`**: `id`, `code`, `nombre`, `ubicacion`, `rutas: { id, nombre }[]`.
- **`PuntoReferencia`**: `id`, `nombre`, `ubicacion`, `tipo`.

---

## Errores

**Todos heredan de `UneError`** (`src/errors.ts`). El `cause` conserva su forma
original. `UneHttpError` expone `.status`.

| Clase              | Cuándo                                  | Extra             |
| ------------------ | --------------------------------------- | ----------------- |
| `UneNetworkError`  | `fetch`/HTTP rechazó (red, DNS, CORS)   |                   |
| `UneAuthError`     | HTTP 401/403 en el API de UNE           | limpia el token   |
| `UneHttpError`     | HTTP !ok ≠ 401/403, o cuerpo no-JSON    | `.status`         |
| `UneMappingError`  | payload malformado al mapear            | `cause` = payload |
| `UneFirebaseError` | fallo en `signUp`/`refresh` de Firebase |                   |

---

## Comandos

```bash
pnpm install       # devDeps (typescript, tsx, @types/node, oxlint, prettier, playwright)
pnpm run build     # tsc -> dist/
pnpm test          # suite unitaria offline (node:test vía tsx)
pnpm run lint      # oxlint (correctness + suspicious + typescript)
pnpm run format    # prettier --write . (config en .prettierrc.json)
pnpm run format:check   # verifica que todo siga el estilo sin modificar
npx tsx src/discover.ts   # re-capturar la API (requiere playwright install)
```

El e2e (`e2e/ruta10.e2e.test.ts`) toca la red real; no forma parte de `pnpm test`.

---

## Convenciones

- **ESM**: imports internos con extensión `.js`.
- **Estilo**: todo el código se formatea con **Prettier** (`.prettierrc.json`) y
  se lintan con **oxlint** (`.oxlintrc.json`). **Sin punto y coma** (`semi: false`),
  comillas simples, ancho de 100. Corre `pnpm run lint` y `pnpm run format:check`
  tras tocar código.
- **Protocolo de verificación**: antes de dar por hecho un cambio, ejecutar
  `pnpm run build`, `pnpm test`, `pnpm run lint` y `pnpm run format:check`.
- **No añadas comentarios de especulación**; los DTOs ya confirmados no llevan
  la marca de prueba. Si descubres algo nuevo/incierto, márcalo en el JSDoc.
- **No se expone `raw_data`** (shape variable del proveedor GPS): queda solo en
  `api/types.ts`, no en el DTO público.
- **Nuevos campos/DTOs públicos** deben re-exportarse desde `src/index.ts`.
- `src/discover.ts` no se publica (en `tsconfig.json` exclude y `.npmignore`).

---

## Pendientes (resumen; detalle en `PLAN.md`)

1. Cobertura de test para `src/http.ts` (sancar header corrupto `X-Debug-Limit`).
2. Build y publicación (ordenar `LICENSE`, `.env.example`, versión estable).
3. Conectar al bot `whatsapp-une-bot` (branch `new_map`): el render SVG→PNG se
   movió al bot (`svgMapa.js`); este paquete queda solo con datos y se enlaza
   con `file:../` de momento (a versión publicada después).

## Nota de infraestructura

La instalación del browser de Playwright en esta máquina viene fallando por
descargas corruptas (carpeta existe pero falta el exe). Ver `PLAN.md` #1 para
cómo limpiar antes de reintentar.
