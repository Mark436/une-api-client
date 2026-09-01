import type {
  ApiCiudadesRespuesta,
  ApiRuta,
  ApiCamion,
  ApiParada,
  ApiPuntoReferencia,
} from './api/types.js'
import type { Camion } from './dto/Camion.js'
import type { Ruta } from './dto/Ruta.js'
import type { Ciudad } from './dto/Ciudad.js'
import type { Parada } from './dto/Parada.js'
import type { PuntoReferencia } from './dto/PuntoReferencia.js'
import { mapCiudades } from './mappers/ciudad.mapper.js'
import { mapRuta } from './mappers/ruta.mapper.js'
import { mapCamion } from './mappers/camion.mapper.js'
import { mapParada } from './mappers/parada.mapper.js'
import { mapPuntoReferencia } from './mappers/puntoReferencia.mapper.js'
import { UneAuthError, UneFirebaseError, UneHttpError, UneNetworkError } from './errors.js'
import { httpsGetRaw, type HttpRequestOptions, type HttpResult } from './http.js'

/**
 * Tipo del transporte de peticiones contra la API de UNE. Devuelve status,
 * cabeceras y cuerpo crudo. Por defecto usa un transporte tolerante a
 * cabeceras corruptas (ver `src/http.ts`); inyectable para testing.
 */
export type UneHttpTransport = (options: HttpRequestOptions) => Promise<HttpResult>

// Cargar `.env` (si existe) con la API nativa de Node, sin depender de dotenv.
// `process.loadEnvFile` está disponible desde Node 20.12+. Sin archivo `.env`
// simplemente se ignora (el paquete funciona con sus defaults).
try {
  process.loadEnvFile()
} catch {
  // No hay acceso a loadEnvFile (Node viejo) o no existe el `.env`: ignorar.
}

/** Variable de entorno con la API key de Firebase (auth anonimo). */
const ENV_FIREBASE_API_KEY = process.env.UNE_FIREBASE_API_KEY ?? ''

/**
 * API key pública de Firebase del proyecto UNE (auth anonimo), usada como
 * default. Es un valor público: el frontend de `unesonora.com` la expone en el
 * navegador, así que hardcodearla aquí no filtra ningún secreto. Se puede
 * sobreescribir con `UNE_FIREBASE_API_KEY` o la opción `firebaseApiKey`.
 */
const FIREBASE_API_KEY_PUBLICA = 'AIzaSyBIHWgwhC7EyaNIatEmJnnNfQb7LNk5MKY'

/** Base URL por defecto de la API REST de UNE. */
const DEFAULT_BASE_URL = 'https://api.unesonora.com'

/** Cadena que identifica a Hermosillo como ciudad por defecto. */
const CIUDAD_DEFAULT_ID = '1'

/** Segundos de margen antes de la expiracion real para refrescar el token. */
const TOKEN_EXPIRY_BUFFER_SEC = 300

/** Cadena sin path base de la API de Firebase (Identity Toolkit). */
const FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1'
const FIREBASE_TOKEN_URL = 'https://securetoken.googleapis.com/v1'

export interface UneApiClientOptions {
  /**
   * API key de Firebase para auth anonimo. Se lee de `UNE_FIREBASE_API_KEY`
   * (env) si no se provee, y si tampoco hay env se usa el default publico del
   * proyecto UNE (la misma key que expone el frontend de `unesonora.com`).
   * No es un secreto: es un valor publico de Firebase auth anonimo.
   */
  firebaseApiKey?: string
  /** Base URL de la API de UNE. Default: `https://api.unesonora.com`. */
  baseUrl?: string
  /**
   * refresh_token existente para reutilizar una sesion anonima previa. Si se
   * provee, el cliente evita hacer signUp y usa directamente el refresh.
   */
  refreshToken?: string
  /**
   * Ciudad por defecto que usaran los metodos que no reciben `idCiudad`.
   * Default: `"1"` (Hermosillo).
   */
  ciudadDefault?: string
  /** Custom `fetch` inyectable (para testing del auth de Firebase). */
  fetch?: typeof globalThis.fetch
  /**
   * Transporte HTTP para las llamadas a la API de UNE. Default: `httpsGetRaw`
   * (tolerante a cabeceras HTTP corruptas del servidor). Inyectable en tests.
   */
  http?: UneHttpTransport
}

interface FirebaseSignUpResponse {
  kind: string
  idToken: string
  refreshToken: string
  expiresIn: string
  localId: string
}

interface FirebaseRefreshResponse {
  kind: string
  id_token: string
  expires_in: string
  token_type: string
  refresh_token: string
  user_id: string
  project_id: string
}

/**
 * Token de Firebase con metadatos de expiracion local.
 */
interface FirebaseToken {
  idToken: string
  refreshToken: string
  expiresAtMs: number
}

function getResponseInfo(response: Response) {
  return {
    status: response.status,
    statusText: response.statusText,
    url: response.url,
  }
}

/**
 * Cliente no oficial para la API de camiones de UNE.
 *
 * Maneja el ciclo de autenticacion anonima de Firebase (signUp + refresh)
 * y expone metodos tipados para cada endpoint de la API de UNE.
 *
 * La API key de Firebase la toma de la opcion `firebaseApiKey`, del env
 * `UNE_FIREBASE_API_KEY` o, por defecto, de la key publica del proyecto UNE
 * (la misma que expone el frontend de `unesonora.com`). No requiere config.
 *
 * Las llamadas usan el header `X-Firebase-Token` con el `id_token` vigente.
 */
export class UneApiClient {
  #apiKey: string
  #baseUrl: string
  #ciudadDefault: string
  #fetch: typeof globalThis.fetch
  #http: UneHttpTransport

  #token: FirebaseToken | null = null
  #authPromise: Promise<void> | null = null

  constructor(options: UneApiClientOptions = {}) {
    this.#apiKey = options.firebaseApiKey || ENV_FIREBASE_API_KEY || FIREBASE_API_KEY_PUBLICA
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.#ciudadDefault = options.ciudadDefault ?? CIUDAD_DEFAULT_ID
    this.#fetch = options.fetch ?? globalThis.fetch
    this.#http = options.http ?? httpsGetRaw

    if (options.refreshToken) {
      this.#token = {
        idToken: '',
        refreshToken: options.refreshToken,
        expiresAtMs: 0,
      }
    }
  }

  // ── Autenticacion Firebase ───────────────────────────────────────────

  /**
   * Asegura que exista un token de Firebase vigente. Si no hay token o esta
   * expirado, ejecuta signUp (anonimo) o refresh. La primera llamada a un
   * metodo publico lo ejecuta automaticamente.
   */
  async #ensureAuth(): Promise<void> {
    if (this.#token && Date.now() < this.#token.expiresAtMs * 1000) return

    // Encadenar multiples llamadas concurrentes al mismo refresh.
    if (this.#authPromise) {
      await this.#authPromise
      if (this.#token && Date.now() < this.#token.expiresAtMs * 1000) return
    }

    this.#authPromise = this.#doAuth()
    try {
      await this.#authPromise
    } finally {
      this.#authPromise = null
    }
  }

  async #doAuth(): Promise<void> {
    const hasExisting = this.#token && this.#token.refreshToken && this.#token.idToken === ''

    if (hasExisting) {
      try {
        await this.#refreshToken(this.#token!.refreshToken)
        return
      } catch {
        // Si el refresh falla (token revocado/expirado), caemos al signUp.
      }
    }

    await this.#signUp()
  }

  async #signUp(): Promise<void> {
    const url = `${FIREBASE_AUTH_URL}/accounts:signUp?key=${this.#apiKey}`

    let res: Response
    try {
      res = await this.#fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSecureToken: true }),
      })
    } catch (e: unknown) {
      throw new UneFirebaseError('Error de red al intentar signUp en Firebase', { cause: e })
    }

    if (!res.ok) {
      throw new UneFirebaseError('signUp de Firebase fallo', {
        cause: getResponseInfo(res),
      })
    }

    const data: FirebaseSignUpResponse = await res.json()

    this.#token = {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAtMs: Date.now() + Number(data.expiresIn) * 1000 - TOKEN_EXPIRY_BUFFER_SEC * 1000,
    }
  }

  async #refreshToken(refreshToken: string): Promise<void> {
    const url = `${FIREBASE_TOKEN_URL}/token?key=${this.#apiKey}`

    let res: Response
    try {
      res = await this.#fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
      })
    } catch (e: unknown) {
      throw new UneFirebaseError('Error de red al intentar refresh de token en Firebase', {
        cause: e,
      })
    }

    if (!res.ok) {
      throw new UneFirebaseError('refresh de token de Firebase fallo', {
        cause: getResponseInfo(res),
      })
    }

    const data: FirebaseRefreshResponse = await res.json()

    this.#token = {
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresAtMs: Date.now() + Number(data.expires_in) * 1000 - TOKEN_EXPIRY_BUFFER_SEC * 1000,
    }
  }

  // ── Helper de peticiones autenticadas ────────────────────────────────

  /**
   * Ejecuta un GET autenticado contra la API de UNE y devuelve la respuesta
   * JSON parseada. Usa el transporte `#http` (tolerante a cabeceras HTTP
   * corruptas del servidor, p. ej. `X-Debug-Limit` con bytes binarios).
   */
  async #get<T>(path: string, params?: Record<string, string>): Promise<T> {
    await this.#ensureAuth()

    const url = new URL(path, this.#baseUrl)
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    }

    let res: HttpResult
    try {
      res = await this.#http({
        url: url.toString(),
        headers: {
          Accept: 'application/json',
          'X-Firebase-Token': this.#token!.idToken,
        },
      })
    } catch (e: unknown) {
      throw new UneNetworkError('Error de red al contactar el API de UNE', { cause: e })
    }

    if (res.status < 200 || res.status >= 300) {
      const causa = { status: res.status, statusText: res.statusText, url: url.toString() }
      if (res.status === 401 || res.status === 403) {
        // Token invalido: limpiar.
        this.#token = null
        throw new UneAuthError('No autorizado (token Firebase invalido o expirado)', {
          cause: causa,
        })
      }
      throw new UneHttpError('Error de peticion', { cause: causa })
    }

    try {
      return JSON.parse(res.body) as T
    } catch (e: unknown) {
      throw new UneHttpError('El servidor respondio con contenido que no es JSON valido', {
        cause: { url: url.toString(), detalle: String(e) },
      })
    }
  }

  // ── Metodos publicos ─────────────────────────────────────────────────

  /** Devuelve el refresh_token actual para poder reutilizarlo en otra sesion. */
  getRefreshToken(): string | null {
    return this.#token?.refreshToken ?? null
  }

  /**
   * Lista todas las ciudades habilitadas.
   * `GET /cities?disabled=false` → `Ciudad[]`
   */
  async listarCiudades(): Promise<Ciudad[]> {
    const data = await this.#get<ApiCiudadesRespuesta>('/cities', { disabled: 'false' })
    return mapCiudades(data)
  }

  /**
   * Lista las rutas de una ciudad.
   * `GET /routes/city/{idCiudad}` → `Ruta[]`
   */
  async listarRutas(idCiudad?: string): Promise<Ruta[]> {
    const id = idCiudad ?? this.#ciudadDefault
    const data = await this.#get<ApiRuta[]>(`/routes/city/${id}`)
    return data.map(mapRuta)
  }

  /**
   * Obtiene las posiciones (ubicacion en tiempo real) de un grupo de camiones.
   * `GET /locations/{groupId}` → `Camion[]`
   */
  async posiciones(groupId: string): Promise<Camion[]> {
    const data = await this.#get<ApiCamion[]>(`/locations/${groupId}`)
    return data.map(mapCamion)
  }

  /**
   * Lista las paradas de una ruta.
   * `GET /stops?route={idRuta}` → `Parada[]`
   */
  async paradas(idRuta: string): Promise<Parada[]> {
    const data = await this.#get<ApiParada[]>('/stops', { route: idRuta })
    return data.map(mapParada)
  }

  /**
   * Lista los puntos de referencia (bases/zonas) de una ciudad.
   * `GET /rps?id_city={idCiudad}` → `PuntoReferencia[]`
   */
  async puntosReferencia(idCiudad?: string): Promise<PuntoReferencia[]> {
    const id = idCiudad ?? this.#ciudadDefault
    const data = await this.#get<ApiPuntoReferencia[]>('/rps', { id_city: id })
    return data.map(mapPuntoReferencia)
  }
}

// ── Re-exports publicos ──────────────────────────────────────────────────
export {
  UneError,
  UneAuthError,
  UneHttpError,
  UneMappingError,
  UneNetworkError,
  UneFirebaseError,
} from './errors.js'
export type { Camion } from './dto/Camion.js'
export type { Ruta } from './dto/Ruta.js'
export type { Ciudad } from './dto/Ciudad.js'
export type { Parada } from './dto/Parada.js'
export type { PuntoReferencia } from './dto/PuntoReferencia.js'
export type { Coordenada } from './dto/Coordenada.js'
