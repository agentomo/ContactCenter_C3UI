import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    allowedDevOrigins: [
      'http://6000-firebase-studio-1749598868614.cluster-3ch54x2epbcnetrm6ivbqqebjk.cloudworkstations.dev',
      'http://9000-firebase-studio-1749598868614.cluster-3ch54x2epbcnetrm6ivbqqebjk.cloudworkstations.dev',
    ],
  },
};

export default nextConfig;
