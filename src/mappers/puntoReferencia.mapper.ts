import type { ApiPuntoReferencia } from '../api/types.js'
import type { PuntoReferencia } from '../dto/PuntoReferencia.js'

/**
 * Mapea un punto de referencia crudo de `GET /rps?id_city={id}` a un DTO
 * limpio.
 */
export function mapPuntoReferencia(data: ApiPuntoReferencia): PuntoReferencia {
  return {
    id: String(data.id_rp),
    nombre: String(data.name),
    ubicacion: { lat: Number(data.latitude), lng: Number(data.longitude) },
    tipo: Number(data.type),
  }
}
