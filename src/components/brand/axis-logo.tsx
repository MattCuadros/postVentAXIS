import Image from "next/image";

/**
 * Logo oficial Axis. Se usa siempre la imagen original, sin recolorear ni
 * deformar. Ancho mínimo en pantalla: 120 px.
 */
export function AxisLogo({ width = 140, priority = false }: { width?: number; priority?: boolean }) {
  const safeWidth = Math.max(width, 120);
  return (
    <Image
      src="/brand/logo-axis-600.png"
      alt="Axis Desarrollos Constructivos"
      width={safeWidth}
      height={Math.round((safeWidth * 368) / 600)}
      priority={priority}
    />
  );
}
