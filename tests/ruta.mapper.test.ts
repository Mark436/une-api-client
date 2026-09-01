import test from 'node:test'
import assert from 'node:assert/strict'
import { decodePolyline } from '../src/mappers/decodePolyline.js'
import { mapRuta } from '../src/mappers/ruta.mapper.js'
import { apiRutas } from './helpers/mock.js'

test('decodePolyline decodifica una polilinea real de UNE (Hermosillo)', () => {
  // Segmento de la ruta "Alimentadora Parque Industrial" (apiRutas[0]).
  const encoded = 'srgpDjkfdTlALfJ`A|@ZxEf@hJbAlBRr@E|@iDdBoKhAwGrByLhBmKjBuKrAyG'
  const coords = decodePolyline(encoded)
  // Coordenadas dentro del rango de Hermosillo.
  assert.ok(coords.length > 0)
  for (const c of coords) {
    assert.ok(c.lat > 28 && c.lat < 30, `lat fuera de rango: ${c.lat}`)
    assert.ok(c.lng > -112 && c.lng < -110, `lng fuera de rango: ${c.lng}`)
  }
  // El recorrido decodificado se reutiliza en el mapper de rutas.
  const ruta = mapRuta(apiRutas[0])
  assert.equal(ruta.recorrido.length, coords.length)
})

test('mapRuta mapea una ruta real del payload de routes', () => {
  const ruta = mapRuta(apiRutas[0])

  assert.equal(ruta.id, '235')
  assert.equal(ruta.nombre, 'ALimetadora Parque Industrial')
  assert.equal(ruta.groupId, 'API01')
  assert.ok(Array.isArray(ruta.recorrido))
  assert.ok(ruta.recorrido.length > 0)
  assert.equal(ruta.colorPrimario, '#55FF00')
  assert.equal(ruta.colorSecundario, '#55FF00')
  assert.equal(ruta.accesible, false)
  assert.equal(ruta.habilitado, true)
})

test('mapRuta conserva los metadatos', () => {
  const ruta = mapRuta(apiRutas[1])
  assert.equal(ruta.metadata.distance, '49940')
  assert.equal(ruta.metadata.service_units, '10')
})
