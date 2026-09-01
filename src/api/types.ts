/**
 * Tipos crudos de la API de UNE (`https://api.unesonora.com`), con los nombre
 * tal como llegan del servidor. Confirmados a partir de un HAR real capturado
 * de `https://unesonora.com/` (ver `api.md`).
 *
 * Todas las llamadas requieren el header `X-Firebase-Token` con un ID token
 * de Firebase (auth anónimo). Ver el flujo en `src/index.ts` y `api.md`.
 */

/** Coordenada {lat, lng} normalizada (no es la forma cruda; ver cada mapeo). */
export interface Coord {
  lat: number
  lng: number
}

/** Campo `speed` de un camión: puede venir como número o como string "--". */
export type ApiSpeed = number | string

/**
 * Un camión / unidad en circulación. Proviene de `GET /locations/{group_id}`.
 */
export interface ApiCamion {
  id: string
  code: string
  latitude: number
  longitude: number
  speed: ApiSpeed
  /** Rumbo en grados. */
  cape: number
  /** Timestamp UTC ISO 8601 (p. ej. "2026-09-01T00:40:51.000Z"). */
  utc_datetime: string
  driver_name: string | null
  /** 1 = motor encendido, 0 = apagado. */
  engine_on: number
  group_id: string
  brand: string | null
  plate_number: string | null
  /** Sentido de la ruta (1 o 2). */
  route_direction: number
  handicap_enabled: number
  supplier: string
  ignore: boolean
  /** Datos crudos del proveedor de GPS (shape variable según el supplier). */
  raw_data: Record<string, unknown>
  hide: boolean
  disabled: boolean
  inactive_reason: string | null
  /** Código de la parada actual / próxima, o null. */
  stop: string | null
  nextStop: string | null
  inStop: boolean
  /** id_route de la ruta a la que perteneció (puede no coincidir con group). */
  old_id_route?: string
}

/** Una ruta / línea de UNE. Proviene de `GET /routes/city/{id_city}`. */
export interface ApiRuta {
  id_route: string
  id_city: string
  type: number
  internal_id: number
  internal_order: number
  name: string
  /** id del grupo de camiones asociado a la ruta (para GET /locations/...). */
  group_id: string
  special_name: string
  description: string
  logo: string | null
  /** Polilínea del recorrido en formato Google Encoded Polyline. */
  polyline: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  disabled: boolean
  primary_color: string | null
  secondary_color: string | null
  handicap_enabled: boolean
  id_parent_route: string | null
  image_icon: string | null
  route_pois: unknown[]
  route_unions: unknown[]
  route_configurations: unknown[]
}

/** Una ciudad. Proviene de `GET /cities?disabled=false` (dentro de `rows`). */
export interface ApiCiudad {
  id_city: string
  name: string
  description: string
  color: string
  logo: string | null
  notifications_enabled: boolean
  disabled: boolean
  created_at: string
  updated_at: string
  ne_latitude: number
  ne_longitude: number
  sw_latitude: number
  sw_longitude: number
  routing_enabled: boolean
  banner: string | null
  banner_url: string
  banner_description: string
}

/** Respuesta contenedor de `GET /cities?disabled=false`. */
export interface ApiCiudadesRespuesta {
  count: string
  rows: ApiCiudad[]
}

/** Una parada de autobús. Proviene de `GET /stops?route={id_route}`. */
export interface ApiParada {
  id: number
  code: string
  name: string
  latitude: number
  longitude: number
  routes: { id: string; name: string }[]
}

/** Ruta simple referenciada dentro de una parada. */
export interface ApiRutaRef {
  id: string
  name: string
}

/** Punto de referencia (zona de espera / base). `GET /rps?id_city={id}`. */
export interface ApiPuntoReferencia {
  id_rp: string
  id_city: string
  name: string
  description: string | null
  address: string | null
  telephone: string | null
  attention_hours: string | null
  image: string | null
  latitude: number
  longitude: number
  disabled: boolean
  created_at: string
  updated_at: string
  type: number
}
