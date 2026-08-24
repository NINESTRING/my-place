"use client"

import { CheckIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { deleteCategoryAction, updateCategoryAction } from "@/actions/category"
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
import { Input } from "@/components/ui/input"
import type { CategorySummary } from "@/lib/categories"

/**
 * CategoryPicker 의 "관리" 모드가 띄우는 목록. 행마다 이름 변경(인라인
 * 입력)과 삭제(확인 모달)를 제공한다.
 *
 * 별도 화면이 아니라 폼 안에 있는 이유는 생성과 같다 — 오타를 발견하는 곳이
 * 바로 이 선택지 목록이므로, 고치러 다른 데로 가게 하지 않는다.
 *
 * 이 컴포넌트는 장소 폼(form) 안에 렌더된다. 모든 버튼이 type="button" 인
 * 것과 Enter 를 가로채는 것은 그래서다 — 기본값(submit)이면 이름을 고치려던
 * 조작이 장소를 저장해 버린다.
 */
export function CategoryManager({
  categories,
  onRenamed,
  onDeleted,
}: {
  categories: CategorySummary[]
  onRenamed: (category: CategorySummary) => void
  onDeleted: (id: number) => void
}) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<CategorySummary | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  const startEdit = (category: CategorySummary) => {
    setEditingId(category.id)
    setEditName(category.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName("")
  }

  const saveEdit = async () => {
    if (editingId === null || saving) return

    const trimmed = editName.trim()
    if (!trimmed) return
    // 이름이 그대로면 서버까지 갈 것이 없다.
    if (trimmed === categories.find((c) => c.id === editingId)?.name) {
      cancelEdit()
      return
    }

    setSaving(true)
    try {
      const result = await updateCategoryAction({ id: editingId, name: trimmed })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onRenamed(result.category)
      cancelEdit()
    } catch {
      toast.error("이름 변경 중 문제가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting || deletePending) return

    setDeletePending(true)
    try {
      const result = await deleteCategoryAction(deleting.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onDeleted(deleting.id)
      setDeleting(null)
      toast.success("카테고리를 삭제했습니다.")
    } catch {
      toast.error("삭제 중 문제가 발생했습니다.")
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <>
      <ul className="divide-border divide-y rounded-lg border">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex min-h-11 items-center gap-2 px-3 py-1.5"
          >
            {editingId === category.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  maxLength={20}
                  autoFocus
                  aria-label={`${category.name} 새 이름`}
                  className="h-8 flex-1"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      void saveEdit()
                    }
                    if (event.key === "Escape") {
                      // Dialog(장소 폼을 담은 모달)의 Esc 닫기까지 올라가지
                      // 않게 여기서 끊는다 — 이 Esc 는 편집 취소다.
                      event.stopPropagation()
                      cancelEdit()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void saveEdit()}
                  disabled={saving || editName.trim() === ""}
                  aria-label="이름 저장"
                >
                  <CheckIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={cancelEdit}
                  disabled={saving}
                  aria-label="편집 취소"
                >
                  <XIcon />
                </Button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {category.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => startEdit(category)}
                  aria-label={`${category.name} 이름 변경`}
                >
                  <PencilIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeleting(category)}
                  aria-label={`${category.name} 삭제`}
                >
                  <Trash2Icon />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>

      <Dialog
        open={deleting !== null}
        // 삭제가 진행 중일 때는 닫히지 않게 한다 — 다른 모달들과 같은 처리다.
        onOpenChange={(next) => {
          if (!deletePending && !next) setDeleting(null)
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>카테고리를 삭제할까요?</DialogTitle>
            <DialogDescription>
              &lsquo;{deleting?.name ?? ""}&rsquo; 을(를) 지웁니다. 이
              카테고리를 쓰는 장소에서도 함께 사라집니다(장소 자체는
              남습니다). 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={deletePending}
            >
              취소
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deletePending}
            >
              {deletePending ? "삭제 중…" : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
