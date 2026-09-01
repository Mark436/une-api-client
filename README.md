# une-api-client

Cliente TypeScript no oficial para consumir la **API de camiones de UNE**
(Unión de Usuarios de Hermosillo), la cual alimenta el mapa en vivo de
`https://unesonora.com/`. Creado de forma independiente y sin relación oficial
con la institución.

> ⚠️ **Estado: la API real ya está descubierta y el cliente la implementa.**
> El código refleja los endpoints y el payload reales (confirmados desde un HAR
> de `unesonora.com`). `/cities`, `/routes` y `/locations/{group_id}` se
> validaron en vivo. Ver [`PLAN.md`](./PLAN.md) y [`api.md`](./api.md) para el
> estado real.

## ⚠️ Aviso importante

Esta librería es una implementación **no oficial** de un cliente para la API
de UNE. No está afiliada, respaldada ni aprobada por la Unión de Usuarios de
Hermosillo ni por ninguna autoridad. El uso es responsabilidad exclusiva del
usuario; el autor no se hace responsable de bloqueos, restricciones, errores,
cambios en el servicio o cualquier consecuencia derivada del uso.

## ¿Qué es este paquete?

- Un **consumidor limpio de la API**: dueño del HTTP, del parseo y del mapeo a
  DTOs tipados. El consumidor (p. ej. el bot `whatsapp-une-bot`) decide cuándo
  consultar, cómo cachear y cómo presentar.
- **Sin dependencias de runtime**: usa el `fetch` global de Node `>=24` (para
  el auth de Firebase) y un transporte HTTP propio tolerante a headers
  corruptos para la API de UNE.
- **Sin Playwright en el paquete publicado**. Playwright se usa sólo en un
  script de desarrollo (`src/discover.ts`) para descubrir los endpoints, y en
  el bot para _recrear_ el mapa; no forma parte de la librería.
- ESM, TypeScript estricto, tests 100% offline.

## ⚡ Guía rápida de uso

```ts
import { UneApiClient } from 'une-api-client'

const client = new UneApiClient() // auth anónima Firebase + api.unesonora.com

const ciudades = await client.listarCiudades() // Ciudad[]
const rutas = await client.listarRutas('1') // Ruta[] (Hermosillo)

// Para saber la posición de una ruta hay que usar su group_id:
const info = rutas.find((r) => r.id === '4') // p. ej. Línea 1 Manga
const camiones = await client.posiciones(info.groupId) // Camion[]

const paradas = await client.paradas('48') // Parada[]
const rps = await client.puntosReferencia() // PuntoReferencia[]
```

- El cliente **hace auth anónima de Firebase automáticamente** (signUp +
  refresh) y firma cada petición con el header `X-Firebase-Token` (~1h de
  vigencia, refresco automático).
- Usa un **transporte HTTP tolerante** a los headers corruptos que UNE manda en
  `/locations/*` (el `fetch` global no puede con ellos). El transporte es
  inyectable.
- `listarRutas().name` y `paradas().nombre` son `Ruta[]` / `Parada[]` públicos.
- No depende de Playwright ni de ninguna librería de runtime.

> ⚠️ `/cities`, `/routes` y `/locations/{group_id}` se validaron en vivo; el
> resto de endpoints se mapean por el HAR pero aún no se validan de punta a
> punta contra la API. Ver `PLAN.md`.

## 🗺️ Documentación

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — estructura y arquitectura del paquete.
- [`api.md`](./api.md) — estado del descubrimiento de la API real y glosario.
- [`PLAN.md`](./PLAN.md) — **estado actual y pendientes** (leer primero).

## 🧪 Pruebas

Suite unitaria offline (nunca toca la API real):

```bash
pnpm test
```

## 📝 Licencia

MIT
