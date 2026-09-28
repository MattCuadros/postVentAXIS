import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Momento de la compilación: el banner de mantenimiento lo compara con el último despliegue
  // para ofrecer "Actualizar" a quien tenga abierta una versión anterior.
  env: { BUILD_TIME: new Date().toISOString() },
};

export default nextConfig;
