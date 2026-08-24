"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createCategoryAction } from "@/actions/category"
import { CategoryManager } from "@/components/category-manager"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  toCategoryIds,
  withCategory,
  withoutCategory,
  withUpdatedCategory,
  type CategoryWithShare,
} from "@/lib/categories"

/**
 * 내 카테고리들 중 여러 개를 고르고, 그 자리에서 새 카테고리를 만들거나
 * ("추가") 이름을 고치고 지울 수도("관리") 있는 필드. 별도 화면이면 등록
 * 도중에 폼을 떠나야 하므로 전부 인라인로 둔다.
 *
 * 목록 변경은 종류를 가리지 않고 onCategoriesChange(다음 목록) 하나로
 * 부모에게 올린다 — 생성·변경·삭제 콜백을 각각 네 단계로 내리꽂지 않는다.
 */
export function CategoryPicker({
  value,
  onChange,
  categories,
  onCategoriesChange,
  labelId,
}: {
  value: number[]
  onChange: (value: number[]) => void
  /** 고를 수 있는 내 카테고리 전부. 부모(PlaceExplorer)가 들고 있다. */
  categories: CategoryWithShare[]
  onCategoriesChange: (categories: CategoryWithShare[]) => void
  /** 그룹을 이름 붙이는 FieldLabel 의 id. aria-labelledby 로 연결한다. */
  labelId?: string
}) {
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const [managing, setManaging] = useState(false)

  const create = async () => {
    // 클라이언트에서도 빈 이름을 거른다. 서버 스키마가 어차피 거부하지만,
    // 실수로 누른 빈 제출에 왕복과 오류 토스트를 치를 일은 아니다.
    const trimmed = name.trim()
    if (!trimmed || creating) return

    setCreating(true)
    try {
      const result = await createCategoryAction(trimmed)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      // 같은 이름을 다시 만들면 서버가 기존 행을 돌려준다(멱등). 어느 쪽이든
      // 목록에 넣고 곧바로 선택 상태로 만든다 — 만든 카테고리를 목록에서
      // 다시 찾아 누르게 하지 않는다.
      //
      // 서버 액션은 id·name 만 돌려준다. 방금 만든(또는 이미 있던 같은 이름의)
      // 카테고리에 공유 상태가 이미 있을 수 있지만, 멱등 생성이 기존 행을
      // 돌려준 경우 그 행은 이미 목록에 있어 withCategory 가 버린다 — 새로
      // 들어가는 것은 항상 방금 만든 비공유 행뿐이다.
      onCategoriesChange(
        withCategory(categories, {
          ...result.category,
          shareEnabled: false,
          shareToken: null,
        })
      )
      if (!value.includes(result.category.id)) {
        onChange([...value, result.category.id])
      }
      setName("")
    } catch {
      toast.error("카테고리 추가 중 문제가 발생했습니다.")
    } finally {
      setCreating(false)
    }
  }

  const onDeleted = (id: number) => {
    const next = withoutCategory(categories, id)
    onCategoriesChange(next)
    // 폼 값에서도 뺀다. 남겨 두면 제출이 서버의 소유 대조에서 실패한다.
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    }
    // 마지막 하나를 지웠으면 관리할 것이 없다. 켜 둔 채 두면 다음에 만드는
    // 카테고리가 곧바로 관리 화면으로 뜬다.
    if (next.length === 0) setManaging(false)
  }

  return (
    <div className="space-y-2">
      {managing && categories.length > 0 ? (
        <CategoryManager
          categories={categories}
          onRenamed={(category) =>
            onCategoriesChange(withUpdatedCategory(categories, category))
          }
          onShareChanged={(category) =>
            onCategoriesChange(withUpdatedCategory(categories, category))
          }
          onDeleted={onDeleted}
        />
      ) : (
        categories.length > 0 && (
          <ToggleGroup
            multiple
            value={value.map(String)}
            onValueChange={(next) => onChange(toCategoryIds(next))}
            variant="outline"
            aria-labelledby={labelId}
            // 항목 수에 상한이 없으므로 좁은 화면에서 한 줄에 들어가지 않는다.
            // ToggleGroup 의 기본 클래스가 w-fit 이므로 max-w-full 을 함께 줘야
            // 접힌다.
            className="max-w-full flex-wrap justify-start"
          >
            {categories.map((category) => (
              <ToggleGroupItem key={category.id} value={String(category.id)}>
                {category.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )
      )}

      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="새 카테고리 이름"
          maxLength={20}
          aria-label="새 카테고리 이름"
          // 이 필드는 장소 폼 안에 있다. Enter 의 기본 동작(폼 제출)을
          // 가로채지 않으면 카테고리를 추가하려던 Enter 가 장소를 저장한다.
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              void create()
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void create()}
          disabled={creating || name.trim() === ""}
          className="shrink-0"
        >
          {creating ? "추가 중…" : "추가"}
        </Button>
        {categories.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setManaging((on) => !on)}
            aria-pressed={managing}
            className="shrink-0"
          >
            {managing ? "관리 끝" : "관리"}
          </Button>
        )}
      </div>
    </div>
  )
}
