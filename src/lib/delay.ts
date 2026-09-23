/** Simula la latencia de una llamada a datos remota. */
export function delay(ms = 150): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
