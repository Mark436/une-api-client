import type { Coordenada } from './Coordenada.js'

/**
 * Ciudad de UNE, mapeada a DTO público.
 *
 * Confirmado sobre el payload real de `GET /cities?disabled=false`.
 */
export interface Ciudad {
  /** Identificador de la ciudad (p. ej. "1" = Hermosillo). */
  id: string
  /** Nombre de la ciudad. */
  nombre: string
  /** Color representativo de la ciudad. */
  color: string
  /** Rectángulo envolvente (bounding box) de la ciudad. */
  limites: {
    ne: Coordenada
    sw: Coordenada
  }
  /** Indica si el enrutamiento está habilitado en la ciudad. */
  routingHabilitado: boolean
  /** Descripción de la ciudad. */
  descripcion: string
}
