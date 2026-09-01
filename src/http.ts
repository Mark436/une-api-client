import tls from 'node:tls'
import { URL } from 'node:url'

/**
 * Transporte HTTP/1.1 tolerante a headers corruptos.
 *
 * Los endpoints `/locations/*` de la API de UNE devuelven un header
 * `X-Debug-Limit` con bytes binarios (incl. un CR sin LF) que rompe los
 * parsers estrictos de Node (`undici`/`http`). Este transporte hace raw
 * sockets TLS, lee la cabeza HTTP cruda y la inequívoca: sólo se conservan
 * líneas de header `Name: value` válidas y el resto se descarta, antes de
 * devolver el cuerpo. De esta forma el cliente no depende del `fetch` global
 * (que no puede consumir esas respuestas).
 */
export interface HttpResult {
  status: number
  statusText: string
  headers: Record<string, string>
  /** Cuerpo de la respuesta como string (sin decodificación gzip manual aquí). */
  body: string
}

export interface HttpRequestOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  /** Segundos antes de abortar. */
  timeoutMs?: number
}

function cuidarCabecera(line: string): string | null {
  // Quitar CR sueltos y bytes no imprimibles ASCII.
  const limpia = line.replace(/\r/g, '').replace(/[^\x20-\x7E]/g, '')
  if (!limpia) return null
  const idx = limpia.indexOf(':')
  if (idx <= 0) return null
  const name = limpia.slice(0, idx).trim()
  const value = limpia.slice(idx + 1).trim()
  if (!/^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/.test(name)) return null
  return `${name}: ${value}`
}

function parseHttpResponse(buffer: Buffer): HttpResult {
  // Buscar el final de la cabeza: \r\n\r\n (o \n\n con cabeceras LF).
  let headerEnd = buffer.indexOf('\r\n\r\n')
  let headerRaw: string
  let bodyStart: number
  if (headerEnd !== -1) {
    headerRaw = buffer.slice(0, headerEnd).toString('latin1')
    bodyStart = headerEnd + 4
  } else {
    headerEnd = buffer.indexOf('\n\n')
    if (headerEnd === -1) {
      throw new Error('Respuesta sin fin de cabecera HTTP')
    }
    headerRaw = buffer.slice(0, headerEnd).toString('latin1')
    bodyStart = headerEnd + 2
  }

  const lines = headerRaw
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter(Boolean)

  const statusLine = lines[0]
  const statusPart = statusLine.match(/^HTTP\/1\.[01]\s+(\d{3})\s*(.*)$/)
  if (!statusPart) {
    throw new Error(`Línea de status HTTP inválida: ${statusLine}`)
  }
  const status = Number(statusPart[1])
  const statusText = statusPart[2] ?? ''

  const headers: Record<string, string> = {}
  for (const line of lines.slice(1)) {
    const cuidada = cuidarCabecera(line)
    if (cuidada === null) continue // descartar header corrupto
    const colon = cuidada.indexOf(':')
    const name = cuidada.slice(0, colon).trim().toLowerCase()
    const value = cuidada.slice(colon + 1).trim()
    headers[name] = value
  }

  const body = buffer.slice(bodyStart).toString('utf8')
  return { status, statusText, headers, body }
}

/**
 * Realiza una petición HTTPS con socket crudo y devuelve la respuesta
 * saneada. Útil cuando el `fetch` global falla por headers de servidor
 * corruptos.
 */
export function httpsGetRaw(options: HttpRequestOptions): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url)
    const timeoutMs = options.timeoutMs ?? 30000

    const enciende = (socket: tls.TLSSocket) => {
      const timeout = setTimeout(() => {
        socket.destroy(new Error('Timeout en la petición HTTP'))
      }, timeoutMs)

      const path = (url.pathname || '/') + (url.search || '')

      const headerLines = [`${options.method ?? 'GET'} ${path} HTTP/1.1`, `Host: ${url.host}`]
      for (const [k, v] of Object.entries(options.headers ?? {})) {
        headerLines.push(`${k}: ${v}`)
      }
      if (options.body) {
        headerLines.push(`Content-Type: application/x-www-form-urlencoded`)
        headerLines.push(`Content-Length: ${Buffer.byteLength(options.body)}`)
      }
      headerLines.push('Connection: close', '', '')
      socket.write(headerLines.join('\r\n'))

      if (options.body) socket.write(options.body)

      const chunks: Buffer[] = []
      socket.on('data', (d) => chunks.push(d))
      socket.on('end', () => {
        clearTimeout(timeout)
        try {
          resolve(parseHttpResponse(Buffer.concat(chunks)))
        } catch (e) {
          reject(e)
        }
      })
      socket.on('error', (e) => {
        clearTimeout(timeout)
        reject(e)
      })
    }

    const socket = tls.connect(
      { host: url.hostname, port: Number(url.port || 443), servername: url.hostname },
      () => enciende(socket),
    )
    socket.on('error', (e) => reject(e))
  })
}
