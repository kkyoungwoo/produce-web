import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    '/api/mp4Creater/render': ['./ffmpeg/bin/**/*', './node_modules/ffmpeg-static/**/*'],
  },
};

export default nextConfig;
