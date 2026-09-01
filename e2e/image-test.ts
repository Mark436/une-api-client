import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { UneApiClient, rutaASvg } from '../src/index.js'

// ⚠️ Test de imagen (E2E): consulta la API real de UNE, resuelve una ruta por
// nombre y genera un PNG del mapa (recorrido + paradas + camiones con rumbo).
//
// Ejecutar con:
//   pnpm exec tsx e2e/image-test.ts

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '_generadas')

async function main() {
  const client = new UneApiClient()

  // 1) Resolver la ruta por nombre.
  const coincidencias = await client.buscarRutasPorNombre('caturegli')
  if (coincidencias.length !== 1) {
    throw new Error(
      `Se esperaba una sola coincidencia para "caturegli", hay ${coincidencias.length}`,
    )
  }
  const ruta = coincidencias[0]
  console.log(`Resuelta por nombre: ${ruta.id} — ${ruta.nombre}`)

  // 2) Información completa (recorrido + paradas + unidades).
  const info = await client.consultarRuta('caturegli')
  if (!info) throw new Error('No se pudo resolver la ruta')
  console.log(
    `paradas: ${info.paradas.length} | unidades: ${info.camiones.length} | recorrido: ${info.ruta.recorrido.length} pts`,
  )

  // 3) Render a SVG y conversión a PNG.
  const svg = rutaASvg(info.ruta, info.paradas, info.camiones, { width: 1200, height: 900 })

  await mkdir(DIR, { recursive: true })
  const png = path.join(DIR, `ruta-${info.ruta.id}.png`)
  await writeFile(path.join(DIR, `ruta-${info.ruta.id}.svg`), svg, 'utf8')
  await sharp(Buffer.from(svg)).png().toFile(png)

  console.log(`Imagen generada: ${png}`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
