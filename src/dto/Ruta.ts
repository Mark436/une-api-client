import type { Coordenada } from './Coordenada.js'

/**
 * Ruta (línea) de UNE, mapeada a DTO público.
 *
 * Confirmado sobre el payload real de `GET /routes/city/{id_city}`.
 */
export interface Ruta {
  /** Identificador de la ruta (p. ej. "4" = "Línea 1 Manga"). */
  id: string
  /** Nombre de la ruta (p. ej. "Línea 1 Manga"). */
  nombre: string
  /** id del grupo de camiones asociado para consultar posiciones. */
  groupId: string
  /** Recorrido de la ruta, decodificado desde la polilínea encodada. */
  recorrido: Coordenada[]
  /** Color primario de la ruta en el mapa, o null. */
  colorPrimario: string | null
  /** Color secundario de la ruta, o null. */
  colorSecundario: string | null
  /** Si la ruta tiene rampa para personas con discapacidad. */
  accesible: boolean
  /** Si la ruta está habilitada. */
  habilitado: boolean
  /** Metadatos adicionales de la ruta (tiempos, unidades, distancia...). */
  metadata: Record<string, unknown>
}
