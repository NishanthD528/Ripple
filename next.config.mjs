/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint is run separately in CI; do not block production builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
