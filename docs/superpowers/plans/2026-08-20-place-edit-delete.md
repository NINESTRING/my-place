# 장소 수정·삭제 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 목록 카드의 케밥(⋮) 메뉴로 장소를 수정·삭제할 수 있게 한다.

**Architecture:** 서버 액션 두 개(`updatePlaceAction`, `deletePlaceAction`)가 소유자 조건을 SQL `where`에 넣어 인가를 처리하고, 삭제는 DB 행을 지운 뒤 Storage 사진을 best-effort로 지운다. UI는 목록 패널의 각 카드 위에 케밥 메뉴를 띄워 수정 모달과 삭제 확인 모달로 보낸다. 등록 폼과 수정 폼은 제목·설명·카테고리 세 필드를 `PlaceFields` 컴포넌트로 공유한다.

**Tech Stack:** Next.js 16 (App Router, 서버 액션), React 19, Prisma 7, Supabase (Auth·Storage), zod 4, react-hook-form, shadcn/base-nova + `@base-ui/react`, Tailwind 4, vitest.

**설계 문서:** `docs/superpowers/specs/2026-08-20-place-edit-delete-design.md`

## Global Constraints

- 모든 주석·UI 문구·커밋 메시지는 한국어로 쓴다. 기존 코드의 주석 밀도와 어조를 따른다 — "무엇을"이 아니라 "왜"를 적는다.
- 검증 규칙은 `src/schemas/place.ts`의 `placeFields`를 재사용한다. 같은 필드를 두 번 정의하지 않는다.
- 서버 액션은 반드시 `getCurrentUserId()`로 세션을 확인하고, 행 소유권은 Prisma `where: { id, userId }`로 건다. 조회 후 비교하는 방식을 쓰지 않는다.
- 액션 반환은 기존 `ActionResult<T>` 유니온을 그대로 쓴다. 예외를 클라이언트로 던지지 않는다.
- 실패 문구 상수: 미인증은 기존 `UNAUTHENTICATED`(`"로그인이 필요합니다"`), 없거나 남의 장소는 새 상수 `NOT_FOUND`(`"장소를 찾을 수 없습니다"`).
- 사진·좌표·촬영시각은 수정 대상이 아니다. 수정 스키마와 폼 어디에도 넣지 않는다.
- 파일 참조 경로는 `@/` 별칭을 쓴다.
- 각 태스크 끝에서 `npx tsc --noEmit`과 `npm test`가 통과해야 한다.
- 커밋 메시지 형식은 기존 이력을 따른다: `feat: Add/…`, `refactor: Change/…`, `docs: Update/…`.

---

### Task 1: 수정 입력 스키마

**Files:**
- Modify: `src/schemas/place.ts` (파일 끝, `placeFormSchema` 다음)
- Test: `src/schemas/place.test.ts`

**Interfaces:**
- Consumes: 기존 `placeFields` (같은 파일의 모듈 지역 상수)
- Produces:
  - `placeIdSchema: z.ZodNumber` — 양의 정수
  - `placeUpdateSchema: z.ZodObject<{ id, title, description, category }>`
  - `type PlaceUpdateInput = { id: number; title: string; description?: string; category: PlaceCategory | null }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/schemas/place.test.ts` 맨 위 import를 다음으로 바꾼다.

```ts
import { describe, expect, it } from "vitest"
import {
  boundsQuerySchema,
  placeInputSchema,
  placeUpdateSchema,
} from "@/schemas/place"
```

`describe("boundsQuerySchema", …)` 블록 **앞에** 다음을 추가한다.

```ts
describe("placeUpdateSchema", () => {
  const validUpdate = {
    id: 1,
    title: "한강 야경",
    description: "다리 조명이 켜지는 시간에 갔다",
    category: "SCENERY",
  }

  it("올바른 입력을 통과시킨다", () => {
    const result = placeUpdateSchema.safeParse(validUpdate)
    expect(result.success).toBe(true)
  })

  it("id 가 0이면 거부한다", () => {
    const result = placeUpdateSchema.safeParse({ ...validUpdate, id: 0 })
    expect(result.success).toBe(false)
  })

  it("id 가 음수면 거부한다", () => {
    const result = placeUpdateSchema.safeParse({ ...validUpdate, id: -1 })
    expect(result.success).toBe(false)
  })

  it("id 가 소수면 거부한다", () => {
    const result = placeUpdateSchema.safeParse({ ...validUpdate, id: 1.5 })
    expect(result.success).toBe(false)
  })

  it("id 가 숫자 문자열이면 거부한다", () => {
    // 액션 인자는 클라이언트가 보낸 값이다. 강제 변환을 걸어 두면 ""나 null
    // 같은 값이 0으로 접혀 들어온다.
    const result = placeUpdateSchema.safeParse({ ...validUpdate, id: "1" })
    expect(result.success).toBe(false)
  })

  it("공백만 있는 제목은 거부한다", () => {
    const result = placeUpdateSchema.safeParse({ ...validUpdate, title: "   " })
    expect(result.success).toBe(false)
  })

  it("제목이 60자를 넘으면 거부한다", () => {
    const result = placeUpdateSchema.safeParse({
      ...validUpdate,
      title: "가".repeat(61),
    })
    expect(result.success).toBe(false)
  })

  it("설명을 생략해도 통과한다", () => {
    const { description: _description, ...withoutDescription } = validUpdate
    const result = placeUpdateSchema.safeParse(withoutDescription)
    expect(result.success).toBe(true)
  })

  it("빈 설명은 undefined 로 접힌다", () => {
    const result = placeUpdateSchema.safeParse({
      ...validUpdate,
      description: "   ",
    })
    expect(result.success).toBe(true)
    expect(result.data?.description).toBeUndefined()
  })

  it("카테고리가 null 이어도 통과한다", () => {
    const result = placeUpdateSchema.safeParse({
      ...validUpdate,
      category: null,
    })
    expect(result.success).toBe(true)
  })

  it("사진·좌표를 함께 보내도 결과에서 떨어져 나간다", () => {
    // 수정으로 바꿀 수 있는 것은 사용자가 쓴 세 필드뿐이다. EXIF 에서 온
    // 값들이 이 경로로 흘러들지 않는다는 것을 스키마가 보장한다.
    const result = placeUpdateSchema.safeParse({
      ...validUpdate,
      image: "11111111-2222-3333-4444-555555555555/x.jpg",
      latitude: 0,
      longitude: 0,
    })
    expect(result.success).toBe(true)
    expect(result.data).not.toHaveProperty("image")
    expect(result.data).not.toHaveProperty("latitude")
    expect(result.data).not.toHaveProperty("longitude")
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test`
Expected: FAIL — `placeUpdateSchema` is not exported / undefined

- [ ] **Step 3: 스키마를 추가한다**

`src/schemas/place.ts`의 `export type PlaceFormValues = z.infer<typeof placeFormSchema>` 아래에 붙인다.

```ts
/**
 * 행 식별자. Place.id 는 `Int @default(autoincrement())` 이므로 양의 정수다.
 *
 * z.coerce 를 쓰지 않는 것이 의도적이다. 이 값은 클라이언트가 보내는 액션
 * 인자이고, 강제 변환을 걸면 null·""·[] 이 전부 0 으로 접혀 들어온다.
 */
export const placeIdSchema = z.number().int().positive()

/**
 * 수정 액션의 입력. placeFields 를 그대로 확장하므로 등록과 수정의 검증
 * 규칙이 갈라질 수 없다.
 *
 * 사진·좌표·촬영시각은 여기 없다. EXIF 가 준 사실 데이터이며, 사진을 바꾸면
 * 좌표와 시각도 함께 바뀌므로 그것은 수정이 아니라 다른 장소다. z.object 가
 * 모르는 키를 떨궈 주므로 클라이언트가 함께 보내도 무시된다.
 */
export const placeUpdateSchema = z.object({
  id: placeIdSchema,
  ...placeFields,
})

export type PlaceUpdateInput = z.infer<typeof placeUpdateSchema>
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test`
Expected: PASS (기존 81개 + 새 11개)

- [ ] **Step 5: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 출력 없음

- [ ] **Step 6: 커밋**

```bash
git add src/schemas/place.ts src/schemas/place.test.ts
git commit -m "$(cat <<'EOF'
feat: Add/수정 입력 스키마를 더한다

placeFields 를 확장해 id 를 얹는다. 사진·좌표는 수정 대상이 아니므로
z.object 가 떨궈 낸다.
EOF
)"
```

---

### Task 2: 수정·삭제 서버 액션

**Files:**
- Modify: `src/actions/place.ts`

**Interfaces:**
- Consumes: `placeIdSchema`, `placeUpdateSchema` (Task 1), 기존 `getCurrentUserId`, `prisma`, `supabaseAdmin`, `PLACES_BUCKET`, `isOwnedImagePath`, `ActionResult`, `UNAUTHENTICATED`
- Produces:
  - `updatePlaceAction(input: unknown): Promise<ActionResult<object>>`
  - `deletePlaceAction(input: unknown): Promise<ActionResult<object>>`

이 저장소에는 DB를 띄우는 테스트 인프라가 없다(기존 테스트는 전부 순수 함수·스키마다). 이 태스크는 타입 검사와 Task 3·5의 수동 확인으로 검증한다. 테스트 인프라를 새로 들이지 않는다.

- [ ] **Step 1: import 와 문구 상수를 추가한다**

`src/actions/place.ts` 상단 import에서 스키마 import를 다음으로 바꾼다.

```ts
import {
  placeIdSchema,
  placeInputSchema,
  placeUpdateSchema,
} from "@/schemas/place"
```

`const UNAUTHENTICATED = "로그인이 필요합니다"` 아래에 추가한다.

```ts
// 없는 장소와 남의 장소를 같은 문구로 묶는다. 갈라 놓으면 남의 행이
// 존재하는지가 응답으로 새어 나간다.
const NOT_FOUND = "장소를 찾을 수 없습니다"
```

- [ ] **Step 2: updatePlaceAction 을 쓴다**

`createPlaceAction` 아래에 붙인다.

```ts
/**
 * 사용자가 쓴 세 필드(제목·설명·카테고리)를 고친다.
 *
 * 소유권을 `where` 에 넣는 것이 요점이다. findFirst 로 읽어 userId 를 비교한
 * 뒤 update 하면 두 문장 사이에 창이 생기고, 검사와 갱신이 서로 다른 조건을
 * 보게 될 여지가 남는다. 조건을 SQL 한 문장에 넣으면 갱신된 행 수가 곧
 * 인가 결과다.
 */
export async function updatePlaceAction(
  input: unknown
): Promise<ActionResult<object>> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { ok: false, error: UNAUTHENTICATED }
  }

  const parsed = placeUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다",
    }
  }

  const { id, title, description, category } = parsed.data

  try {
    const { count } = await prisma.place.updateMany({
      where: { id, userId },
      data: {
        title,
        // 스키마가 빈 설명을 undefined 로 접는데, Prisma 는 undefined 를
        // "이 컬럼은 건드리지 않음" 으로 읽는다. 그대로 넘기면 설명을 지운
        // 수정이 조용히 무시되어 옛 설명이 남는다. null 로 바꿔 비운다.
        description: description ?? null,
        category,
        // schema.prisma 의 updatedAt 은 @default(now()) 뿐이고 @updatedAt 이
        // 없다. 여기서 넣지 않으면 생성 시각에 머문다.
        updatedAt: new Date(),
      },
    })

    if (count === 0) {
      return { ok: false, error: NOT_FOUND }
    }

    revalidatePath("/")
    return { ok: true }
  } catch {
    return { ok: false, error: "수정에 실패했습니다" }
  }
}
```

- [ ] **Step 3: deletePlaceAction 을 쓴다**

바로 아래에 붙인다.

```ts
/**
 * 장소를 지운다. DB 행과 Storage 사진을 함께 없앤다.
 *
 * 순서가 DB 먼저인 것이 중요하다. 두 저장소에 걸친 삭제라 어느 쪽이든 중간에
 * 실패할 수 있는데, Storage 를 먼저 지우면 실패 지점에서 "행은 남았는데 사진만
 * 404 인 카드" 가 화면에 남는다. 반대 순서의 최악은 아무도 참조하지 않는 파일
 * 하나가 버킷에 남는 것이고, 이건 보이지도 않고 나중에 일괄 정리할 수 있다.
 * 그래서 Storage 삭제는 best-effort 로 두고 실패해도 사용자에게는 성공으로
 * 답한다 — 그의 관점에서 삭제는 실제로 끝났다.
 */
export async function deletePlaceAction(
  input: unknown
): Promise<ActionResult<object>> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { ok: false, error: UNAUTHENTICATED }
  }

  const parsed = placeIdSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: NOT_FOUND }
  }

  const id = parsed.data

  // 지울 사진 경로를 알아야 하므로 한 번 읽는다. 여기서도 소유자 조건을
  // where 에 넣어 남의 행이 조회되지 않게 한다.
  const place = await prisma.place.findFirst({
    where: { id, userId },
    select: { image: true },
  })
  if (!place) {
    return { ok: false, error: NOT_FOUND }
  }

  try {
    await prisma.place.deleteMany({ where: { id, userId } })
  } catch {
    return { ok: false, error: "삭제에 실패했습니다" }
  }

  // supabaseAdmin 은 service role 이라 RLS 를 우회한다. 경로는 방금 소유권을
  // 확인한 행에서 읽은 값이지만, 등록 시점 검증을 빠져나온 낡은 행이 있다면
  // 그 경로가 그대로 admin 클라이언트에 넘어간다. 한 줄로 막는다.
  if (isOwnedImagePath(place.image, userId)) {
    const { error } = await supabaseAdmin.storage
      .from(PLACES_BUCKET)
      .remove([place.image])
    if (error) {
      console.error("Storage 객체 삭제 실패", place.image, error)
    }
  }

  revalidatePath("/")
  return { ok: true }
}
```

- [ ] **Step 4: 타입 검사와 테스트**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 출력 없음, 테스트 92개 통과

- [ ] **Step 5: 커밋**

```bash
git add src/actions/place.ts
git commit -m "$(cat <<'EOF'
feat: Add/장소 수정·삭제 서버 액션을 더한다

소유권은 where 에 넣어 조회와 갱신 사이의 창을 없앤다. 삭제는 DB 행을
먼저 지우고 Storage 사진은 best-effort 로 정리한다.
EOF
)"
```

---

### Task 3: 케밥 메뉴와 삭제 흐름

이 태스크가 끝나면 삭제가 처음부터 끝까지 동작한다.

**Files:**
- Create: `src/components/ui/dropdown-menu.tsx` (shadcn CLI)
- Create: `src/components/place-card-menu.tsx`
- Create: `src/components/delete-place-dialog.tsx`
- Modify: `src/components/place-list-panel.tsx`
- Modify: `src/components/place-explorer.tsx`

**Interfaces:**
- Consumes: `deletePlaceAction` (Task 2)
- Produces:
  - `PlaceCardMenu({ title, onDelete }: { title: string; onDelete: () => void })` — Task 5에서 수정 항목이 붙는다
  - `DeletePlaceDialog({ open, title, onOpenChange, onConfirm, pending }: { open: boolean; title: string; onOpenChange: (open: boolean) => void; onConfirm: () => void; pending: boolean })`
  - `PlaceListPanel` props에 `onDelete: (place: Place) => void` 추가

- [ ] **Step 1: dropdown-menu 를 받는다**

Run: `npx shadcn@latest add dropdown-menu`

- [ ] **Step 2: 레지스트리 내부 경로 import 를 고친다**

Run: `grep -n "IconPlaceholder\|@/registry" src/components/ui/dropdown-menu.tsx`

출력이 없으면(CLI가 이미 치환했으면) 이 스텝은 끝이다. 남아 있으면 다음처럼 고친다.

- `import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder"` → `import { CheckIcon, ChevronRightIcon } from "lucide-react"`
- `DropdownMenuSubTrigger` 안의 `<IconPlaceholder lucide="ChevronRightIcon" … className="cn-rtl-flip ml-auto" />` → `<ChevronRightIcon className="cn-rtl-flip ml-auto" />`
- `DropdownMenuCheckboxItem`·`DropdownMenuRadioItem` 안의 `<IconPlaceholder lucide="CheckIcon" … />` → `<CheckIcon />`
- `@/registry/base-nova/lib/utils` → `@/lib/utils`

Run: `npx tsc --noEmit`
Expected: 출력 없음

- [ ] **Step 3: PlaceCardMenu 를 만든다**

Create `src/components/place-card-menu.tsx`:

```tsx
"use client"

import { MoreVerticalIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * 목록 카드의 케밥 메뉴. 수정과 삭제로 가는 입구다.
 *
 * hover 로 나타나게 하지 않고 항상 띄운다. 이 앱은 사진을 찍은 자리에서
 * 폰으로 보는 쪽이 주 사용처인데, 거기에는 hover 가 없다.
 *
 * 사진 위에 올라가므로 밝은 사진에서도 읽혀야 한다. 반투명 배경과 블러로
 * 아래 사진과 분리한다.
 */
export function PlaceCardMenu({
  title,
  onDelete,
}: {
  title: string
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            // size-8. 사진 위에 뜨는 유일한 조작점이라 손가락으로도 눌려야 한다.
            size="icon"
            // 카드가 여러 장 쌓이므로 어느 장소의 메뉴인지까지 읽어 준다.
            aria-label={`${title} 메뉴`}
            className="bg-background/70 hover:bg-background/90 rounded-full backdrop-blur-sm"
          />
        }
      >
        <MoreVerticalIcon />
      </DropdownMenuTrigger>

      {/* 기본 팝업 폭이 트리거 폭(w-(--anchor-width))을 따라가는데 트리거가
          아이콘 버튼이라 너무 좁다. 내용에 맞춘다. */}
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2Icon />
          삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 4: DeletePlaceDialog 를 만든다**

Create `src/components/delete-place-dialog.tsx`:

```tsx
"use client"

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

/**
 * 삭제 확인 모달.
 *
 * 되돌릴 수 없는 동작이라 한 번 묻는다 — 행만이 아니라 Storage 의 사진까지
 * 지우므로 실행취소를 제공하려면 soft delete 와 정리 작업이 따라온다.
 *
 * 기본 포커스를 취소에 두려고 취소를 DOM 앞에 놓는다. DialogFooter 가
 * flex-col-reverse(모바일) / sm:flex-row(데스크톱) 이라 취소가 데스크톱에서는
 * 왼쪽, 모바일에서는 아래에 온다. SignOutDialog 와 같은 배치다.
 */
export function DeletePlaceDialog({
  open,
  title,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean
  title: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>장소를 삭제할까요?</DialogTitle>
          <DialogDescription>
            &lsquo;{title}&rsquo; 을(를) 지웁니다. 올린 사진도 함께 지워지며
            되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />} disabled={pending}>
            취소
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "삭제 중…" : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: 목록 패널에 메뉴를 얹는다**

`src/components/place-list-panel.tsx`를 고친다.

import에 추가:

```tsx
import { PlaceCardMenu } from "@/components/place-card-menu"
```

props 타입에 한 줄 추가(`onClose` 위):

```tsx
  onDelete: (place: Place) => void
```

구조 분해에도 `onDelete`를 더하고, `<li>` 블록을 통째로 교체한다.

```tsx
              <li key={place.id} className="relative">
                <button
                  type="button"
                  onClick={() => onSelect(place)}
                  className={cn(
                    "focus-visible:ring-ring/50 block w-full rounded-xl text-left outline-none focus-visible:ring-3",
                    place.id === selectedId && "ring-primary ring-2"
                  )}
                >
                  <PlaceCard place={place} />
                </button>

                {/* 메뉴를 카드 버튼 *안* 에 넣으면 버튼 중첩이라 마크업이
                    무효가 되고, 메뉴를 여는 클릭이 바깥 버튼으로 새어 나가
                    지도가 함께 날아간다. 형제로 두고 위치만 겹친다. */}
                <div className="absolute top-2 right-2">
                  <PlaceCardMenu
                    title={place.title}
                    onDelete={() => onDelete(place)}
                  />
                </div>
              </li>
```

- [ ] **Step 6: 지도 화면에 삭제를 배선한다**

`src/components/place-explorer.tsx`를 고친다.

import에 추가:

```tsx
import { toast } from "sonner"
import { deletePlaceAction } from "@/actions/place"
import { DeletePlaceDialog } from "@/components/delete-place-dialog"
```

상태 선언부(`const [signOutOpen, setSignOutOpen] = useState(false)` 아래)에 추가:

```tsx
  const [deleting, setDeleting] = useState<Place | null>(null)
  const [deletePending, startDelete] = useTransition()
```

`onSignOutConfirmed` 위에 핸들러를 추가한다.

```tsx
  const onDeleteConfirmed = () => {
    const target = deleting
    if (!target) return

    startDelete(async () => {
      const result = await deletePlaceAction(target.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setDeleting(null)
      // 지운 장소의 팝업이 떠 있으면 참조가 사라진 카드가 지도에 남는다.
      setSelected((prev) => (prev?.id === target.id ? null : prev))
      // 이 화면의 목록은 RSC 가 아니라 /api/places 로 가져오므로
      // revalidatePath 로는 갱신되지 않는다. 토큰을 올려 다시 부른다.
      setReloadToken((n) => n + 1)
      toast.success("장소를 삭제했습니다.")
    })
  }
```

`PlaceListPanel` 사용부에 prop을 하나 추가한다(`onSelect` 아래).

```tsx
        onDelete={setDeleting}
```

`SignOutDialog` 아래에 모달을 추가한다.

```tsx
      <DeletePlaceDialog
        open={deleting !== null}
        title={deleting?.title ?? ""}
        // 삭제가 진행 중일 때는 바깥 클릭·Esc 로 닫히지 않게 한다. 닫혀도
        // 액션은 계속 진행되므로 "취소한 것처럼 보이는데 지워지는" 상태가
        // 생긴다. 로그아웃 모달과 같은 처리다.
        onOpenChange={(next) => {
          if (!deletePending && !next) setDeleting(null)
        }}
        onConfirm={onDeleteConfirmed}
        pending={deletePending}
      />
```

- [ ] **Step 7: 타입 검사와 테스트**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 출력 없음, 테스트 92개 통과

- [ ] **Step 8: 브라우저에서 확인한다**

Run: `npm run dev` 후 http://localhost:3000 접속(로그인 필요).

- [ ] 목록 패널을 열면 각 카드 사진 오른쪽 위에 ⋮ 가 보인다
- [ ] ⋮ 를 눌러도 지도가 그 장소로 날아가지 않는다(카드 선택이 일어나지 않는다)
- [ ] 메뉴에 "삭제"가 붉은색으로 뜬다
- [ ] "삭제" → 확인 모달의 문구에 그 장소 제목이 들어 있다
- [ ] 취소하면 아무 일도 일어나지 않는다
- [ ] 삭제하면 토스트가 뜨고 목록과 지도 마커에서 사라진다
- [ ] 삭제한 장소의 팝업이 떠 있었다면 팝업도 닫힌다
- [ ] Supabase Storage 의 `places` 버킷에서 그 사진 객체가 사라졌다

- [ ] **Step 9: 커밋**

```bash
git add src/components/ui/dropdown-menu.tsx src/components/place-card-menu.tsx src/components/delete-place-dialog.tsx src/components/place-list-panel.tsx src/components/place-explorer.tsx
git commit -m "$(cat <<'EOF'
feat: Add/목록 카드에 케밥 메뉴와 삭제를 더한다

메뉴 버튼은 카드 버튼 안이 아니라 형제로 둔다 — 버튼을 중첩하면 마크업이
무효가 되고 클릭이 바깥으로 새어 나간다.
EOF
)"
```

---

### Task 4: 폼 필드 추출

동작을 바꾸지 않는 리팩터다. 수정 폼이 등록 폼과 같은 필드를 그리기 위한 준비.

**Files:**
- Create: `src/components/place-fields.tsx`
- Modify: `src/components/place-form.tsx`

**Interfaces:**
- Produces: `PlaceFields({ control, errors }: { control: Control<PlaceFormValues>; errors: FieldErrors<PlaceFormValues> })`

- [ ] **Step 1: PlaceFields 를 만든다**

Create `src/components/place-fields.tsx`:

```tsx
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
```

- [ ] **Step 2: 등록 폼이 이것을 쓰게 한다**

`src/components/place-form.tsx`에서 제목·설명·카테고리 세 `<Field>` 블록(`<Field>` … 카테고리 `</Field>`까지)을 한 줄로 교체한다.

```tsx
      <PlaceFields control={control} errors={errors} />
```

import를 정리한다.

- 추가: `import { PlaceFields } from "@/components/place-fields"`
- 제거: `CategoryPicker`, `Field`/`FieldError`/`FieldLabel`, `Input`, `Textarea`
- `react-hook-form` import에서 `Controller`를 뺀다 — 이 파일에 남은 사용처가 없다: `import { useForm } from "react-hook-form"`

- [ ] **Step 3: 남은 참조가 없는지 확인한다**

Run: `grep -n "Controller\|CategoryPicker\|FieldLabel\|Textarea\|<Input" src/components/place-form.tsx`
Expected: 출력 없음

- [ ] **Step 4: 타입 검사와 테스트**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 출력 없음(미사용 import가 남아 있으면 여기서 걸린다), 테스트 92개 통과

- [ ] **Step 5: 등록이 그대로 동작하는지 확인한다**

Run: `npm run dev`

- [ ] 장소 등록 모달을 열어 사진을 올리고 제목·설명·카테고리를 채워 저장하면 이전과 똑같이 저장된다
- [ ] 제목을 비우고 저장하면 "제목을 입력해 주세요"가 뜬다
- [ ] 카테고리를 골랐다가 다시 누르면 해제된다

- [ ] **Step 6: 커밋**

```bash
git add src/components/place-fields.tsx src/components/place-form.tsx
git commit -m "$(cat <<'EOF'
refactor: Change/폼의 세 필드를 PlaceFields 로 뽑는다

수정 폼이 같은 필드를 그린다. 검증 규칙은 이미 placeFields 하나인데
마크업이 두 벌이면 결국 어긋난다.
EOF
)"
```

---

### Task 5: 수정 흐름

**Files:**
- Create: `src/components/edit-place-dialog.tsx`
- Modify: `src/components/place-card-menu.tsx`
- Modify: `src/components/place-list-panel.tsx`
- Modify: `src/components/place-explorer.tsx`

**Interfaces:**
- Consumes: `updatePlaceAction` (Task 2), `PlaceCardMenu`·`PlaceListPanel` (Task 3), `PlaceFields` (Task 4), `placeFormSchema`·`PlaceFormValues` (기존)
- Produces:
  - `EditPlaceDialog({ place, onOpenChange, onUpdated }: { place: Place | null; onOpenChange: (open: boolean) => void; onUpdated: (id: number, values: PlaceFormValues) => void })`
  - `PlaceCardMenu` props에 `onEdit: () => void` 추가
  - `PlaceListPanel` props에 `onEdit: (place: Place) => void` 추가

- [ ] **Step 1: EditPlaceDialog 를 만든다**

Create `src/components/edit-place-dialog.tsx`:

```tsx
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
    const result = await updatePlaceAction({ id: place.id, ...values })
    setSaving(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success("장소를 수정했습니다.")
    onUpdated(place.id, values)
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
```

- [ ] **Step 2: 메뉴에 수정 항목을 더한다**

`src/components/place-card-menu.tsx`를 고친다.

- import: `import { MoreVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react"`
- props 타입에 `onEdit: () => void` 를 더하고 구조 분해에도 더한다
- `DropdownMenuContent` 안, 삭제 항목 **위**에 넣는다:

```tsx
        <DropdownMenuItem onClick={onEdit}>
          <PencilIcon />
          수정
        </DropdownMenuItem>
```

`src/components/place-list-panel.tsx`를 고친다.

- props 타입에 `onEdit: (place: Place) => void` 를 더하고(`onDelete` 위) 구조 분해에도 더한다
- `PlaceCardMenu` 사용부에 `onEdit={() => onEdit(place)}` 를 더한다(`title` 아래)

- [ ] **Step 3: 지도 화면에 배선한다**

`src/components/place-explorer.tsx`를 고친다.

import에 추가:

```tsx
import { EditPlaceDialog } from "@/components/edit-place-dialog"
import type { PlaceFormValues } from "@/schemas/place"
```

`deleting` 상태 옆에 추가:

```tsx
  const [editing, setEditing] = useState<Place | null>(null)
```

`onDeleteConfirmed` 위에 핸들러를 추가한다.

```tsx
  const onUpdated = (id: number, values: PlaceFormValues) => {
    setEditing(null)
    // 재조회는 디바운스와 네트워크를 거친다. 그동안 팝업이 옛 제목을 들고
    // 있으면 방금 고친 값이 그대로인 것처럼 보인다. 선택된 장소만 먼저
    // 겹쳐 쓴다. description 은 폼이 undefined 로 접어 오므로 DB 표현인
    // null 로 되돌린다.
    setSelected((prev) =>
      prev?.id === id
        ? { ...prev, ...values, description: values.description ?? null }
        : prev
    )
    setReloadToken((n) => n + 1)
  }
```

`PlaceListPanel`의 `onEdit={() => {}}` 를 바꾼다.

```tsx
        onEdit={setEditing}
```

`DeletePlaceDialog` 위에 모달을 추가한다.

```tsx
      <EditPlaceDialog
        place={editing}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
        onUpdated={onUpdated}
      />
```

- [ ] **Step 4: 타입 검사와 테스트**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 출력 없음, 테스트 92개 통과

- [ ] **Step 5: 브라우저에서 확인한다**

Run: `npm run dev`

- [ ] 메뉴에 "수정"이 "삭제" 위에 뜬다
- [ ] ⋮ → "수정" 을 누르면 현재 제목·설명·카테고리가 채워진 모달이 뜬다
- [ ] 제목을 지우고 저장하면 "제목을 입력해 주세요"가 뜨고 모달이 닫히지 않는다
- [ ] 제목을 고쳐 저장하면 토스트가 뜨고 목록 카드의 제목이 바뀐다
- [ ] 그 장소의 팝업이 지도에 떠 있었다면 팝업 제목도 즉시 바뀐다
- [ ] 설명을 통째로 지우고 저장하면 카드에서 설명 줄이 사라진다(다시 열면 비어 있다)
- [ ] 카테고리를 해제하고 저장하면 카드에서 카테고리 라벨이 사라진다
- [ ] 다른 장소의 ⋮ → 수정을 열면 그 장소의 값으로 바뀌어 있다(앞 장소의 값이 남지 않는다)
- [ ] 취소로 닫고 다시 열면 고치다 만 값이 아니라 저장된 값이 보인다

- [ ] **Step 6: 커밋**

```bash
git add src/components/edit-place-dialog.tsx src/components/place-card-menu.tsx src/components/place-list-panel.tsx src/components/place-explorer.tsx
git commit -m "$(cat <<'EOF'
feat: Add/장소 수정 모달을 더한다

제목·설명·카테고리만 고친다. 사진과 좌표는 EXIF 가 준 사실 데이터라
바꾸지 않는다.
EOF
)"
```

---

### Task 6: README 갱신

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 낡은 자리를 확인한다**

Run: `sed -n '/## 주요 기능/,/## 기술 스택/p' README.md`

"주요 기능"의 표에 목록 행이 있고("카드를 누르면 그 장소로 이동한다"), 그 아래
불릿 목록이 기능별 설명을 담고 있다. 두 곳 모두 수정·삭제를 모른다.

- [ ] **Step 2: 표의 목록 행에 메뉴를 적는다**

`| 목록 | 오른쪽 위 \`List\` 아이콘 |` 로 시작하는 행의 설명 끝에 이어 붙인다.

```
카드를 누르면 그 장소로 이동한다. 카드 사진 오른쪽 위 `⋮` 로 수정·삭제할 수 있다 |
```

- [ ] **Step 3: 불릿 목록에 한 줄을 더한다**

"**카테고리 선택**" 불릿 아래에 붙인다.

```markdown
- **수정·삭제** — 목록 카드의 `⋮` 메뉴에서 제목·설명·카테고리를 고치거나 장소를 지웁니다. 사진과 촬영 위치는 EXIF에서 온 값이라 수정 대상이 아니며, 삭제하면 Storage의 사진도 함께 지워집니다.
```

- [ ] **Step 4: 커밋**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: Update/README 에 수정·삭제를 적는다
EOF
)"
```

---

## 완료 확인

전체가 끝나면 다음이 모두 통과해야 한다.

- [ ] `npx tsc --noEmit` — 출력 없음
- [ ] `npm test` — 92개 통과
- [ ] `npm run build` — 성공
- [ ] `git status` — 작업 트리 깨끗함(`AGENTS.md` 재생성분 제외)
