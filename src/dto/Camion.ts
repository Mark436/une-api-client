import type { Coordenada } from './Coordenada.js'

/**
 * Camión / unidad en circulación, mapeado a DTO público.
 *
 * Confirmado sobre el payload real de `GET /locations/{group_id}`.
 */
export interface Camion {
  /** Identificador de la unidad (p. ej. "H-218"). */
  id: string
  /** Código público de la unidad (p. ej. "SIT-0036"). */
  code: string
  /** Posición geográfica actual. */
  ubicacion: Coordenada
  /**
   * Velocidad. Puede venir como número o como "--" cuando no está disponible.
   */
  velocidad: number | string
  /** Rumbo en grados (heading). */
  rumbo: number
  /** Marca de tiempo UTC de la última lectura (string ISO 8601). */
  timestamp: string
  /** 1 = motor encendido, 0 = apagado. */
  motorEncendido: number
  /** id del grupo de camiones al que pertenece la unidad. */
  groupId: string
  /** Sentido de la ruta en que circula (1 o 2). */
  sentido: number
  /** Indica si la unidad está inhabilitada. */
  deshabilitado: boolean
  /** Motivo de inactividad, o null si está activa. */
  motivoInactividad: string | null
  /** Código de la parada actual (si la hay). */
  paradaActual: string | null
  /** Código de la siguiente parada (si la hay). */
  proximaParada: string | null
  /** Indica si la unidad está detenida en una parada. */
  enParada: boolean
  /** id de la ruta a la que pertenece la unidad (cuando está disponible). */
  rutaId?: string
}
