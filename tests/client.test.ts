import test from 'node:test'
import assert from 'node:assert/strict'
import { UneApiClient, type UneHttpTransport } from '../src/index.js'
import type { HttpRequestOptions, HttpResult } from '../src/http.js'
import { apiCiudadesRespuesta, apiRutas, apiCamiones } from './helpers/mock.js'

const FIREBASE_KEY = 'test-key'
const FAKE_ID_TOKEN = 'fake-id-token'
const FAKE_REFRESH = 'fake-refresh-token'

/** Cliente con `fetch` (Firebase) y transporte HTTP (API) simulados. */
function clienteMock({
  fetchHandler,
  httpHandler,
  refreshToken,
}: {
  fetchHandler: (url: string, init?: RequestInit) => Response
  httpHandler: (options: HttpRequestOptions) => HttpResult
  refreshToken?: string
}) {
  const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) =>
    fetchHandler(input instanceof URL ? input.href : String(input), init)) as typeof fetch

  const httpMock: UneHttpTransport = (options) => Promise.resolve(httpHandler(options))

  return new UneApiClient({
    fetch: fetchMock,
    http: httpMock,
    firebaseApiKey: FIREBASE_KEY,
    ...(refreshToken ? { refreshToken } : {}),
  })
}

/** Resultado HTTP simulado con cuerpo JSON. */
function jsonResult(body: unknown, status = 200): HttpResult {
  return {
    status,
    statusText: '',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  }
}

const SIGN_UP_RESPONSE = {
  idToken: FAKE_ID_TOKEN,
  refreshToken: FAKE_REFRESH,
  expiresIn: '3600',
  localId: 'abc',
}

const REFRESH_RESPONSE: Record<string, string> = {
  id_token: FAKE_ID_TOKEN,
  refresh_token: FAKE_REFRESH,
  expires_in: '3600',
  token_type: 'Bearer',
  user_id: 'abc',
  project_id: 'p',
}

test('el cliente hace signUp y luego GET autenticado con header', async () => {
  const llamadas: string[] = []
  let headersEnviados: Record<string, string> | undefined

  const cliente = clienteMock({
    fetchHandler: (url) => {
      if (url.includes('accounts:signUp')) return jsonResponse(SIGN_UP_RESPONSE)
      return jsonResponse({})
    },
    httpHandler: (options) => {
      llamadas.push(options.url)
      headersEnviados = options.headers
      if (options.url.includes('/cities')) return jsonResult(apiCiudadesRespuesta)
      return jsonResult({})
    },
  })

  const ciudades = await cliente.listarCiudades()

  assert.equal(ciudades.length, 1)
  assert.equal(ciudades[0].nombre, 'Hermosillo')
  assert.ok(llamadas.some((l) => l.includes('/cities?disabled=false')))
  assert.equal(headersEnviados?.['X-Firebase-Token'], FAKE_ID_TOKEN)
})

test('el cliente reutiliza refresh_token si se provee (sin signUp)', async () => {
  let seUsoRefresh = false
  let seUsoSignUp = false

  const cliente = clienteMock({
    fetchHandler: (url) => {
      if (url.includes('/token?key=')) {
        seUsoRefresh = true
        return jsonResponse(REFRESH_RESPONSE)
      }
      if (url.includes('accounts:signUp')) {
        seUsoSignUp = true
        return jsonResponse(SIGN_UP_RESPONSE)
      }
      return jsonResponse({})
    },
    httpHandler: ({ url }) => {
      if (url.includes('/routes/city/1')) return jsonResult(apiRutas)
      return jsonResult({})
    },
    refreshToken: FAKE_REFRESH,
  })

  const rutas = await cliente.listarRutas()
  assert.equal(rutas.length, 2)
  assert.equal(seUsoRefresh, true)
  assert.equal(seUsoSignUp, false)
})

test('listarRutas mapea posiciones de camiones y rutas', async () => {
  const cliente = clienteMock({
    fetchHandler: (url) => {
      if (url.includes('accounts:signUp')) return jsonResponse(SIGN_UP_RESPONSE)
      return jsonResponse({})
    },
    httpHandler: ({ url }) => {
      if (url.includes('/routes/city/1')) return jsonResult(apiRutas)
      if (url.includes('/locations/1002')) return jsonResult(apiCamiones)
      return jsonResult({})
    },
  })

  const rutas = await cliente.listarRutas()
  const camiones = await cliente.posiciones('1002')

  assert.equal(rutas[0].groupId, 'API01')
  assert.equal(camiones[0].id, 'H-218')
  assert.equal(camiones[0].ubicacion.lat, 29.1549)
})

test('error 401 lanza UneAuthError', async () => {
  const cliente = clienteMock({
    fetchHandler: (url) => {
      if (url.includes('accounts:signUp')) return jsonResponse(SIGN_UP_RESPONSE)
      return jsonResponse({})
    },
    httpHandler: () => jsonResult({}, 401),
  })

  await assert.rejects(
    () => cliente.listarCiudades(),
    (e: unknown) => e instanceof Error && e.name === 'UneAuthError',
  )
})

test('getRefreshToken devuelve el refresh token de la sesión', async () => {
  const cliente = clienteMock({
    fetchHandler: (url) => {
      if (url.includes('accounts:signUp')) return jsonResponse(SIGN_UP_RESPONSE)
      return jsonResponse({})
    },
    httpHandler: (options) => {
      if (options.url.includes('/cities')) return jsonResult(apiCiudadesRespuesta)
      return jsonResult({})
    },
  })

  // Dispara el auth con una llamada trivial
  await cliente.listarCiudades()
  assert.equal(cliente.getRefreshToken(), FAKE_REFRESH)
})

test('usa la API key publica por defecto (sin config) y se autentica', async () => {
  let signUpUrl: string | undefined

  const cliente = new UneApiClient({
    fetch: (async (url: URL | string) => {
      signUpUrl = String(url)
      return jsonResponse(SIGN_UP_RESPONSE)
    }) as typeof fetch,
    http: (options) => {
      if (options.url.includes('/cities')) return jsonResult(apiCiudadesRespuesta)
      return jsonResult({})
    },
  })

  const ciudades = await cliente.listarCiudades()
  assert.equal(ciudades.length, 1)
  // La key publica se usa como default cuando no se provee ninguna.
  assert.ok(signUpUrl?.includes('AIzaSyBIHWgwhC7EyaNIatEmJnnNfQb7LNk5MKY'))
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
