"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import type { Place } from "@/generated/prisma/client"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { updatePlaceAction } from "@/actions/place"
import { PlaceFields } from "@/components/place-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { placeFormSchema, type PlaceFormValues } from "@/schemas/place"

/**
 * 수정 모달.
 *
 * 등록 폼과 나눠 둔 이유는 공유할 것이 거의 없어서다. place-form.tsx 의
 * 대부분은 사진 한 장을 다루는 일(드롭 존, EXIF 파싱, lottie, 미리보기 지도,
 * 서명 URL 업로드)인데 수정에는 하나도 필요 없다. 공유하는 것 — 세 필드 —
 * 만 PlaceFields 로 함께 쓴다.
 *
 * 닫혀도 언마운트되지 않는다(부모가 항상 렌더한다). 그래서 place 가 바뀔
 * 때마다 폼을 그 값으로 되돌려 준다. place 가 null 이 되는 것은 닫히는
 * 중이라는 뜻이므로 그때는 손대지 않는다 — 닫히는 애니메이션 도중에 입력이
 * 비워지는 것이 보인다.
 */
export function EditPlaceDialog({
  place,
  onOpenChange,
  onUpdated,
}: {
  place: Place | null
  onOpenChange: (open: boolean) => void
  onUpdated: (id: number, values: PlaceFormValues) => void
}) {
  const [saving, setSaving] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlaceFormValues>({
    resolver: zodResolver(placeFormSchema),
    defaultValues: { title: "", description: "", category: null },
  })

  useEffect(() => {
    if (!place) return
    reset({
      title: place.title,
      // Textarea 는 null 을 받으면 uncontrolled 로 떨어진다. DB 의 null 을
      // 빈 문자열로 펴서 넘긴다 — 스키마가 저장할 때 다시 접는다.
      description: place.description ?? "",
      category: place.category,
    })
  }, [place, reset])

  const onSubmit = async (values: PlaceFormValues) => {
    if (!place) return

    setSaving(true)
    try {
      const result = await updatePlaceAction({ id: place.id, ...values })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("장소를 수정했습니다.")
      onUpdated(place.id, values)
    } catch {
      // 서버 액션은 reject 로도 실패할 수 있다(네트워크 끊김, 배포 중 500 등).
      // try 로 감싸지 않으면 아래 finally 도 못 돌고 saving 이 true 에 갇혀
      // 모달이 영영 잠긴다 — 제출·취소 버튼 모두 disabled, Esc·바깥 클릭도
      // onOpenChange 의 saving 가드가 막는다.
      toast.error("수정 중 문제가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={place !== null}
      // 저장 중에는 바깥 클릭·Esc 로 닫히지 않게 한다. 닫혀도 액션은 계속
      // 진행되므로 "취소한 것처럼 보이는데 저장되는" 상태가 생긴다.
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next)
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>장소 수정</DialogTitle>
          <DialogDescription>
            제목과 설명, 카테고리를 고칠 수 있습니다. 사진과 촬영 위치는 사진에
            담긴 정보라 바꿀 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <PlaceFields control={control} errors={errors} />

          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={saving}
            >
              취소
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
