"use client"

import "maplibre-gl/dist/maplibre-gl.css"

import { zodResolver } from "@hookform/resolvers/zod"
import exifr from "exifr"
// 타입만 쓴다. 값 import 는 아래 effect 의 동적 import 가 담당한다
// (lottie-web 은 모듈 평가 시점에 document 를 만진다).
import type { AnimationItem } from "lottie-web"
import Image from "next/image"
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react"
import { useForm } from "react-hook-form"
import Map, { Marker, type MapRef } from "react-map-gl/maplibre"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PlaceFields } from "@/components/place-fields"
import { createPlaceAction, createUploadUrlAction } from "@/actions/place"
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  pickImageFile,
} from "@/lib/images"
import { cn } from "@/lib/utils"
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [exif, setExif] = useState<ExifData | null>(null)
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PlaceFormValues>({
    resolver: zodResolver(placeFormSchema),
    defaultValues: { title: "", description: "", category: null },
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

  // 거부한 사진은 input 값을 비운다. 그러지 않으면 같은 사진을 다시 골라도
  // change 가 다시 발생하지 않아 안내 토스트조차 뜨지 않는다.
  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = ""
  }

  // 파일 선택 창과 드롭이 함께 쓰는 경로다. 드롭에는 리셋할 input 이벤트가
  // 없으므로 ChangeEvent 대신 File 을 받는다.
  const handleFile = async (selected: File) => {
    // 버킷의 file_size_limit(10MB)을 넘는 파일은 EXIF 파싱과 서명 URL
    // 발급을 거칠 필요 없이 여기서 바로 거부한다.
    if (selected.size > MAX_UPLOAD_BYTES) {
      toast.error("사진 용량이 너무 큽니다. 10MB 이하 사진을 선택해 주세요.")
      clearInput()
      return
    }

    try {
      const parsed = await exifr.parse(selected)
      if (parsed?.latitude == null || parsed?.longitude == null) {
        toast.error("사진에 위치 정보가 없습니다. 다른 사진을 선택해 주세요.")
        clearInput()
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
      clearInput()
    }
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (selected) void handleFile(selected)
  }

  // dragover 에서 preventDefault 를 해야 이 요소가 유효한 드롭 대상이 된다.
  // 이 한 줄이 없으면 브라우저는 드롭을 우리에게 넘기지 않고 기본 동작 —
  // 그 사진으로 페이지를 이동 — 을 실행한다. 사진이 새 탭에 열리고 업로드는
  // 시작조차 되지 않았던 것이 이 때문이다.
  const onDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    setDragging(true)
  }

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)

    const dropped = pickImageFile(event.dataTransfer.files)
    if (!dropped) {
      // 파일이 아예 없는 드롭은 다른 탭·앱에서 이미지를 끌어온 경우다.
      // 그때는 파일이 아니라 URL 만 넘어오므로 올릴 것이 없다.
      toast.error(
        event.dataTransfer.files.length === 0
          ? "사진 파일을 끌어다 놓아 주세요."
          : "JPG·PNG·WebP 사진만 올릴 수 있습니다."
      )
      return
    }

    void handleFile(dropped)
  }

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  // 드롭 존은 모달 안의 작은 사각형이라 조준을 살짝 놓치기 쉽다. 존 밖으로
  // 떨어진 파일은 기본 동작으로 넘어가 브라우저가 그 사진으로 이동해 버리고,
  // 채우던 폼이 통째로 날아간다. 폼이 떠 있는 동안은 존 밖의 드롭도 삼킨다.
  // 존의 핸들러가 먼저(React 는 document 에 위임하고 이 리스너는 그 위인
  // window 에 붙는다) 돌기 때문에 정상 드롭은 그대로 처리된다.
  //
  // 파일이 실린 드래그만 삼킨다. 전부 삼키면 설명 필드에 선택한 텍스트를
  // 끌어다 놓는 브라우저 기본 동작까지 같이 죽는다.
  useEffect(() => {
    const swallow = (event: globalThis.DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault()
    }
    window.addEventListener("dragover", swallow)
    window.addEventListener("drop", swallow)
    return () => {
      window.removeEventListener("dragover", swallow)
      window.removeEventListener("drop", swallow)
    }
  }, [])

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
        title: values.title,
        description: values.description,
        image: uploadUrl.path,
        imageCreationTime: exif.createDate,
        latitude: exif.latitude,
        longitude: exif.longitude,
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
        {/* 자식은 pointer-events 를 끈다. 자식이 드래그 대상이 되면 라벨
            내부에서 자식으로 넘어갈 때마다 dragleave 가 튀어 테두리 강조가
            깜빡인다. 라벨 자체는 그대로 클릭된다. */}
        <label
          htmlFor="photo"
          onDragEnter={onDragOver}
          onDragOver={onDragOver}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "border-input relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors",
            dragging ? "border-primary bg-accent" : "hover:bg-accent"
          )}
        >
          {preview ? (
            <Image
              src={preview}
              alt="선택한 사진"
              fill
              unoptimized
              className="pointer-events-none object-cover"
            />
          ) : (
            <div ref={lottieRef} className="pointer-events-none h-32 w-32" />
          )}
        </label>
        <input
          ref={inputRef}
          id="photo"
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
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

      <PlaceFields control={control} errors={errors} />

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "저장 중…" : "저장"}
      </Button>
    </form>
  )
}
