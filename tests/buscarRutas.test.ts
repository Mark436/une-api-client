import test from 'node:test'
import assert from 'node:assert/strict'
import type { Ruta } from '../src/dto/Ruta.js'
import { buscarRutasPorNombre, numeroLineaDeRuta } from '../src/rutas/buscarRutas.js'
import { normalizarTexto } from '../src/rutas/normalizar.js'

function ruta(id: string, nombre: string): Ruta {
  return {
    id,
    nombre,
    groupId: id,
    recorrido: [],
    colorPrimario: null,
    colorSecundario: null,
    accesible: false,
    habilitado: true,
    metadata: {},
  }
}

// Rutas reales de Hermosillo (nombres limpios, según el HAR real).
const rutasHermosillo: Ruta[] = [
  ruta('4', 'Línea 1 Manga'),
  ruta('5', 'Línea 1 Sahuaro'),
  ruta('10', 'Línea 2 Cárdenas - Cuauhtémoc'),
  ruta('13', 'Línea 2 Periférico - Lomas'),
  ruta('48', 'Línea 10 Caturegli'),
  ruta('52', 'Línea 10 VH'),
  ruta('43', 'Línea 10 - California'),
  ruta('46', 'Línea 10 - Miguel Alemán'),
]

test('numeroLineaDeRuta extrae el número de línea del nombre', () => {
  assert.equal(numeroLineaDeRuta(ruta('48', 'Línea 10 Caturegli')), '10')
  assert.equal(numeroLineaDeRuta(ruta('10', 'Línea 2 Cárdenas - Cuauhtémoc')), '2')
  assert.equal(numeroLineaDeRuta(ruta('4', 'Línea 1 Manga')), '1')
  assert.equal(numeroLineaDeRuta(ruta('235', 'Alimentadora Parque Industrial')), null)
})

test('normalizarTexto tolera acentos, mayúsculas y espacios extra', () => {
  assert.equal(normalizarTexto('Línea 10  Caturegli'), 'linea 10 caturegli')
  assert.equal(normalizarTexto('linea 10 caturegli'), 'linea 10 caturegli')
  assert.equal(normalizarTexto('CÁRDENAS'), 'cardenas')
})

test('buscarRutasPorNombre: por alias parcial "caturegli" resuelve Línea 10 Caturegli (id 48)', () => {
  const res = buscarRutasPorNombre(rutasHermosillo, 'caturegli')
  assert.deepEqual(
    res.map((r) => r.id),
    ['48'],
  )
})

test('buscarRutasPorNombre: número + alias "10 caturegli" resuelve id 48', () => {
  const res = buscarRutasPorNombre(rutasHermosillo, '10 caturegli')
  assert.deepEqual(
    res.map((r) => r.id),
    ['48'],
  )
})

test('buscarRutasPorNombre: "línea 10 vh" resuelve id 52', () => {
  const res = buscarRutasPorNombre(rutasHermosillo, 'línea 10 vh')
  assert.deepEqual(
    res.map((r) => r.id),
    ['52'],
  )
})

test('buscarRutasPorNombre: solo "10" devuelve todas las líneas 10', () => {
  const res = buscarRutasPorNombre(rutasHermosillo, '10')
  assert.deepEqual(res.map((r) => r.id).sort(), ['43', '46', '48', '52'])
})

test('buscarRutasPorNombre: "2 cardenas" resuelve Línea 2 Cárdenas (id 10)', () => {
  const res = buscarRutasPorNombre(rutasHermosillo, '2 cardenas')
  assert.deepEqual(
    res.map((r) => r.id),
    ['10'],
  )
})

test('buscarRutasPorNombre: sin coincidencias devuelve lista vacía', () => {
  assert.deepEqual(buscarRutasPorNombre(rutasHermosillo, 'no existe'), [])
  assert.deepEqual(buscarRutasPorNombre(rutasHermosillo, ''), [])
})
