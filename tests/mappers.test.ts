import test from 'node:test'
import assert from 'node:assert/strict'
import { mapCiudades } from '../src/mappers/ciudad.mapper.js'
import { mapParada } from '../src/mappers/parada.mapper.js'
import { mapPuntoReferencia } from '../src/mappers/puntoReferencia.mapper.js'
import { UneMappingError } from '../src/errors.js'
import { apiCiudadesRespuesta, apiParadas, apiPuntosReferencia } from './helpers/mock.js'

test('mapCiudades mapea el contenedor de cities', () => {
  const ciudades = mapCiudades(apiCiudadesRespuesta)
  assert.equal(ciudades.length, 1)
  assert.equal(ciudades[0].id, '1')
  assert.equal(ciudades[0].nombre, 'Hermosillo')
  assert.equal(ciudades[0].color, '#E94D19')
  assert.deepEqual(ciudades[0].limites.ne, { lat: 29.174936, lng: -110.88565 })
  assert.equal(ciudades[0].limites.sw.lat, 29.010707)
  assert.equal(ciudades[0].routingHabilitado, true)
})

test('mapCiudades lanza UneMappingError ante payload malformado', () => {
  assert.throws(
    () => mapCiudades({ foo: 'bar' } as never),
    (err: unknown) => err instanceof UneMappingError,
  )
})

test('mapParada mapea una parada real', () => {
  const parada = mapParada(apiParadas[0])
  assert.equal(parada.id, 19306)
  assert.equal(parada.code, '101-BJGH')
  assert.equal(parada.nombre, 'Calle Garmendia y AV Dr. Alberto G Noriega')
  assert.deepEqual(parada.ubicacion, { lat: 29.08005417, lng: -110.95473647 })
  assert.equal(parada.rutas.length, 2)
  assert.equal(parada.rutas[1].id, '4')
  assert.equal(parada.rutas[1].nombre, 'LA-nea 1 Manga')
})

test('mapPuntoReferencia mapea un punto de referencia real', () => {
  const punto = mapPuntoReferencia(apiPuntosReferencia[0])
  assert.equal(punto.id, '198')
  assert.equal(punto.nombre, 'Garcia Morales HMO')
  assert.deepEqual(punto.ubicacion, { lat: 29.092057, lng: -111.039748 })
  assert.equal(punto.tipo, 1)
})
