import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

export default function nextConfig(phase) {
  const development = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    reactStrictMode: true,
    trailingSlash: true,
    env: {
      NEXT_PUBLIC_SITE_URL: (process.env.SITE_URL || 'https://elijahmwangi.net').replace(
        /\/$/,
        ''
      ),
    },
    ...(development
      ? {
          // The production static host resolves directory indexes for the Decap editor.
          async rewrites() {
            return [{ source: '/admin/', destination: '/admin/index.html' }];
          },
        }
      : { output: 'export' }),
  };
}
