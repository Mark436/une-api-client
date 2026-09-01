/**
 * Jerarquia de errores tipados del cliente.
 *
 * Todos heredan de `UneError`, asi que un solo `instanceof UneError` basta
 * para reconocer cualquier fallo de esta libreria. El `cause` conserva su
 * forma original para no romper a quien inspeccione `error.cause`.
 */

export class UneError extends Error {
  override readonly name: string = 'UneError'
}

/** `fetch` rechazo la peticion (red, DNS, CORS...). */
export class UneNetworkError extends UneError {
  override readonly name = 'UneNetworkError'
}

/** Credenciales invalidas o rechazadas por el API (HTTP 401/403). */
export class UneAuthError extends UneError {
  override readonly name = 'UneAuthError'
}

/**
 * El servidor respondio con un status HTTP !ok.
 * Expone `status`, extraido del `cause` ({ status, statusText, url }).
 */
export class UneHttpError extends UneError {
  override readonly name = 'UneHttpError'
  readonly status?: number

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    const causa = this.cause as { status?: unknown } | null
    if (causa && typeof causa === 'object' && typeof causa.status === 'number') {
      this.status = causa.status
    }
  }
}

/**
 * El payload crudo del API tiene una forma inesperada y no es posible
 * mapearlo. Expone en `cause` lo que realmente llego para inspeccionarlo.
 */
export class UneMappingError extends UneError {
  override readonly name = 'UneMappingError'
}

/**
 * Fallo en el ciclo de autenticacion con Firebase (signUp o token refresh).
 * Expone el metodo fallido en `cause` para diagnosticar.
 */
export class UneFirebaseError extends UneError {
  override readonly name = 'UneFirebaseError'
}
