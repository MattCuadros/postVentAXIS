/**
 * Modo pruebas: mientras dure la etapa de testeo, el login ofrece un botón hacia `/pruebas` (el
 * selector de usuarios de ejemplo). Es `true` salvo que `NEXT_PUBLIC_MODO_PRUEBAS` valga
 * exactamente "false"; así el despliegue actual sigue funcionando sin configurar nada.
 *
 * Para salir de la etapa de pruebas: configurar NEXT_PUBLIC_MODO_PRUEBAS=false en Vercel y
 * volver a desplegar (las variables NEXT_PUBLIC_ se fijan al compilar).
 */
export function isTestMode(): boolean {
  return process.env.NEXT_PUBLIC_MODO_PRUEBAS !== "false";
}
