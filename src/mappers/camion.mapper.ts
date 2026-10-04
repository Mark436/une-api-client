import type { ApiCamion } from '../api/types.js'
import type { Camion } from '../dto/Camion.js'

function numero(parseable: unknown, defecto = 0): number {
  const n = Number(parseable)
  return Number.isFinite(n) ? n : defecto
}

/**
 * Mapea un camión crudo de `GET /locations/{group_id}` a un DTO limpio.
 */
export function mapCamion(data: ApiCamion): Camion {
  return {
    id: String(data.id),
    code: String(data.code),
    ubicacion: { lat: numero(data.latitude), lng: numero(data.longitude) },
    velocidad: data.speed,
    rumbo: numero(data.cape),
    timestamp: String(data.utc_datetime),
    motorEncendido: numero(data.engine_on),
    groupId: String(data.group_id),
    sentido: numero(data.route_direction),
    deshabilitado: Boolean(data.disabled),
    accesible:
      Boolean(numero(data.handicap_enabled)) ||
      (data.configurations ?? []).some(
        (c) => c.image_icon === 'wheelchair.png' || /discapacidad/i.test(c.name ?? '')
      ),
    motivoInactividad: data.inactive_reason,
    paradaActual: data.stop ?? null,
    proximaParada: data.nextStop ?? null,
    enParada: Boolean(data.inStop),
    ...(data.old_id_route !== undefined ? { rutaId: String(data.old_id_route) } : {}),
  }
}
