"use client"

/**
 * next/image 커스텀 로더.
 * DB에 저장된 값은 Cloudinary secure_url 전체이지만, 화면에서는
 * publicIdFromUrl()로 잘라낸 publicId를 src로 넘긴다.
 */
export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const params = ["f_auto", "c_limit", `w_${width}`, `q_${quality ?? "auto"}`]
  return `https://res.cloudinary.com/${cloudName}/image/upload/${params.join(",")}/${src}`
}
