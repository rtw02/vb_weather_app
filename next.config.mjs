/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pure static site (no server features) → exported to ./out for CDN hosting.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
