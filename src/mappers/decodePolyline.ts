import type { Coord } from '../api/types.js'

/**
 * Decodifica una polilínea en formato Google Encoded Polyline (algoritmo de
 * la Polylines API de Google), tal como viene en el campo `polyline` de las
 * rutas de UNE. Devuelve un arreglo de { lat, lng }.
 *
 * Referencia: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string, precision = 5): Coord[] {
  const coords: Coord[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    // Decodifica la diferencia de latitud.
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1
    lat += deltaLat

    // Decodifica la diferencia de longitud.
    result = 0
    shift = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1
    lng += deltaLng

    coords.push({ lat: lat / Math.pow(10, precision), lng: lng / Math.pow(10, precision) })
  }

  return coords
}
