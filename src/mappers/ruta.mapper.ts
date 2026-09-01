import type { ApiRuta } from '../api/types.js'
import type { Ruta } from '../dto/Ruta.js'
import { decodePolyline } from './decodePolyline.js'

/**
 * Mapea una ruta cruda de `GET /routes/city/{id_city}` a un DTO limpio.
 * Decodifica la polilínea encodada del recorrido.
 */
export function mapRuta(data: ApiRuta): Ruta {
  return {
    id: String(data.id_route),
    nombre: String(data.name),
    groupId: String(data.group_id),
    recorrido: decodePolyline(data.polyline),
    colorPrimario: data.primary_color,
    colorSecundario: data.secondary_color,
    accesible: Boolean(data.handicap_enabled),
    habilitado: !data.disabled,
    metadata: data.metadata ?? {},
  }
}
