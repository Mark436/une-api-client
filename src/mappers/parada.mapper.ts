import type { ApiParada } from '../api/types.js'
import type { Parada } from '../dto/Parada.js'

/**
 * Mapea una parada cruda de `GET /stops?route={id_route}` a un DTO limpio.
 */
export function mapParada(data: ApiParada): Parada {
  return {
    id: Number(data.id),
    code: String(data.code),
    nombre: String(data.name),
    ubicacion: { lat: Number(data.latitude), lng: Number(data.longitude) },
    rutas: data.routes.map((r) => ({ id: String(r.id), nombre: String(r.name) })),
  }
}
