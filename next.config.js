export default {
  allowedDevOrigins: ["localhost:3000", "127.0.0.1"],
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    inlineCss: true,
    clientSegmentCache: true,
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "zylq-002.dx.commercecloud.salesforce.com" },
      { protocol: "https", hostname: "edge.disstg.commercecloud.salesforce.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};
