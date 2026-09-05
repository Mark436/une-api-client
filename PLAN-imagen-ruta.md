# Plan — Exponer render↔consulta para generar imagen de ruta (SVG)

> Documento de trabajo (borrador). Revisar antes de implementar.

---

## Contexto / estado actual

Ya existe todo lo necesario en **capas separadas**, pero no hay un punto
conveniente que las una:

- **Consultas** (`src/index.ts`): `consultarRuta(identificador)` ya devuelve
  exactamente `{ ruta, paradas, camiones }` (la interface `InformacionRuta`) —
  todo lo que el render necesita.
- **Render** (`src/render/svgRuta.ts`): `rutaASvg(ruta, paradas, camiones,
dimensiones?)` es una **función pura** que devuelve un string SVG. Ya está
  re-exportada desde `src/index.ts:443`.

Hoy el consumidor (el bot) tendría que hacerlo manual:

```ts
const info = await client.consultarRuta('manga')
const svg = rutaASvg(info.ruta, info.paradas, info.camiones)
```

Esto queda acoplado a que el usuario conozca ambos. La idea es **mantener
separadas** la capa de consultas y la de render, y añadir un **puente fino**
(método de alto nivel) que combine ambas sin duplicar lógica.

---

## Objetivo (confirmado)

- Mantener el render como **SVG puro** (sin conversión a PNG por ahora).
- Mantener el render **separado de las consultas** (sigue siendo `rutaASvg`
  función pura, reutilizable sin red).
- Añadir el **método comodín** para que el bot genere la imagen de una ruta por
  nombre o id en un solo paso (`consultarRuta` + `rutaASvg`).

---

## Cambios propuestos

### 1. Nuevo método de alto nivel en `UneApiClient` → `src/index.ts`

Añadir un método `rutaASVG(identificador, dimensiones?)`:

```ts
async rutaASVG(identificador: string, dimensiones?: Dimensiones): Promise<string | null>
```

- Llama a `this.consultarRuta(identificador)`.
- Si devuelve `null` (no se resuelve a ruta única) → devuelve `null`.
- Si hay ruta → devuelve `rutaASvg(info.ruta, info.paradas, info.camiones,
dimensiones)`.
- Reutiliza la lógica existente; **no** duplica consultas ni render.

### 2. Nada cambia en la capa de consultas

Los métodos `consultarRuta`, `paradas`, `posiciones`, `listarRutas` **quedan
intactos** y siguen exportándose. Son los que el bot puede usar en un "programa
intermedio" dentro de sí mismo.

### 3. Re-export del tipo `Dimensiones`

El tipo `Dimensiones` ya se exporta (`src/index.ts:444`), así que el método
puede exponerlo como parámetro opcional.

### 4. Tests → `tests/client.test.ts` (o un test nuevo)

Añadir un test que:

- Simule `fetch` (Firebase) y `http` (API) como los existentes.
- Verifique que `rutaASVG('manga')` devuelve un string SVG que contiene el
  `path` del recorrido y los buses.
- Verifique que un identificador no resuelto devuelve `null`.

### 5. Documentación breve

Actualizar `ARCHITECTURE.md` (sección "Acceso a la API pública") para mostrar
el nuevo método de un solo paso.

---

## Archivos a tocar

| Archivo                | Cambio                                                         |
| ---------------------- | -------------------------------------------------------------- |
| `src/index.ts`         | Añadir método `rutaASVG` + imports de `Dimensiones`/`rutaASvg` |
| `tests/client.test.ts` | Añadir tests del nuevo método                                  |
| `ARCHITECTURE.md`      | Mostrar el nuevo acceso de un solo paso                        |

---

## Verificación

```
pnpm run build
pnpm test
pnpm run lint
pnpm run format:check
```

---

## Puntos a decidir

1. **Nombre del método**: propongo `rutaASVG(identificador, dimensiones?)`.
   ¿Otro (p. ej. `imagenRuta`, `svgRuta`)?
2. **Valor de retorno**: `string | null` (null si no se resuelve la ruta),
   coherente con `consultarRuta`. ¿OK?
3. **Estado del arte**: el método depende de que la API en vivo ya esté
   validada (PLAN.md #1 sigue pendiente), pero el código es offline-testable
   igual que el resto.
