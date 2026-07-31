import type {
  NextConfig,
} from 'next';

const apiUrl =
  process.env
    .NEXT_PUBLIC_API_URL
    ?.replace(
      /\/+$/,
      '',
    );

const nextConfig:
  NextConfig = {
    reactCompiler: true,

    async rewrites() {
      if (!apiUrl) {
        return [];
      }

      return [
        {
          source:
            '/api/v1/:path*',

          destination:
            `${apiUrl}/api/v1/:path*`,
        },
      ];
    },
  };

export default nextConfig;