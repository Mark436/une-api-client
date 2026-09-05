# Arquitectura de une-api-client

Consumidor TypeScript **no oficial** de la API de camiones de UNE (Unión de
Usuarios de Hermosillo), la que alimenta el mapa en vivo de `unesonora.com`.

> Estado: **la API real ya está descubierta** (HAR en `unesonora.har`,
> resumen en [`api.md`](./api.md)). El código ya refleja los endpoints y el
> payload reales.

---

## Vista general

Paquete **ESM**, `strict`, sin dependencias en runtime (usa el `fetch` global
de Node `>=24`). Está ordenado en capas por responsabilidad:

```
src/
  api/types.ts              Tipos CRUDOS con los nombres reales del API
  dto/                      DTOs PÚBLICOS con nombres legibles
    Coordenada.ts           { lat, lng }
    Camion.ts / Ruta.ts / Ciudad.ts / Parada.ts / PuntoReferencia.ts
  mappers/                  Funciones puras raw -> DTO
    decodePolyline.ts       Decodifica polilíneas Google Encoded Polyline
    camion.mapper.ts / ruta.mapper.ts / ciudad.mapper.ts
    parada.mapper.ts / puntoReferencia.mapper.ts
  errors.ts                 Jerarquía UneError
  http.ts                   Transporte HTTP tolerante (httpsGetRaw) — NO se usa fetch para la API
  index.ts                  UneApiClient (Firebase auth + HTTP) + re-exports
  discover.ts               Script manual de descubrimiento (Playwright) — NO se publica
tests/                      Suite unitaria offline (node:test + tsx)
_samples/                   Muestras de payload real capturadas (no versionadas)
```

Principio (mismo espíritu que el patrón de cliente que se usa en otros
consumidores): **el paquete dueño hace HTTP + parseo + mapeo; el consumidor
decide cuándo consultar, cómo cachear y cómo presentar.** La presentación —p.
ej. el mapa SVG→PNG que genera `whatsapp-une-bot`— vive **en el consumidor**,
no en este paquete (que solo entrega datos).

---

## Flujo de autenticación (Firebase anónima)

La API de UNE **no acepta peticiones sin token**. El cliente resuelve esa
dependencia internamente en `src/index.ts`:

1. `UneApiClient.#ensureAuth()` — si no hay token vigente, ejecuta el ciclo.
2. `#signUp()` — `POST accounts:signUp?key=...` con `{returnSecureToken:true}`
   → `idToken` + `refreshToken` (nuevo usuario anónimo).
3. `#refreshToken()` — `POST securetoken.googleapis.com/v1/token` con
   `grant_type=refresh_token&refresh_token=...` → `id_token` (JWT, ~1h).
4. Cada `GET` a `api.unesonora.com` envía `X-Firebase-Token: <id_token>`.

El token se guarda en memoria con su `expiresAtMs` y se refresca con 5 minutos
de margen antes de expirar. Un `refreshToken` previo se puede inyectar en el
constructor para reutilizar una sesión. Los fallos de auth lanzan
`UneFirebaseError`; un 401/403 en el API limpia el token y lanza
`UneAuthError`.

---

## Transporte HTTP tolerante (`src/http.ts`)

El `fetch` global de Node **no puede consumir** los endpoints `/locations/*` de
UNE: el servidor devuelve un header `X-Debug-Limit` con bytes binarios (un CR
sin LF) que lanza `Parse Error: Missing expected LF after header value` en los
parsers estrictos y aborta la respuesta. Ver [`api.md`](./api.md) para el
detalle del servidor.

Por eso el cliente usa un **transporte HTTP por socket TLS crudo** (inyectable)
en lugar de `fetch` para las llamadas a `api.unesonora.com`:

- **`HttpRequestOptions`** `{ url, method?, headers?, body?, timeoutMs? }`.
- **`HttpResult`** `{ status, statusText, headers, body }` (body como string).
- **`httpsGetRaw(options)`** — hace la petición, lee la cabeza HTTP cruda y la
  sana: descarta cada línea de header que no sea `Name: value` ASCII limpio
  (`cuidarCabecera`), y devuelve status + headers + body ya decodificado en
  `utf8`. No pide `Accept-Encoding: gzip`, así que recibe JSON plano.

El cliente expone el tipo `UneHttpTransport = (options) => Promise<HttpResult>`
y acepta un transporte en el constructor (opción `http`); por defecto usa
`httpsGetRaw`. Firebase auth sigue con `fetch` (ahí no hay headers corruptos).
Inyectar un transporte simulado permite testear el cliente 100% offline.

> Consecuencia operativa: el cliente **no depende de `fetch` para la API** (solo
> para auth). Si UNE arregla el header corrupto, se podría volver a `fetch`.

---

## Capas

- **`api/types.ts`** — tipos crudos con los nombres reales del API
  (`ApiCamion`, `ApiRuta`, `ApiCiudad`, `ApiParada`, `ApiPuntoReferencia`).
  La capa "como llega".
- **`dto/`** — DTOs públicos con nombres legibles (`Camion`, `Ruta`, `Ciudad`,
  `Parada`, `PuntoReferencia`, `Coordenada`). La capa "como se consume".
- **`mappers/`** — funciones puras `raw -> DTO`, sin red, sin estado, sin
  efectos. `decodePolyline` convierte el recorrido encodado en coordenadas.
- **`errors.ts`** — jerarquía `UneError`: `UneNetworkError`, `UneHttpError`
  (con `.status`), `UneAuthError`, `UneMappingError`, `UneFirebaseError`. El
  `cause` conserva su forma original; clasificar siempre por clase/`cause`.
- **`index.ts`** — la clase `UneApiClient` (auth + HTTP) + re-exports de
  errores, DTOs y tipos desde la raíz. `exports` del `package.json` sólo
  expone la raíz (los imports profundos a `dist/**` están bloqueados).
- **`discover.ts`** — script manual de desarrollo (Playwright) para re-capturar
  el tráfico si cambia la web. Excluido de `dist` (`tsconfig.json`) y de npm
  (`.npmignore`).

---

## Acceso a la API pública

```ts
import { UneApiClient } from 'une-api-client'

const client = new UneApiClient() // Firebase key + baseUrl por defecto

const ciudades = await client.listarCiudades() // Ciudad[]
const rutas = await client.listarRutas('1') // Ruta[] (Hermosillo)
const camiones = await client.posiciones('1002') // Camion[] (grupo de la ruta)
const paradas = await client.paradas('48') // Parada[]
const rps = await client.puntosReferencia() // PuntoReferencia[]
const ref = client.getRefreshToken() // reutilizar sesión
```

- Para saber el `group_id` de una ruta: `rutas.find(r => r.id === ...).groupId`.
- Todos los tipos públicos se re-exportan desde la raíz.
- Se conservan extensiones `.js` en los imports internos por ESM.

---

## Errores

| Clase              | Cuándo                                  | Extra             |
| ------------------ | --------------------------------------- | ----------------- |
| `UneAuthError`     | HTTP 401/403 en el API de UNE           | limpia el token   |
| `UneFirebaseError` | fallo en `signUp`/`refresh` de Firebase |                   |
| `UneNetworkError`  | `fetch` rechazó (red, DNS, CORS)        |                   |
| `UneHttpError`     | HTTP !ok ≠ 401/403, o cuerpo no-JSON    | `.status`         |
| `UneMappingError`  | payload con forma inesperada al mapear  | `cause` = payload |

---

## Pruebas

Suite unitaria 100% offline con `node:test` vía `tsx` (sin dependencias
nuevas). El data es `tests/helpers/mock.ts` (extraído del HAR real). El
cliente inyecta un `fetch` simulado (para Firebase auth) y un transporte HTTP
simulado (devuelve `HttpResult`), así que nunca toca la red.

```bash
pnpm test             # suite completa
pnpm run build        # tsc -> dist/
pnpm run lint         # oxlint
pnpm run format:check # prettier (sin semicolons)
```

> Pendiente: `src/http.ts` (el transporte `httpsGetRaw`) no tiene cobertura de
> tests propia — solo se prueba indirectamente vía el `http` simulado. Un test
> que sane un header corrupto (`X-Debug-Limit` con bytes) sería el complemento
> natural.

---

## Mandatos / reglas importantes

- **ESM**: los imports internos llevan extensión `.js`.
- **No añadas comentarios de especulación**; si algo no se confirma, márcalo en
  el JSDoc con una advertencia.
- **Nuevos campos/DTOs públicos** deben re-exportarse desde `src/index.ts`.
- **No se expone `raw_data`** (shape variable del proveedor GPS): queda solo en
  `api/types.ts`, no en el DTO público.
