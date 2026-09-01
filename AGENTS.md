# AGENTS.md — Guía de referencia para agentes

Documento de contexto para agentes/LLMs que trabajen sobre este repositorio.
**Léelo antes de modificar el código.** Refleja el estado actual del paquete.

> Documentación: [`README.md`](./README.md) (uso), [`PLAN.md`](./PLAN.md)
> (**estado real y pendientes — leer primero**), [`ARCHITECTURE.md`](./ARCHITECTURE.md)
> (estructura), [`api.md`](./api.md) (descubrimiento de la API real).

---

## ¿Qué es este proyecto?

`une-api-client`: consumidor TypeScript **no oficial** de la API de camiones
de UNE (Unión de Usuarios de Hermosillo), la que alimenta el mapa en vivo de
`https://unesonora.com/`.

- **ESM**, `strict`, sin dependencias de runtime (usa `fetch` global de Node
  `>=24`).
- Dueño del HTTP, del parseo y del mapeo a DTOs. El consumidor decide cuándo,
  cómo cachear y cómo presentar.
- **En fase de descubrimiento**: NO hay endpoints confirmados. Todo el DTO/
  mapper/cliente es un bosquejo provisional marcado `⚠️ Fase de prueba`.

---

## Estado real (importante)

- **Los DTOs, mappers y el cliente `UneApiClient` NO reflejan aún la API
  real.** Son un boceto para tener la estructura lista.
- El único paso que desbloquea el trabajo real es **descubrir los endpoints**
  con el script `src/discover.ts` (ver `PLAN.md` #1).
- El paquete todavía no tiene devDependencies instaladas (`npm install` no se
  corrió) ni `dist/` construido.

---

## Arquitectura (capas)

```
src/
  api/types.ts         Tipos CRUDOS con nombres tal como llegan del API
  dto/                 DTOs PÚBLICOS legibles (Camion, Ruta)
  mappers/             Funciones puras raw -> DTO (uno por DTO)
  errors.ts            Jerarquía UneError
  index.ts             UneApiClient (HTTP) + re-exports públicos
  discover.ts          Script manual (Playwright) — excluido de build y npm
tests/                 Suite unitaria offline (node:test vía tsx)
_samples/              Muestras reales (no versionado)
```

Principio: el paquete dueño hace HTTP + parseo + mapeo; el consumidor decide
cuándo/cómo. `package.json` `exports` sólo expone la raíz; los tipos públicos
se re-exportan desde `src/index.ts`.

---

## Cliente y errores

**`UneApiClient`** (bosquejo):

- `constructor(options?: { baseUrl?: string })` — default `https://unesonora.com/`.
- `fetchTodo(path?)` — método provisional; GET + mapea a `DatosUNE`.
- `static mapDatos(data)` — mapea payload crudo sin HTTP.

**Errores** (`src/errors.ts`), todos heredan de `UneError`:

| Clase             | Cuándo                               | Extra             |
| ----------------- | ------------------------------------ | ----------------- |
| `UneAuthError`    | HTTP 401/403                         |                   |
| `UneNetworkError` | red/DNS/CORS                         |                   |
| `UneHttpError`    | HTTP !ok ≠ 401/403, o cuerpo no-JSON | `.status`         |
| `UneMappingError` | payload malformado en `mapTodo`      | `cause` = payload |

---

## DTOs (FASE DE PRUEBA)

- **`Camion`**: `id`, `rutaId?`, `ubicacion { lat, lng }`, `timestamp?`.
- **`Ruta`**: `id`, `nombre`, `geometria?`, `paradas?`.

Ambos marcan `⚠️ Fase de prueba` en su JSDoc.

---

## Comandos

```bash
pnpm install       # devDeps (typescript, tsx, @types/node, oxlint, prettier, playwright)
pnpm run build     # tsc -> dist/
pnpm test          # suite unitaria offline (node:test vía tsx)
pnpm run lint      # oxlint (correctness + suspicious + typescript)
pnpm run format    # prettier --write . (config en .prettierrc.json)
pnpm run format:check   # verifica que todo siga el estilo sin modificar
npx tsx src/discover.ts   # descubrir endpoints (requiere playwright install)
```

## Convenciones

- **ESM**: imports internos con extensión `.js`.
- **Estilo**: todo el código se formatea con **Prettier** (`.prettierrc.json`) y se
  lintan con **oxlint** (`.oxlintrc.json`). **Sin punto y coma** (`semi: false`),
  comillas simples, ancho de 100. Corre `pnpm run lint` y `pnpm run format:check`
  tras tocar código.
- **Protocolo de verificación**: antes de dar por hecho un cambio, ejecutar
  `pnpm run build`, `pnpm test`, `pnpm run lint` y `pnpm run format:check`.
- **No añadas comentarios de especulación**; marca lo no confirmado con
  `⚠️ Fase de prueba` en el JSDoc.
- **Nuevos campos/DTOs públicos** deben re-exportarse desde `src/index.ts`.
- `src/discover.ts` no se publica (en `tsconfig.json` exclude y `.npmignore`).

---

## Pendientes (resumen; detalle en `PLAN.md`)

1. Descubrir endpoints reales (`discover.ts` + revisar `_samples/`).
2. Fijar forma real del payload (types, DTOs, mappers, mock, tests, cliente).
3. Conectar al bot `whatsapp-une-bot` (recrear mapa + enviar imagen).
4. Build y publicación (instalar devDeps, `LICENSE`, `.env.example`).

## Nota de infraestructura

La instalación del browser de Playwright en esta máquina viene fallando por
descargas corruptas (carpeta existe pero falta el exe). Ver `PLAN.md` #1 para
cómo limpiar antes de reintentar.
