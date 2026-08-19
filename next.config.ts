import type { NextConfig } from "next"

// Free 플랜에서는 Supabase Storage 이미지 변환(/render/image)을 쓸 수 없으므로
// 최적화를 Next 내장 Image Optimization 이 담당한다. 그래서 커스텀 로더 대신
// remotePatterns 로 공개 객체 경로만 허용한다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL 이 필요합니다")
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(supabaseUrl).hostname,
        pathname: "/storage/v1/object/public/places/**",
      },
    ],
  },
}

export default nextConfig
