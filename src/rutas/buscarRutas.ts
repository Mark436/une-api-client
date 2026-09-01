import type { Ruta } from '../dto/Ruta.js'
import { normalizarTexto } from './normalizar.js'

/**
 * Búsqueda de rutas por nombre puro, sin red y sin dependencias.
 *
 * La consulta puede incluir el número de línea ("10"), un alias o parte del
 * nombre ("caturegli"), o ambos ("10 caturegli"). No resuelve por id.
 *
 * Devuelve TODAS las rutas que coinciden, o una lista vacía si ninguna.
 */

const NUMERO_LINEA = /(?:linea|ruta)\s*(\d+)/

/** Extrae el número de línea de una ruta por su nombre ("Línea 10 Caturegli" → "10"). */
export function numeroLineaDeRuta(ruta: Ruta): string | null {
  const m = normalizarTexto(ruta.nombre).match(NUMERO_LINEA)
  return m ? m[1] : null
}

/** Si la consulta incluye un número de línea, lo devuelve ("10 caturegli" → "10"). */
function numeroDeConsulta(consultaNormalizada: string): string | null {
  const m = consultaNormalizada.match(/(?:^|\s)(\d+)(?:\s|$)/)
  return m ? m[1] : null
}

/**
 * Busca rutas cuya línea (número) y/o nombre coincidan con la consulta.
 *
 * - Si la consulta trae un número, debe coincidir con el número de línea de la
 *   ruta ("10" empareja "Línea 10 ...").
 * - Las palabras de la consulta deben aparecer como subcadena del nombre
 *   normalizado de la ruta, de modo que "caturegli" empareje
 *   "Línea 10 Caturegli".
 *
 * Devuelve un arreglo con todas las coincidencias (sin resultados → `[]`).
 */
export function buscarRutasPorNombre(rutas: Ruta[], consulta: string): Ruta[] {
  const q = normalizarTexto(consulta)
  if (!q) return []

  const num = numeroDeConsulta(q)
  // Palabras significativas de la consulta (sin el número de línea).
  const palabras = q.split(' ').filter((p) => p && p !== num && p.length > 0)

  return rutas.filter((ruta) => {
    const nombreN = normalizarTexto(ruta.nombre)

    // Si la consulta trae número, el número de línea de la ruta debe coincidir.
    if (num) {
      const linea = numeroLineaDeRuta(ruta)
      if (!linea || linea !== num) return false
    }

    // Cada palabra de la consulta debe estar en el nombre normalizado.
    return palabras.every((p) => nombreN.includes(p))
  })
}
