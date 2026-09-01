# une-api-client — Notas de API y glosario

Referencia sobre la **API real** de UNE (Unión de Usuarios de Hermosillo),
confirmada a partir de un **HAR** capturado de `https://unesonora.com/`
(archivo `unesonora.har` en la raíz del repo) y volcada aquí para que el
cliente y el consumidor entiendan el flujo.

> La web pública es solo la fachada: los datos vienen de una API REST separada
> en `https://api.unesonora.com` protegida por **auth anónima de Firebase**.

---

## Panorama del flujo real

```
[Consumer]                              [Firebase]                         [api.unesonora.com]
    |                                         |                                   |
    |  1. POST accounts:signUp (returnSecureToken)  |                           |
    |----------------------------------------->|                                   |
    |  { idToken, refreshToken, localId }      |                                   |
    |<-----------------------------------------|                                   |
    |  2. POST securetoken.googleapis.com/v1/token  |                            |
    |     (grant_type=refresh_token&refresh_token=..)                             |
    |----------------------------------------->|                                   |
    |  { id_token, expires_in: 3600 }          |                                   |
    |<-----------------------------------------|                                   |
    |  3. GET /cities|/routes|/locations|...   |                                   |
    |     Header: X-Firebase-Token: <id_token> --------------------------------->|
    |                                                                              |
```

1. **Auth anónima**: la web (y el cliente) piden un usuario anónimo a
   Firebase Identity Toolkit. Esto devuelve un `idToken` de corta vida y un
   `refreshToken` persistente.
2. **Refresh del token**: con el `refreshToken` se obtiene un `id_token`
   (JWT) vigente durante ~1 hora (`expires_in: 3600`).
3. **Peticiones a la API de UNE**: cada `GET` lleva el header
   `X-Firebase-Token: <id_token>`. Sin ese header el servidor responde
   401/403.

> El token del HAR apunta a **`une-transporte-urbano`** como proyecto Firebase
> (iss: `https://securetoken.google.com/une-transporte-urbano`). El backend
> valida el JWT; no hay login con correo/contraseña, solo anónimo. La API key
> del proyecto es un **valor público** (el frontend de `unesonora.com` lo expone
> en el navegador). El cliente la usa como default y permite sobreescribirla con
> la variable `UNE_FIREBASE_API_KEY` (ver `.env.example`) o la opción
> `firebaseApiKey`.

---

## Endpoints reales

| Método | Path                     | Query             | Devuelve                    | Descripción                                     |
| ------ | ------------------------ | ----------------- | --------------------------- | ----------------------------------------------- |
| GET    | `/cities`                | `disabled=false`  | `{ count, rows: Ciudad[] }` | Ciudades habilitadas                            |
| GET    | `/routes/city/{id_city}` | —                 | `Ruta[]`                    | Rutas de una ciudad                             |
| GET    | `/locations/{group_id}`  | —                 | `Camion[]`                  | Posición en tiempo real de un grupo de camiones |
| GET    | `/stops`                 | `route={id_ruta}` | `Parada[]`                  | Paradas de una ruta                             |
| GET    | `/rps`                   | `id_city={id}`    | `PuntoReferencia[]`         | Puntos de referencia (bases/zona)               |

**Base URL:** `https://api.unesonora.com`

### Cómo lo hace: comportamiento HTTP del servidor

El backend es **nginx/1.24.0** sobre Node/Express con caché en memoria. Algunas
peculiaridades observadas en vivo:

- **Caché por endpoint**: los `GET` responden con `X-Cache-Status: HIT` o
  `EXPIRED` (y a veces `X-Cache-Timestamp`). Los datos de rutas/camiones se
  actualizan con cierta latencia; no son "live" al milisegundo.
- **Compresión**: responde `Content-Encoding: gzip` _solo si_ la petición manda
  `Accept-Encoding: gzip` (lo hace el `fetch` global de Node automáticamente).
  Si no se envía ese header, devuelve JSON plano.
- **CORS**: `Access-Control-Allow-Origin: *` y headers
  `Access-Control-Allow-Headers` que incluyen `X-Firebase-Token`.
- **Siempre JSON**: todos los endpoints devuelven un cuerpo JSON con `Content-Type: application/json; charset=utf-8`.
- Cuando no hay datos, los endpoints devuelven `[]` (p. ej. un grupo de camiones sin unidades).

#### ⚠️ El header corrupto de `/locations/*` (importante)

Los endpoints `/locations/{group_id}` devuelven un **header `X-Debug-Limit` con
bytes binarios**, incluyendo un byte `0x0D` (CR) que **no** va seguido de
`0x0A` (LF). Los parsers HTTP estrictos de Node (`undici`/`http`) lanzan
`Missing expected LF after header value` y **abortan la respuesta**:

```
Error: Parse Error: Missing expected LF after header value
    code: 'HPE_LF_EXPECTED'
```

Esto rompe el `fetch` global de Node para **todos** los `/locations/*` (no es
intermitente; es persistente). Los demás endpoints no tienen el problema.

**Solución en el cliente**: `src/http.ts` implementa un transporte HTTP por
socket TLS crudo _tolerante a cabeceras corruptas_. Lee la cabeza HTTP,
**descarta las líneas de header inválidas** (las que no son `Nombre: valor`
ASCII limpio) y devuelve body + status usable. El cliente usa este transporte
para todas las llamadas a `api.unesonora.com`; Firebase auth sigue usando
`fetch` (que ahí sí va bien).

> Consecuencia: **el cliente no puede depender del `fetch` global de Node para
> la API de UNE**. Si algún día UNE arregla el header, se podría volver a usar
> `fetch` (el transporte es inyectable).

### Relación rutas ↔ camiones

Cada ruta (`/routes/city/{id}`) trae un campo **`group_id`** (p. ej. `"1002"`,
`"API01"`, `"101"`, `"102"`). Ese `group_id` es **exactamente** lo que se usa
como `{group_id}` en `/locations/{group_id}` para obtener la posición de esa
ruta. El campo `old_id_route` del camión (p. ej. `"48"`) es el `id_route`
histórico y no coincide necesariamente con el grupo ni con `id_route` de la
ruta actual; para asignar camiones a rutas conviene agrupar por `group_id`.

---

## Glosario del payload crudo

### Ciudad (`/cities` → `rows[]`, p. ej. `Hermosillo`)

| Campo crudo                              | Tipo   | Significado                          |
| ---------------------------------------- | ------ | ------------------------------------ |
| `id_city`                                | string | id de la ciudad (`"1"` = Hermosillo) |
| `name`                                   | string | nombre legible                       |
| `description`                            | string | descripción                          |
| `color`                                  | string | color representativo                 |
| `ne_latitude`/`ne_longitude`             | number | esquina noreste del bounding box     |
| `sw_latitude`/`sw_longitude`             | number | esquina suroeste del bounding box    |
| `routing_enabled`                        | bool   | si hay enrutamiento en la ciudad     |
| `notifications_enabled`, `disabled`, ... | misc   | demás metadatos                      |

### Ruta (`/routes/city/{id}`)

| Campo crudo                         | Tipo         | Significado                                                                                |
| ----------------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| `id_route`                          | string       | id de la ruta (`"4"` = Línea 1 Manga)                                                      |
| `name` / `special_name`             | string       | nombre mostrado                                                                            |
| `group_id`                          | string       | **id del grupo de camiones** → `/locations/{group_id}`                                     |
| `polyline`                          | string       | recorrido en **Google Encoded Polyline** (hay que decodificar)                             |
| `primary_color` / `secondary_color` | string\|null | colores en el mapa                                                                         |
| `handicap_enabled`                  | bool         | si tiene rampa/discapacidad                                                                |
| `disabled`                          | bool         | si está habilitada                                                                         |
| `metadata`                          | object       | distancias, tiempos de servicio (`service_units`, `service_start`, `service_frequency`...) |
| `route_pois`                        | array        | puntos de interés de la ruta                                                               |

> ⚠️ Los nombres de rutas en el payload traen las vocales codificadas raro
> (`LA-nea 1 Manga`, `ObregA3n`, `RA-o`): es un artefacto de codificación del
> backend (A3 = á, etc.). No lo "corrijas" en el cliente; el consumidor puede
> normalizarlo si lo necesita.

### Camión (`/locations/{group_id}`)

| Campo crudo                    | Tipo           | Significado                                                      |
| ------------------------------ | -------------- | ---------------------------------------------------------------- |
| `id`                           | string         | id de la unidad (`"H-218"`)                                      |
| `code`                         | string         | código público (`"SIT-0036"`)                                    |
| `latitude` / `longitude`       | number         | posición actual                                                  |
| `speed`                        | number\|string | velocidad; `"--"` cuando no hay dato                             |
| `cape`                         | number         | rumbo/heading en grados                                          |
| `utc_datetime`                 | string         | timestamp UTC ISO 8601                                           |
| `engine_on`                    | 0\|1           | motor encendido                                                  |
| `route_direction`              | 1\|2           | sentido de la ruta                                               |
| `group_id`                     | string         | grupo al que pertenece                                           |
| `stop` / `nextStop`            | string\|null   | parada actual / siguiente                                        |
| `inStop`                       | bool           | si está detenido en parada                                       |
| `disabled` / `inactive_reason` | bool\|string   | si está inactivo y por qué                                       |
| `old_id_route`                 | string         | id_route histórico (no fiable para agrupar hoy)                  |
| `raw_data`                     | object         | datos crudos del proveedor GPS (shape variable según `supplier`) |

### Parada (`/stops?route={id}`)

| Campo crudo              | Tipo   | Significado                           |
| ------------------------ | ------ | ------------------------------------- |
| `id`                     | number | id numérico de la parada              |
| `code`                   | string | código (`"101-BJGH"`)                 |
| `name`                   | string | nombre descriptivo                    |
| `latitude` / `longitude` | number | ubicación                             |
| `routes`                 | array  | `{ id, name }` de las rutas que pasan |

### Punto de referencia (`/rps?id_city={id}`)

| Campo crudo              | Tipo   | Significado                          |
| ------------------------ | ------ | ------------------------------------ |
| `id_rp`                  | string | id (`"198"`)                         |
| `name`                   | string | nombre (p. ej. "García Morales HMO") |
| `latitude` / `longitude` | number | ubicación                            |
| `type`                   | number | tipo de punto                        |

---

## Notas importantes / decisiones

1. **Auth anónima cada ~1h**: el `id_token` expira a la hora. El cliente
   refresca automáticamente con el `refresh_token` (margen de 5 min).
2. **`group_id` vs rutas**: para pedir la posición de una ruta hay que
   resolver su `group_id` primero (con `/routes/city/{id}`), no su `id_route`.
3. **Polilíneas**: el campo `polyline` es Google Encoded Polyline; el cliente
   lo decodifica a `{lat, lng}[]` (ver `src/mappers/decodePolyline.ts`).
4. **Actualización en vivo**: cada `/locations/{group_id}` es un snapshot
   puntual. Para "tiempo real" el consumidor debe hacer polling con la
   frecuencia que decida.
5. El endpoint `/locations/{group_id}` devuelve `[]` cuando el grupo no tiene
   unidades (p. ej. `API01` sin camiones).

---

## Gaps / decisiones abiertas

1. ~~¿Auth?~~ Confirmado: **auth anónima Firebase** (implementada en el cliente).
2. ~~Forma de la posición~~ Confirmada (ver glosario Camión).
3. ~~Geometría/paradas~~ Parcial: la geometría viene en `polyline` (encoded);
   las paradas en `/stops?route={id}`. Falta validar la fidelidad del
   decode en rutas completas.
4. ~~Refresco~~ Los endpoints son snapshots; el polling lo decide el consumidor.

> Ver [`PLAN.md`](./PLAN.md) para el plan de acción y el estado real.
