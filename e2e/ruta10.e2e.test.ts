import test from 'node:test'
import assert from 'node:assert/strict'
import { UneApiClient } from '../src/index.js'

// ⚠️ Test E2E: consulta la API real de UNE (requiere red + UNE_FIREBASE_API_KEY).
// No forma parte de la suite unitaria offline (`pnpm test`); ejecutarlo con:
//   pnpm exec tsx --test e2e/ruta10.e2e.test.ts

const ID_RUTA = '10'
const NOMBRE_ESPERADO = 'Línea 2 Cárdenas - Cuauhtémoc'

test('busca la información de la ruta 10 (Cárdenas - Cuauhtémoc) en la API real', async () => {
  const client = new UneApiClient()

  const rutas = await client.listarRutas('1')
  const ruta = rutas.find((r) => r.id === ID_RUTA)

  assert.ok(ruta, `No se encontró la ruta con id ${ID_RUTA}`)
  assert.equal(ruta.id, ID_RUTA)
  assert.equal(ruta.nombre, NOMBRE_ESPERADO)

  // La ruta trae un grupo de camiones para consultar posiciones.
  assert.ok(ruta.groupId, 'La ruta debería tener un groupId')

  // El recorrido se decodifica desde la polilínea y está dentro de Hermosillo.
  assert.ok(ruta.recorrido.length > 0, 'La ruta debería tener un recorrido decodificado')
  for (const c of ruta.recorrido) {
    assert.ok(c.lat > 28 && c.lat < 30, `lat fuera de rango: ${c.lat}`)
    assert.ok(c.lng > -112 && c.lng < -110, `lng fuera de rango: ${c.lng}`)
  }

  // Metadatos de servicio (frecuencia, unidades, horario).
  assert.ok(ruta.metadata.distance, 'Debería haber distancia en metadata')
  assert.ok(ruta.metadata.service_units, 'Debería haber unidades de servicio en metadata')
})
