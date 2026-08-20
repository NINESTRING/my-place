"use client"

import { Controller, type Control, type FieldErrors } from "react-hook-form"
import { CategoryPicker } from "@/components/category-picker"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { PlaceFormValues } from "@/schemas/place"

/**
 * 등록 폼과 수정 폼이 함께 쓰는, 사용자가 직접 쓰는 세 필드.
 *
 * schemas/place.ts 가 placeFields 를 한 번만 정의하고 두 스키마가 확장하는
 * 것과 같은 이유다. 검증 규칙이 한 벌인데 그것을 그리는 마크업이 두 벌이면
 * 결국 어긋난다 — 상한을 한쪽만 고치거나, 선택 표시를 한쪽에만 붙이는 식으로.
 *
 * 사진·좌표는 여기 없다. 등록 폼에만 있고 수정에서는 다루지 않는다.
 */
export function PlaceFields({
  control,
  errors,
}: {
  control: Control<PlaceFormValues>
  errors: FieldErrors<PlaceFormValues>
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="title">제목</FieldLabel>
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <Input id="title" placeholder="장소 이름" {...field} />
          )}
        />
        <FieldError errors={[errors.title]} />
      </Field>

      <Field>
        <FieldLabel htmlFor="description">
          설명 <span className="text-muted-foreground font-normal">(선택)</span>
        </FieldLabel>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Textarea
              id="description"
              placeholder="이 장소는 어땠나요? (비워 둘 수 있어요)"
              rows={3}
              {...field}
            />
          )}
        />
        <FieldError errors={[errors.description]} />
      </Field>

      <Field>
        <FieldLabel id="category-label">
          카테고리{" "}
          <span className="text-muted-foreground font-normal">(선택)</span>
        </FieldLabel>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <CategoryPicker
              value={field.value}
              onChange={field.onChange}
              labelId="category-label"
            />
          )}
        />
        <FieldError errors={[errors.category]} />
      </Field>
    </>
  )
}
