import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  rewrites: async () => {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.INTERNAL_API_URL}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${process.env.INTERNAL_API_URL_UPLOADS}/uploads/:path*`,
      },
    ]
  },
  experimental: {
    proxyClientMaxBodySize: '512mb',
    proxyTimeout: 600_000, // 10 minutes
  },
}

export default nextConfig
