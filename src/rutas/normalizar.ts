/**
 * Utilidades puras de normalización de texto para la búsqueda de rutas.
 * Sin red, sin estado, sin dependencias de runtime.
 */

/** Quita acentos y diacríticos de una letra (á→a, ü→u...). */
function quitarAcentos(car: string): string {
  return car.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Normaliza un nombre de ruta o consulta para comparar de forma tolerante:
 * minúsculas, sin acentos, sin caracteres raros (conserva solo letras,
 * números y espacios) y espacios colapsados.
 *
 * Ej. "Línea 10  Caturegli" y "linea 10 caturegli" normalizan a lo mismo.
 */
export function normalizarTexto(texto: string): string {
  return quitarAcentos(texto)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
