"use client"

import "maplibre-gl/dist/maplibre-gl.css"

import { zodResolver } from "@hookform/resolvers/zod"
import exifr from "exifr"
// 타입만 쓴다. 값 import 는 아래 effect 의 동적 import 가 담당한다
// (lottie-web 은 모듈 평가 시점에 document 를 만진다).
import type { AnimationItem } from "lottie-web"
import Image from "next/image"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Controller, useForm } from "react-hook-form"
import Map, { Marker, type MapRef } from "react-map-gl/maplibre"
import { toast } from "sonner"
import { CategoryPicker } from "@/components/category-picker"
import { StarRating } from "@/components/star-rating"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { createPlaceAction, createUploadUrlAction } from "@/actions/place"
import { MAX_UPLOAD_BYTES } from "@/lib/images"
import { placeFormSchema, type PlaceFormValues } from "@/schemas/place"

type ExifData = {
  latitude: number
  longitude: number
  createDate: Date
}

/**
 * 서버가 발급한 서명 URL 로 파일을 직접 올린다. supabase-js 를 클라이언트
 * 번들에 넣지 않기 위해 raw fetch 를 쓴다.
 */
async function uploadToStorage(file: File, signedUrl: string): Promise<void> {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "content-type": file.type,
      // 파일명이 uuid 라 덮어쓰기·재사용이 없다. 무효화를 걱정할 필요가
      // 없으므로 1년 캐시로 이미지 최적화 재요청 비용을 줄인다.
      "cache-control": "public, max-age=31536000, immutable",
    },
    body: file,
  })
  if (!res.ok) {
    const body = await res.text()
    console.error("Storage 업로드 실패", res.status, body)
    throw new Error(`이미지 업로드에 실패했습니다 (${res.status})`)
  }
}

/**
 * 저장에 성공하면 `onCreated` 로 촬영 좌표를 넘긴다. 이 폼은 지도 위 모달에
 * 떠 있으므로 저장 후 페이지를 옮기지 않는다. 대신 부모가 모달을 닫고 그
 * 좌표로 지도를 이동시킨다.
 */
export function PlaceForm({
  onCreated,
}: {
  onCreated: (place: { latitude: number; longitude: number }) => void
}) {
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
  // 옛 코드는 최상위 정적 import 를 해서 이 폼을 담은 페이지의 SSR 이 깨졌다.
  useEffect(() => {
    let animation: AnimationItem | undefined
    let cancelled = false

    void (async () => {
      if (!lottieRef.current) return
      const [{ default: lottie }, { default: animationData }] =
        await Promise.all([
          import("lottie-web"),
          import("@/assets/photo-upload.json"),
        ])

      // cancelled 검사가 필요한 이유: Strict Mode(개발 모드)에서 이 effect 는
      // 마운트-언마운트-재마운트로 두 번 돈다. 위 동적 import 가 끝나기 전에
      // 첫 cleanup 이 실행되면 그 시점에는 아직 지울 애니메이션이 없어서,
      // 뒤늦게 만들어진 첫 애니메이션이 컨테이너에 그대로 남고 두 번째
      // 애니메이션이 그 아래에 덧붙는다 — SVG 두 개가 세로로 겹쳐 보인다.
      if (cancelled || !lottieRef.current) return

      animation = lottie.loadAnimation({
        container: lottieRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        animationData,
      })
    })()

    return () => {
      cancelled = true
      animation?.destroy()
    }
  }, [])

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return

    // 버킷의 file_size_limit(10MB)을 넘는 파일은 EXIF 파싱과 서명 URL
    // 발급을 거칠 필요 없이 여기서 바로 거부한다.
    if (selected.size > MAX_UPLOAD_BYTES) {
      toast.error("사진 용량이 너무 큽니다. 10MB 이하 사진을 선택해 주세요.")
      event.target.value = ""
      return
    }

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
      const uploadUrl = await createUploadUrlAction(file.type)
      if (!uploadUrl.ok) {
        toast.error(uploadUrl.error)
        setSubmitting(false)
        return
      }

      await uploadToStorage(file, uploadUrl.signedUrl)

      const result = await createPlaceAction({
        description: values.description,
        image: uploadUrl.path,
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

      // 성공 경로에서는 submitting 을 다시 풀지 않는다. 부모가 모달을 닫으면
      // 이 폼은 언마운트되므로 되돌릴 필요가 없고, 그 사이에 버튼을
      // 재활성화하면 빠른 재클릭이 createPlaceAction 을 한 번 더 실행해
      // 중복 Place 를 만들 수 있다.
      toast.success("장소를 저장했습니다.")
      onCreated({ latitude: exif.latitude, longitude: exif.longitude })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "저장 중 문제가 발생했습니다."
      )
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
          accept="image/jpeg,image/png,image/webp"
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
            mapStyle="https://tiles.openfreemap.org/styles/liberty"
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
