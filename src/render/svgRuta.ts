import type { Ruta } from '../dto/Ruta.js'
import type { Parada } from '../dto/Parada.js'
import type { Camion } from '../dto/Camion.js'
import type { Coordenada } from '../dto/Coordenada.js'

/**
 * Render de un mapa simple de una ruta a SVG. Función pura, sin dependencias.
 *
 * Proyecta el recorrido (polilínea), las paradas y los camiones (con su
 * orientación/rumbo) a un canvas SVG. Pensado para convertirse a PNG con
 * `sharp` en el consumidor o en un script de prueba.
 */

/** Dimensiones por defecto del canvas de salida. */
export interface Dimensiones {
  width: number
  height: number
}

const DIMENSIONES_DEFECTO: Dimensiones = { width: 800, height: 600 }
const MARGEN = 30

/** Proyección equirectangular simple (lat/lng → píxeles), escalada a un cuadro. */
function proyectar(
  puntos: Coordenada[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  const lats = puntos.map((p) => p.lat)
  const lngs = puntos.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  const spanLng = Math.max(maxLng - minLng, 1e-6)
  const spanLat = Math.max(maxLat - minLat, 1e-6 * cos)

  const escalaX = cos * spanLng
  const escalaY = spanLat
  const escala = Math.min((width - 2 * MARGEN) / escalaX, (height - 2 * MARGEN) / escalaY)

  return puntos.map((p) => ({
    x: MARGEN + cos * (p.lng - minLng) * escala,
    y: MARGEN + (maxLat - p.lat) * escala,
  }))
}

/**
 * Genera un string SVG con el recorrido de la ruta, sus paradas y los camiones
 * (rotados según su rumbo).
 */
export function rutaASvg(
  ruta: Ruta,
  paradas: Parada[],
  camiones: Camion[],
  dimensiones: Dimensiones = DIMENSIONES_DEFECTO,
): string {
  const { width, height } = dimensiones
  // Solo se dibujan las unidades activas en servicio (descartamos las que la
  // API marca como "disabled"/fuera de servicio, igual que el mapa oficial).
  const camionesActivos = camiones.filter((c) => !c.deshabilitado)
  const todos: Coordenada[] = [
    ...ruta.recorrido,
    ...paradas.map((p) => p.ubicacion),
    ...camionesActivos.map((c) => c.ubicacion),
  ]

  // Si no hay puntos, devolvemos un lienzo vacío con el nombre.
  if (todos.length === 0) {
    return svgMarco(width, height, ruta.nombre)
  }

  const pts = proyectar(todos, width, height)
  const recIdx = ruta.recorrido.length
  const parIdx = recIdx + paradas.length

  const path = pts
    .slice(0, recIdx)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')

  const paradasSvg = pts
    .slice(recIdx, parIdx)
    .map((p) => circle(p.x, p.y, 4, '#e74c3c'))
    .join('')

  const camionesSvg = camionesActivos
    .map((c, i) => bus(pts[parIdx + i].x, pts[parIdx + i].y, c.rumbo, c.id))
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#eef3f8"/>
  <text x="${width / 2}" y="18" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle" fill="#333">${esc(ruta.nombre)}</text>
  <path d="${path}" fill="none" stroke="${ruta.colorPrimario ?? '#0088ff'}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
  ${paradasSvg}
  ${camionesSvg}
</svg>`
}

function svgMarco(width: number, height: number, titulo: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#eef3f8"/>
  <text x="50%" y="50%" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#666">${esc(titulo)} — sin datos</text>
</svg>`
}

function circle(x: number, y: number, r: number, fill: string): string {
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="1.5"/>`
}

/** Dibuja un bus como un rectángulo con una punta que indica la dirección. */
function bus(x: number, y: number, rumbo: number, etiqueta: string): string {
  const rad = ((rumbo ?? 0) * Math.PI) / 180
  const w = 14
  const h = 9
  // Puntos del rectángulo centrado (orientado a norte) antes de rotar.
  const px: [number, number][] = [
    [x - w / 2, y - h / 2],
    [x + w / 2, y - h / 2],
    [x + w / 2, y + h / 2],
    [x - w / 2, y + h / 2],
  ]
  const rot: [number, number][] = px.map(([a, b]) => [
    x + (a - x) * Math.cos(rad) - (b - y) * Math.sin(rad),
    y + (a - x) * Math.sin(rad) + (b - y) * Math.cos(rad),
  ])
  const poly = rot.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')
  return (
    `<polygon points="${poly}" fill="#c0392b" stroke="#fff" stroke-width="1.5"/>` +
    `<text x="${(x + 8).toFixed(1)}" y="${(y - 6).toFixed(1)}" font-family="sans-serif" font-size="10" fill="#333">${esc(etiqueta)}</text>`
  )
}

/** Escapa texto para incrustarlo en SVG de forma segura. */
function esc(texto: string): string {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
