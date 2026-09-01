import type { Coordenada } from './Coordenada.js'

/**
 * Parada de autobús de UNE, mapeada a DTO público.
 *
 * Confirmado sobre el payload real de `GET /stops?route={id_route}`.
 */
export interface Parada {
  /** Identificador numérico de la parada. */
  id: number
  /** Código de la parada (p. ej. "101-BJGH"). */
  code: string
  /** Nombre descriptivo de la parada. */
  nombre: string
  /** Ubicación geográfica de la parada. */
  ubicacion: Coordenada
  /** Rutas que pasan por esta parada. */
  rutas: { id: string; nombre: string }[]
}
