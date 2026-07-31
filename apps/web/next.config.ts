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

const securityHeaders = [
  {
    key:
      'X-Content-Type-Options',

    value:
      'nosniff',
  },

  {
    key:
      'X-Frame-Options',

    value:
      'DENY',
  },

  {
    key:
      'Referrer-Policy',

    value:
      'strict-origin-when-cross-origin',
  },

  {
    key:
      'Permissions-Policy',

    value:
      [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
      ].join(
        ', ',
      ),
  },

  {
    key:
      'Cross-Origin-Opener-Policy',

    value:
      'same-origin',
  },
];

const nextConfig:
  NextConfig = {
    reactCompiler:
      true,

    async headers() {
      return [
        {
          source:
            '/:path*',

          headers:
            securityHeaders,
        },
      ];
    },

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