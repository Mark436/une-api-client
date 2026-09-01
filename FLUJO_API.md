# FLUJO_API.md — Cómo funciona la API de UNE y qué datos expone

Documento de lectura sobre la **API real** que alimenta el mapa en vivo de
`https://unesonora.com/`. Explica el flujo completo (autenticación + endpoints)
y qué información llega/envía el cliente `une-api-client`, señalando qué datos
sensibles maneja la API en crudo.

> Referencia técnica del payload: [`api.md`](./api.md). Estructura del paquete:
> [`ARCHITECTURE.md`](./ARCHITECTURE.md). Plan y pendientes: [`PLAN.md`](./PLAN.md).

---

## 1. Qué es la API y cómo se conecta

La web pública `unesonora.com` es **solo la fachada**. Los datos reales de
camiones, rutas, paradas y ciudades vienen de una **API REST separada**:

```
Base URL: https://api.unesonora.com
```

La API está protegida: **no acepta peticiones sin un token de Firebase** (auth
anónimo: no hay login con usuario y contraseña). El paquete `une-api-client`
resuelve todo esto internamente: obtiene el token, se autentica y mapea las
respuestas a DTOs legibles.

---

## 2. Flujo de autenticación (Firebase anónima)

```
[Cliente]                        [Firebase]                      [api.unesonora.com]
    |                                |                                  |
    |  1. POST accounts:signUp {returnSecureToken:true}                |
    |------------------------------->|                                  |
    |  { idToken, refreshToken }     |                                  |
    |<-------------------------------|                                  |
    |  2. POST securetoken.googleapis.com/v1/token                     |
    |     (grant_type=refresh_token&refresh_token=...)                  |
    |------------------------------->|                                  |
    |  { id_token (JWT, ~1h) }        |                                  |
    |<-------------------------------|                                  |
    |  3. GET /cities|/routes|/locations|...                          |
    |     Header: X-Firebase-Token: <id_token> ------------------------->|
    |                                                                   |
```

1. **signUp (usuario anónimo)**: el cliente pide un usuario anónimo a Firebase
   Identity Toolkit. Firebase devuelve un `idToken` de corta vida y un
   `refreshToken` persistente.
2. **Refresh del token**: con el `refreshToken` se obtiene un `id_token` (JWT)
   válido durante ~1 hora (`expires_in: 3600`). Si se inyecta un `refreshToken`
   previo en el constructor, el cliente salta el signUp y usa el refresh
   directamente.
3. **Peticiones a la API de UNE**: cada `GET` lleva el header
   `X-Firebase-Token: <id_token>`. Sin ese header el servidor responde 401/403.

El token se guarda en memoria con su expiración y se refresca **automáticamente
con 5 minutos de margen** antes de que caduque. Un 401/403 en la API limpia el
token y vuelve a autenticar.

> **Configuración**: la API key de Firebase es un **valor público** (el frontend
> de `unesonora.com` la expone en el navegador); el paquete la usa como default y
> funciona sin configuración. Opcionalmente se puede sobreescribir con la
> variable de entorno `UNE_FIREBASE_API_KEY` o la opción `firebaseApiKey`
> (p. ej. para apuntar a otro proyecto Firebase).

---

## 3. Endpoints reales

| Método | Path                     | Query             | Devuelve                    | Qué es                              |
| ------ | ------------------------ | ----------------- | --------------------------- | ----------------------------------- |
| GET    | `/cities`                | `disabled=false`  | `{ count, rows: Ciudad[] }` | Ciudades habilitadas                |
| GET    | `/routes/city/{id_city}` | —                 | `Ruta[]`                    | Rutas de una ciudad                 |
| GET    | `/locations/{group_id}`  | —                 | `Camion[]`                  | Posición en tiempo real de un grupo |
| GET    | `/stops`                 | `route={id_ruta}` | `Parada[]`                  | Paradas de una ruta                 |
| GET    | `/rps`                   | `id_city={id}`    | `PuntoReferencia[]`         | Puntos de referencia (bases/zona)   |

---

## 4. Relación rutas ↔ camiones (importante)

Cada ruta (`/routes/city/{id}`) trae un campo **`group_id`** (p. ej. `"1002"`,
`"API01"`). Ese `group_id` es **exactamente** el que se usa como `{group_id}`
en `/locations/{group_id}` para obtener la posición de esa ruta.

El campo `old_id_route` del camión (p. ej. `"48"`) es el id histórico y **no
coincide necesariamente** con el grupo actual. Para asignar camiones a rutas hay
que agrupar por `group_id`, no por `old_id_route`.

---

## 5. Qué muestra/extrae cada endpoint

### 5.1 Ciudad (`/cities`)

| Dato         | Significado                          |
| ------------ | ------------------------------------ |
| `id_city`    | id (`"1"` = Hermosillo)              |
| `name`       | nombre legible                       |
| `color`      | color representativo                 |
| bounding box | esquinas NE/SW del área de la ciudad |
| `routing`    | si tiene enrutamiento                |

### 5.2 Ruta (`/routes/city/{id}`)

| Dato         | Significado                                            |
| ------------ | ------------------------------------------------------ |
| `id_route`   | id de la ruta (`"4"` = Línea 1 Manga)                  |
| `name`       | nombre mostrado                                        |
| `group_id`   | **clave para consultar posiciones de camiones**        |
| `polyline`   | recorrido en **Google Encoded Polyline** (decodificar) |
| `colors`     | color primario/secundario en el mapa                   |
| `handicap`   | si tiene rampa/discapacidad                            |
| `metadata`   | distancias, unidades, tiempos de servicio              |
| `route_pois` | puntos de interés de la ruta                           |

> ⚠️ Los nombres de rutas llegan con vocales codificadas raro
> (`LA-nea 1`, `ObregA3n`): es un artefacto del backend (A3 = á). El cliente no
> lo corrige; el consumidor puede normalizarlo si lo necesita.

### 5.3 Camión (`/locations/{group_id}`) — incluye datos sensibles ⚠️

| Dato               | Significado                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `id` / `code`      | id de la unidad y código público                                  |
| `latitude` / `lng` | posición actual                                                   |
| `speed` / `cape`   | velocidad (o `--`) y rumbo                                        |
| `utc_datetime`     | timestamp UTC de la última lectura                                |
| `engine_on`        | motor encendido/apagado                                           |
| `route_direction`  | sentido de la ruta (1/2)                                          |
| `stop`/`nextStop`  | parada actual / siguiente                                         |
| `inStop`           | si está detenido en parada                                        |
| `disabled`         | si está inactivo y por qué                                        |
| **`driver_name`**  | **⚠️ nombre del conductor** (sensible)                            |
| **`plate_number`** | **⚠️ placas del vehículo** (sensible)                             |
| **`raw_data`**     | **⚠️ datos crudos del proveedor GPS (shape variable)** (sensible) |

> El cliente **NO expone** `driver_name`, `plate_number` ni `raw_data` en sus
> DTOs públicos. Solo los guarda en la capa de tipos crudos (`src/api/types.ts`)
> para saber qué llega; el consumidor nunca los recibe por defecto.

### 5.4 Parada (`/stops?route={id}`)

| Dato     | Significado                   |
| -------- | ----------------------------- |
| `id`     | id numérico                   |
| `code`   | código (`"101-BJGH"`)         |
| `name`   | nombre descriptivo            |
| lat/lng  | ubicación                     |
| `routes` | rutas que pasan por la parada |

### 5.5 Punto de referencia (`/rps?id_city={id}`)

| Dato            | Significado                                                 |
| --------------- | ----------------------------------------------------------- |
| `id_rp`         | id (`"198"`)                                                |
| `name`          | nombre (p. ej. "García Morales HMO")                        |
| lat/lng         | ubicación                                                   |
| `type`          | tipo de punto                                               |
| **`telephone`** | **⚠️ teléfono de contacto (sensible, no se expone en DTO)** |

---

## 6. Comportamiento del servidor (para entender el flujo real)

- **Header corrupto en `/locations/*`**: el servidor devuelve el header
  `X-Debug-Limit` con bytes binarios (un CR sin LF). Eso **rompe el `fetch`
  global de Node** (`Parse Error: HPE_LF_EXPECTED`). Por eso `une-api-client`
  usa un transporte HTTP por socket TLS crudo que **descarta cabeceras
  inválidas** (`src/http.ts`).
- **Caché por endpoint**: responde `X-Cache-Status: HIT`/`EXPIRED`. Los datos no
  son "live" al milisegundo; hay latencia de caché.
- **Compresión**: gzip solo si se pide `Accept-Encoding: gzip`.
- **CORS**: `Access-Control-Allow-Origin: *`, e incluye `X-Firebase-Token`.
- **Siempre JSON** con `Content-Type: application/json; charset=utf-8`.
- **Vacío**: cuando no hay datos devuelve `[]` (p. ej. un grupo sin unidades).

---

## 7. Notas de decisión / cómo usa esto el consumidor

1. **"Tiempo real" = polling**: cada `/locations/{group_id}` es un snapshot
   puntual. Para mapa en vivo el consumidor hace polling con la frecuencia que
   decida.
2. **El paquete dueño** hace HTTP + parseo + mapeo a DTOs. El consumidor decide
   cuándo consultar, cómo cachear y cómo presentar.
3. **Polilíneas**: `ruta.recorrido` se entrega ya **decodificado** a
   `{lat, lng}[]` (ver `src/mappers/decodePolyline.ts`).

---

## 8. Ejemplos de llamadas y resultados reales

Ejemplo de código con `une-api-client` (sin configuración previa: usa la key
pública por defecto o la del `.env`) y el **resultado real** obtenido de la API
contra Hermosillo (`id_city = "1"`).

```ts
import { UneApiClient } from 'une-api-client'

const client = new UneApiClient()

const ciudades = await client.listarCiudades() // GET /cities
const rutas = await client.listarRutas('1') // GET /routes/city/1
const camiones = await client.posiciones('201') // GET /locations/201
const paradas = await client.paradas('10') // GET /stops?route=10
const rps = await client.puntosReferencia('1') // GET /rps?id_city=1
```

### 8.1 `GET /cities?disabled=false` → 17 ciudades

```json
[
  {
    "id": "1",
    "nombre": "Hermosillo",
    "color": "#E94D19",
    "limites": {
      "ne": { "lat": 29.174936, "lng": -110.88565 },
      "sw": { "lat": 29.010707, "lng": -111.030007 }
    },
    "routingHabilitado": true,
    "descripcion": "Ciudad de Hermosillo, Sonora."
  }
]
```

### 8.2 `GET /routes/city/1` → 39 rutas (ruta 10 "Cárdenas - Cuauhtémoc")

```json
{
  "id": "10",
  "nombre": "Línea 2 Cárdenas - Cuauhtémoc",
  "groupId": "201",
  "recorrido": [
    { "lat": 29.05101, "lng": -110.9396 } /* ... 549 puntos en total, ya decodificados ... */
  ],
  "colorPrimario": "#0088ff",
  "colorSecundario": null,
  "accesible": false,
  "habilitado": true,
  "metadata": {
    "distance": "57370",
    "duration": "03:00:00",
    "service_units": "8",
    "service_frequency": "00:23:00",
    "service_start": "05:30:00",
    "service_end": "22:30:00"
  }
}
```

### 8.3 `GET /locations/201` → 7 camiones del grupo de la ruta 10

```json
[
  {
    "id": "H-691",
    "code": "SIT-0320",
    "ubicacion": { "lat": 29.0293, "lng": -110.949 },
    "velocidad": "--",
    "rumbo": 188,
    "timestamp": "2026-09-01T01:44:19.000Z",
    "motorEncendido": 1,
    "groupId": "201",
    "sentido": 1,
    "deshabilitado": false,
    "motivoInactividad": null,
    "paradaActual": "201-104",
    "proximaParada": "201-105",
    "enParada": false,
    "rutaId": "64"
  }
]
```

### 8.4 `GET /stops?route=10` → 406 paradas (compartidas entre varias líneas)

```json
[
  {
    "id": 19525,
    "code": "201-2TQ7",
    "nombre": "Morelia y Pino Suarez",
    "ubicacion": { "lat": 29.079361, "lng": -110.956825 },
    "rutas": [
      { "id": "13", "nombre": "Línea 2 Periférico - Lomas" },
      { "id": "10", "nombre": "Línea 2 Cárdenas - Cuauhtémoc" },
      { "id": "45", "nombre": "Línea 9 Hacienda del Sur" },
      { "id": "24", "nombre": "Línea 4 Centro" }
    ]
  }
]
```

> Nota: `/stops?route=10` devuelve **todas** las paradas que usan esa ruta,
> incluidas las compartidas con otras líneas (cada parada trae su array
> `rutas`). Para filtrar, el consumidor se queda con las que tengan esa ruta.

### 8.5 `GET /rps?id_city=1` → 340 puntos de referencia

```json
[
  {
    "id": "198",
    "nombre": "Garcia Morales HMO",
    "ubicacion": { "lat": 29.092057, "lng": -111.039748 },
    "tipo": 1
  }
]
```
