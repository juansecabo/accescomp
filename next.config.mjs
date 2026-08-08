/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // better-sqlite3 es un módulo nativo: no debe empaquetarse con webpack
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

export default nextConfig;
