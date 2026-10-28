import type { NextConfig } from "next";
const nextConfig:NextConfig={reactStrictMode:true,...(process.env.CHATPIXEL_ANDROID_EXPORT?{output:"export" as const,images:{unoptimized:true}}:{})};
export default nextConfig;
