import type { Coordenada } from './Coordenada.js'

/**
 * Punto de referencia (base/zona de espera de UNE), mapeado a DTO público.
 *
 * Confirmado sobre el payload real de `GET /rps?id_city={id}`.
 */
export interface PuntoReferencia {
  /** Identificador del punto de referencia. */
  id: string
  /** Nombre del punto de referencia. */
  nombre: string
  /** Ubicación geográfica del punto. */
  ubicacion: Coordenada
  /** Tipo de punto. */
  tipo: number
}
