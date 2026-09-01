import test from 'node:test'
import assert from 'node:assert/strict'
import { mapCamion } from '../src/mappers/camion.mapper.js'
import { apiCamiones } from './helpers/mock.js'

test('mapCamion mapea un camion real del payload de locations', () => {
  const camion = mapCamion(apiCamiones[0])

  assert.equal(camion.id, 'H-218')
  assert.equal(camion.code, 'SIT-0036')
  assert.deepEqual(camion.ubicacion, { lat: 29.1549, lng: -111.0316 })
  assert.equal(camion.velocidad, '--')
  assert.equal(camion.rumbo, 238)
  assert.equal(camion.timestamp, '2026-09-01T00:40:51.000Z')
  assert.equal(camion.motorEncendido, 1)
  assert.equal(camion.groupId, '1002')
  assert.equal(camion.sentido, 1)
  assert.equal(camion.deshabilitado, false)
  assert.equal(camion.motivoInactividad, null)
  assert.equal(camion.paradaActual, '1001-75')
  assert.equal(camion.proximaParada, '1001-76')
  assert.equal(camion.enParada, false)
  assert.equal(camion.rutaId, '48')
})

test('mapCamion normaliza velocidad no numerica', () => {
  const camion = mapCamion(apiCamiones[0])
  assert.equal(camion.velocidad, '--')
})
