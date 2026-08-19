"use client"

import "mapbox-gl/dist/mapbox-gl.css"

import { zodResolver } from "@hookform/resolvers/zod"
import exifr from "exifr"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Controller, useForm } from "react-hook-form"
import Map, { Marker, type MapRef } from "react-map-gl/mapbox"
import { toast } from "sonner"
import { CategoryPicker } from "@/components/category-picker"
import { StarRating } from "@/components/star-rating"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { createPlaceAction, createUploadSignature } from "@/actions/place"
import { placeFormSchema, type PlaceFormValues } from "@/schemas/place"

type ExifData = {
  latitude: number
  longitude: number
  createDate: Date
}

async function uploadToCloudinary(
  file: File,
  signature: string,
  timestamp: number
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const formData = new FormData()
  formData.append("file", file)
  formData.append("signature", signature)
  formData.append("timestamp", String(timestamp))
  formData.append("api_key", process.env.NEXT_PUBLIC_CLOUDINARY_KEY ?? "")

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
    { method: "POST", body: formData }
  )
  if (!res.ok) throw new Error("이미지 업로드에 실패했습니다")

  const json = (await res.json()) as { secure_url?: string }
  if (!json.secure_url) throw new Error("이미지 업로드 응답이 올바르지 않습니다")
  return json.secure_url
}

export function PlaceForm() {
  const router = useRouter()
  const lottieRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapRef>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [exif, setExif] = useState<ExifData | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PlaceFormValues>({
    resolver: zodResolver(placeFormSchema),
    defaultValues: { description: "", rating: 3, category: 1 },
  })

  // lottie-web 은 import 시점에 document 에 접근하므로 브라우저에서만 불러온다.
  // 옛 코드는 최상위 정적 import 를 해서 /create 의 SSR 이 깨졌다.
  useEffect(() => {
    let destroy: (() => void) | undefined

    void (async () => {
      if (!lottieRef.current) return
      const [{ default: lottie }, { default: animationData }] =
        await Promise.all([
          import("lottie-web"),
          import("@/assets/photo-upload.json"),
        ])
      const animation = lottie.loadAnimation({
        container: lottieRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        animationData,
      })
      destroy = () => animation.destroy()
    })()

    return () => destroy?.()
  }, [])

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return

    try {
      const parsed = await exifr.parse(selected)
      if (parsed?.latitude == null || parsed?.longitude == null) {
        toast.error("사진에 위치 정보가 없습니다. 다른 사진을 선택해 주세요.")
        event.target.value = ""
        return
      }

      setFile(selected)
      setExif({
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        createDate: parsed.CreateDate ?? new Date(selected.lastModified),
      })
      setPreview(URL.createObjectURL(selected))

      // 지도가 이미 떠 있는 상태(=사진을 다른 것으로 교체)라면 새 좌표로
      // 이동시킨다. 첫 사진은 initialViewState 가 좌표를 중심으로 잡아 주므로
      // 아직 마운트되지 않은 mapRef 는 무시해도 된다.
      mapRef.current?.panTo(
        { lng: parsed.longitude, lat: parsed.latitude },
        { duration: 3000 }
      )
    } catch {
      toast.error("사진을 읽지 못했습니다.")
      event.target.value = ""
    }
  }

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const onSubmit = async (values: PlaceFormValues) => {
    if (!file || !exif) {
      toast.error("사진을 먼저 선택해 주세요.")
      return
    }

    setSubmitting(true)
    try {
      const signatureResult = await createUploadSignature()
      if (!signatureResult.ok) {
        toast.error(signatureResult.error)
        setSubmitting(false)
        return
      }

      const imageUrl = await uploadToCloudinary(
        file,
        signatureResult.signature,
        signatureResult.timestamp
      )

      const result = await createPlaceAction({
        description: values.description,
        image: imageUrl,
        imageCreationTime: exif.createDate,
        latitude: exif.latitude,
        longitude: exif.longitude,
        rating: values.rating,
        category: values.category,
      })

      if (!result.ok) {
        toast.error(result.error)
        setSubmitting(false)
        return
      }

      // 성공 경로에서는 submitting 을 다시 풀지 않는다. router.push 는
      // await 하지 않으므로 클라이언트 내비게이션이 진행되는 동안 버튼을
      // 재활성화하면 빠른 재클릭이 createPlaceAction 을 한 번 더 실행해
      // 중복 Place 를 만들 수 있다. 페이지가 교체될 때까지 비활성 상태를 유지한다.
      toast.success("장소를 저장했습니다.")
      router.push("/map")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "저장 중 문제가 발생했습니다."
      )
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto max-w-xl space-y-6 px-4 py-10"
    >
      <div>
        <label
          htmlFor="photo"
          className="border-input hover:bg-accent relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors"
        >
          {preview ? (
            <Image
              src={preview}
              alt="선택한 사진"
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <div ref={lottieRef} className="h-32 w-32" />
          )}
        </label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onFileChange}
        />
        {exif && (
          <p className="text-muted-foreground mt-2 text-sm">
            촬영 위치 {exif.latitude.toFixed(5)}, {exif.longitude.toFixed(5)}
          </p>
        )}
      </div>

      {exif && (
        <div className="h-64 w-full overflow-hidden rounded-lg">
          <Map
            ref={mapRef}
            initialViewState={{
              longitude: exif.longitude,
              latitude: exif.latitude,
              zoom: 13,
            }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_TOKEN}
            style={{ width: "100%", height: "100%" }}
          >
            <Marker
              longitude={exif.longitude}
              latitude={exif.latitude}
              color="#ef4444"
            />
          </Map>
        </div>
      )}

      <Field>
        <FieldLabel htmlFor="description">설명</FieldLabel>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Textarea
              id="description"
              placeholder="이 장소는 어땠나요?"
              rows={3}
              {...field}
            />
          )}
        />
        <FieldError errors={[errors.description]} />
      </Field>

      <Field>
        <FieldLabel>별점</FieldLabel>
        <Controller
          control={control}
          name="rating"
          render={({ field }) => (
            <StarRating value={field.value} onChange={field.onChange} />
          )}
        />
        <FieldError errors={[errors.rating]} />
      </Field>

      <Field>
        <FieldLabel>카테고리</FieldLabel>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <CategoryPicker value={field.value} onChange={field.onChange} />
          )}
        />
        <FieldError errors={[errors.category]} />
      </Field>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "저장 중…" : "저장"}
      </Button>
    </form>
  )
}
