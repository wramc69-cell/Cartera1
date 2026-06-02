
/**
 * Helper para manejar promesas con timeout.
 * Evita que la aplicación se quede bloqueada indefinidamente si Supabase no responde.
 */
export const withTimeout = <T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  operationName: string
): Promise<T> => {
  let timeoutId: any;
  
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.warn(`[TIMEOUT_TRIGGER] '${operationName}' falló por tiempo (${timeoutMs}ms)`);
      reject(new Error(`Timeout: La operación '${operationName}' excedió los ${timeoutMs / 1000}s`));
    }, timeoutMs);
  });

  return Promise.race([
    promise.then(
      val => {
        clearTimeout(timeoutId);
        return val;
      },
      err => {
        clearTimeout(timeoutId);
        throw err;
      }
    ),
    timeoutPromise
  ]);
};
