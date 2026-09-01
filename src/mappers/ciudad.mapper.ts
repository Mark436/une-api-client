import type { ApiCiudad, ApiCiudadesRespuesta } from '../api/types.js'
import type { Ciudad } from '../dto/Ciudad.js'
import { UneMappingError } from '../errors.js'

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/**
 * Mapea una ciudad cruda de `GET /cities?disabled=false` (un elemento de
 * `rows`) a un DTO limpio.
 */
export function mapCiudad(data: ApiCiudad): Ciudad {
  return {
    id: String(data.id_city),
    nombre: String(data.name),
    color: String(data.color),
    limites: {
      ne: { lat: Number(data.ne_latitude), lng: Number(data.ne_longitude) },
      sw: { lat: Number(data.sw_latitude), lng: Number(data.sw_longitude) },
    },
    routingHabilitado: Boolean(data.routing_enabled),
    descripcion: String(data.description ?? ''),
  }
}

/**
 * Mapea el contenedor completo de `GET /cities?disabled=false` a un arreglo
 * de DTOs `Ciudad`. Valida la forma minima del payload.
 */
export function mapCiudades(data: ApiCiudadesRespuesta): Ciudad[] {
  if (!esObjetoPlano(data) || !Array.isArray(data.rows)) {
    throw new UneMappingError(
      'El payload de ciudades tiene una forma inesperada: se esperaba un objeto con `rows` como arreglo.',
      { cause: data },
    )
  }
  return data.rows.map(mapCiudad)
}
