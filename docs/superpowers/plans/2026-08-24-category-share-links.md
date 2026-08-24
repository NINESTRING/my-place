# 카테고리 공유 링크 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 카테고리별로 공유를 켜면 추측 불가 토큰 URL(`/share/<token>`)이 만들어지고, 로그인하지 않은 사람이 그 링크로 해당 카테고리의 장소들을 읽기 전용 지도 화면으로 본다.

**Architecture:** `Category`에 `shareToken`(첫 공유 시 생성, 영구 보관)·`shareEnabled` 컬럼을 추가한다. 새 서버 컴포넌트 페이지 `app/share/[token]/page.tsx`가 토큰으로 카테고리와 장소 전체를 한 번에 조회해 기존 `PlaceExplorer`의 새 `share` 모드(읽기 전용)로 렌더한다. 공유 토글·링크 복사는 기존 `CategoryManager`(등록·수정 폼의 `관리` 토글)의 각 행에 들어간다.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7, Zod, Vitest, shadcn/ui(base-nova — Button은 `render` prop, ToggleGroup은 배열 값), react-map-gl 8(maplibre).

**Spec:** `docs/superpowers/specs/2026-08-24-category-share-links-design.md`

## Global Constraints

- 이 저장소의 Next.js 16은 학습 데이터와 다를 수 있다 — 새 API를 쓰기 전 `node_modules/next/dist/docs/`를 확인한다. 동적 세그먼트의 `params`는 **Promise**라 `await` 해야 한다(문서 `01-app/03-api-reference/03-file-conventions/dynamic-routes.md`에서 확인 완료).
- 커밋 메시지는 기존 관례를 따른다: `feat: Add/…`, `fix: Change/…` 형식의 한국어 요약. 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `next dev`가 AGENTS.md 블록을 다시 만들 수 있다 — diff에 나타나면 커밋에 포함해 트리를 깨끗이 유지한다.
- 주석은 "무엇"이 아니라 코드로 드러나지 않는 제약·이유만 적는 기존 스타일을 따른다. 모든 사용자 문구는 한국어.
- 테스트: `npm test` (Vitest). 기존 관례상 순수 함수·Zod 스키마만 단위 테스트하고 DB·컴포넌트는 수동 확인.
- 타입 원칙: `CategorySummary`(id·name)는 그대로 두고, 공유 상태가 필요한 관리 경로만 새 타입 `CategoryWithShare`를 쓴다. 장소 카드의 `categories`와 `/api/places` 응답에 토큰이 섞여 나가지 않게 하기 위함이다(스펙의 "CategorySummary에 추가한다"를 이 형태로 구체화 — 의도는 동일: 본인 세션에만 토큰이 내려간다).

---

### Task 1: Prisma 스키마 — shareToken / shareEnabled

**Files:**
- Modify: `prisma/schema.prisma:32-41` (Category 모델)

**Interfaces:**
- Produces: `Category.shareToken: string | null`(unique), `Category.shareEnabled: boolean` — 이후 모든 태스크의 Prisma 타입 기반.

- [ ] **Step 1: 스키마 수정**

`model Category` 를 다음으로 바꾼다 (`createdAt`과 `places` 사이에 두 필드 추가):

```prisma
model Category {
  id        Int             @id @default(autoincrement())
  userId    String          @map(name: "user_id")
  name      String
  createdAt DateTime        @default(now()) @map(name: "created_at")
  // 공유 링크 토큰. 처음 공유를 켤 때 한 번 만들어 영구 보관한다 — 껐다 켜도
  // 같은 링크가 살아나야 하므로(설계 결정) 끌 때 지우지 않는다. 링크의 유효
  // 여부는 shareEnabled 하나로 판단한다.
  shareToken   String?  @unique @map(name: "share_token")
  shareEnabled Boolean  @default(false) @map(name: "share_enabled")
  places    PlaceCategory[]

  @@unique([userId, name])
  @@map(name: "categories")
}
```

- [ ] **Step 2: 클라이언트 재생성 및 DB 반영**

Run: `npx prisma generate && npx prisma db push`
Expected: 둘 다 성공. 기존 행은 기본값(null / false)이라 데이터 이행이 없다.

- [ ] **Step 3: 기존 테스트가 여전히 통과하는지 확인**

Run: `npm test`
Expected: 94개 전부 PASS (스키마 추가는 기존 타입과 호환).

- [ ] **Step 4: 커밋**

```bash
git add prisma/schema.prisma
git commit -m "feat: Add/카테고리에 공유 토큰과 공유 여부 컬럼을 더한다"
```

---

### Task 2: 공유 토큰 생성 함수 (TDD)

**Files:**
- Create: `src/lib/share-token.ts`
- Test: `src/lib/share-token.test.ts`

**Interfaces:**
- Produces: `generateShareToken(): string` — Task 6의 서버 액션이 쓴다.
- 주의: `import "server-only"`를 **넣지 않는다** — Vitest가 이 파일을 import해야 하는데 server-only는 react-server 조건 밖에서 throw한다. `node:crypto`는 서버 액션에서만 import되므로 클라이언트 번들에 들어갈 일이 없다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/share-token.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { generateShareToken } from "@/lib/share-token"

describe("generateShareToken", () => {
  it("16바이트 난수의 base64url 표기라 22자다", () => {
    expect(generateShareToken()).toHaveLength(22)
  })

  it("URL 에 그대로 쓸 수 있는 문자만 쓴다", () => {
    // base64url 자모: A-Z a-z 0-9 - _  (+, /, = 없음)
    for (let i = 0; i < 20; i++) {
      expect(generateShareToken()).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it("호출마다 다른 값을 돌려준다", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generateShareToken())
    )
    expect(tokens.size).toBe(100)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/share-token.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`src/lib/share-token.ts`:

```ts
import { randomBytes } from "node:crypto"

/**
 * 공유 링크 경로(/share/<token>)에 들어갈 토큰. 16바이트(128비트) 난수를
 * base64url 로 적어 22자 — URL 에 인코딩 없이 들어가고 추측이 불가능하다.
 *
 * 첫 공유 때 한 번 만들어 영구 보관한다. 공유를 껐다 켜도 링크가 바뀌지
 * 않는 것이 설계 결정이므로, 재발급이 필요해지기 전에는 다시 부를 일이 없다.
 */
export function generateShareToken(): string {
  return randomBytes(16).toString("base64url")
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/share-token.test.ts`
Expected: PASS 3개.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/share-token.ts src/lib/share-token.test.ts
git commit -m "feat: Add/추측 불가 공유 토큰 생성 함수를 만든다"
```

---

### Task 3: boundsOf — 장소 전체를 덮는 범위 (TDD)

**Files:**
- Modify: `src/lib/places.ts` (함수 추가 + `FALLBACK_BOUNDS` 이동)
- Modify: `app/page.tsx:15-21` (로컬 상수 제거, import 로 교체)
- Test: `src/lib/places.test.ts` (기존 파일에 describe 추가)

**Interfaces:**
- Produces: `boundsOf(points: readonly Coordinates[]): Bounds | null` — 빈 배열이면 null. Task 11의 공유 페이지가 쓴다.
- Produces: `FALLBACK_BOUNDS: Bounds` — 기존 `app/page.tsx` 의 값을 그대로 export 로 옮긴다. `app/page.tsx` 와 Task 11 페이지가 공유한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/places.test.ts`에 추가 (기존 import 에 `boundsOf` 추가):

```ts
describe("boundsOf", () => {
  it("모든 점을 덮는 최소 상자를 돌려준다", () => {
    const bounds = boundsOf([
      { latitude: 37.5, longitude: 127.0 },
      { latitude: 35.1, longitude: 129.0 },
      { latitude: 36.3, longitude: 126.5 },
    ])
    expect(bounds).toEqual({
      sw: { latitude: 35.1, longitude: 126.5 },
      ne: { latitude: 37.5, longitude: 129.0 },
    })
  })

  it("점이 하나면 넓이 0 인 상자다 — fitBounds 의 maxZoom 이 확대를 막는다", () => {
    const bounds = boundsOf([{ latitude: 37.5, longitude: 127.0 }])
    expect(bounds).toEqual({
      sw: { latitude: 37.5, longitude: 127.0 },
      ne: { latitude: 37.5, longitude: 127.0 },
    })
  })

  it("점이 없으면 null — 호출부가 기본 범위로 대체한다", () => {
    expect(boundsOf([])).toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/places.test.ts`
Expected: FAIL — `boundsOf` export 없음.

- [ ] **Step 3: 구현**

`src/lib/places.ts` 끝에 추가:

```ts
/**
 * 보여 줄 장소도 저장된 위치도 없을 때 쓰는 범위(수도권 전체). 홈은
 * 클라이언트가 저장된 위치로 곧 다시 조회하므로 넉넉하면 되고, 공유
 * 페이지는 빈 카테고리일 때 이 범위를 그대로 띄운다.
 */
export const FALLBACK_BOUNDS: Bounds = {
  sw: { latitude: 37, longitude: 126 },
  ne: { latitude: 38, longitude: 128 },
}

/**
 * 점들 전체를 덮는 최소 상자. 공유 페이지가 첫 화면을 "이 카테고리의 모든
 * 장소가 보이는 범위"로 띄우는 데 쓴다. 빈 배열이면 null — 지도 초기화에
 * 쓰이는 값이라 "0 개의 점을 덮는 상자"라는 거짓 값을 만들지 않는다.
 * 날짜변경선을 넘는 분포는 boundsAround 와 같은 이유로 다루지 않는다.
 */
export function boundsOf(points: readonly Coordinates[]): Bounds | null {
  const first = points[0]
  if (!first) return null

  let bounds = {
    sw: { latitude: first.latitude, longitude: first.longitude },
    ne: { latitude: first.latitude, longitude: first.longitude },
  }
  for (const point of points) {
    bounds = {
      sw: {
        latitude: Math.min(bounds.sw.latitude, point.latitude),
        longitude: Math.min(bounds.sw.longitude, point.longitude),
      },
      ne: {
        latitude: Math.max(bounds.ne.latitude, point.latitude),
        longitude: Math.max(bounds.ne.longitude, point.longitude),
      },
    }
  }
  return bounds
}
```

`app/page.tsx`: 로컬 `FALLBACK_BOUNDS` 상수(15-21행)와 그 주석을 지우고 import 를 바꾼다:

```ts
import { boundsAround, FALLBACK_BOUNDS } from "@/lib/places"
```

(기존 `import type { Bounds }` 가 다른 곳에서 안 쓰이면 함께 정리한다.)

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: 전부 PASS (기존 94 + 새 3).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/places.ts src/lib/places.test.ts app/page.tsx
git commit -m "feat: Add/장소 전체를 덮는 범위 계산을 만들고 기본 범위를 lib 로 올린다"
```

---

### Task 4: categorySharingSchema (TDD)

**Files:**
- Modify: `src/schemas/category.ts`
- Test: `src/schemas/category.test.ts` (기존 파일에 describe 추가)

**Interfaces:**
- Produces: `categorySharingSchema` — `{ id: number(양의 정수), enabled: boolean }`. Task 6 액션의 입력 검증.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/schemas/category.test.ts`에 추가 (import 에 `categorySharingSchema` 추가):

```ts
describe("categorySharingSchema", () => {
  it("id 와 enabled 를 받는다", () => {
    expect(
      categorySharingSchema.safeParse({ id: 3, enabled: true }).success
    ).toBe(true)
    expect(
      categorySharingSchema.safeParse({ id: 3, enabled: false }).success
    ).toBe(true)
  })

  it("enabled 는 진짜 불리언만 받는다 — 문자열 'true' 는 거부", () => {
    expect(
      categorySharingSchema.safeParse({ id: 3, enabled: "true" }).success
    ).toBe(false)
  })

  it("id 규칙은 다른 액션과 같다 — 0·음수·소수 거부", () => {
    expect(
      categorySharingSchema.safeParse({ id: 0, enabled: true }).success
    ).toBe(false)
    expect(
      categorySharingSchema.safeParse({ id: -1, enabled: true }).success
    ).toBe(false)
    expect(
      categorySharingSchema.safeParse({ id: 1.5, enabled: true }).success
    ).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/schemas/category.test.ts`
Expected: FAIL — export 없음.

- [ ] **Step 3: 구현**

`src/schemas/category.ts` 끝에 추가:

```ts
/**
 * 공유 켜기/끄기 액션의 입력. enabled 를 z.coerce 로 받지 않는 이유는
 * categoryIdSchema 와 같다 — 액션 인자는 클라이언트가 보낸 값이고, 강제
 * 변환은 "false" 같은 진실 아닌 값을 true 로 접는다.
 */
export const categorySharingSchema = z.object({
  id: categoryIdSchema,
  enabled: z.boolean(),
})
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/schemas/category.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/schemas/category.ts src/schemas/category.test.ts
git commit -m "feat: Add/공유 켜기 끄기 입력 스키마를 더한다"
```

---

### Task 5: CategoryWithShare 타입 + withUpdatedCategory 병합 (TDD)

**Files:**
- Modify: `src/lib/categories.ts`
- Modify: `src/components/category-picker.tsx:14,91-93` (`withRenamedCategory` 호출부)
- Test: `src/lib/categories.test.ts`

**Interfaces:**
- Produces: `type CategoryWithShare = CategorySummary & { shareEnabled: boolean; shareToken: string | null }` — 관리 경로(폼 선택지·CategoryManager) 전용. 장소 카드의 `categories` 는 그대로 `CategorySummary`.
- Produces: `withUpdatedCategory<T extends CategorySummary>(categories: readonly T[], category: CategorySummary): T[]` — **`withRenamedCategory` 를 대체(이름 변경 + 병합 의미론)**. 같은 id 행에 겹쳐 쓰고 재정렬한다.
- Produces: `withCategory`, `withoutCategory` 를 제네릭으로 넓힌다(시그니처는 아래 코드).
- Consumes: 없음 (순수 모듈).

- [ ] **Step 1: 테스트 수정 — 실패 상태 만들기**

`src/lib/categories.test.ts` 의 `withRenamedCategory` describe(64행 부근)를 다음으로 교체하고, import 의 `withRenamedCategory` 를 `withUpdatedCategory` 로 바꾼다:

```ts
describe("withUpdatedCategory", () => {
  it("같은 id 의 이름을 겹쳐 쓰고 다시 정렬한다", () => {
    const list = [
      { id: 1, name: "명소" },
      { id: 2, name: "카페" },
    ]
    expect(withUpdatedCategory(list, { id: 1, name: "휴양지" })).toEqual([
      { id: 2, name: "카페" },
      { id: 1, name: "휴양지" },
    ])
  })

  it("교체가 아니라 병합이다 — 서버가 안 돌려준 필드(공유 상태)가 남는다", () => {
    const list = [
      { id: 1, name: "명소", shareEnabled: true, shareToken: "tok" },
      { id: 2, name: "카페", shareEnabled: false, shareToken: null },
    ]
    const next = withUpdatedCategory(list, { id: 1, name: "휴양지" })
    expect(next.find((c) => c.id === 1)).toEqual({
      id: 1,
      name: "휴양지",
      shareEnabled: true,
      shareToken: "tok",
    })
  })

  it("공유 상태 변경도 같은 헬퍼로 겹쳐 쓴다", () => {
    const list = [
      { id: 1, name: "명소", shareEnabled: false, shareToken: null },
    ]
    const next = withUpdatedCategory(list, {
      id: 1,
      name: "명소",
      shareEnabled: true,
      shareToken: "tok",
    })
    expect(next[0]).toEqual({
      id: 1,
      name: "명소",
      shareEnabled: true,
      shareToken: "tok",
    })
  })
})
```

(기존 describe 안의 다른 it — "없는 id 면 아무것도 바꾸지 않는다" 류가 있으면 함수 이름만 바꿔 유지한다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/categories.test.ts`
Expected: FAIL — `withUpdatedCategory` 없음.

- [ ] **Step 3: 구현**

`src/lib/categories.ts`:

`CategorySummary` 정의 아래에 타입 추가:

```ts
/**
 * 관리 경로(폼 선택지·CategoryManager)가 쓰는 내 카테고리 — 공유 상태까지
 * 든다. 장소 카드의 categories(PlaceWithCategories)는 여전히 CategorySummary
 * 다: 장소 조회마다 토큰을 끌고 다닐 이유가 없고, /api/places 응답에 토큰이
 * 실려 나가지 않게 하는 경계이기도 하다. 이 타입은 본인 세션의 getCategories
 * 로만 내려온다.
 */
export type CategoryWithShare = CategorySummary & {
  shareEnabled: boolean
  shareToken: string | null
}
```

`withCategory` 를 제네릭으로 (구현은 그대로):

```ts
export function withCategory<T extends CategorySummary>(
  categories: readonly T[],
  category: T
): T[] {
  if (categories.some((c) => c.id === category.id)) return [...categories]
  return sortCategories([...categories, category])
}
```

`withRenamedCategory` 를 삭제하고 다음으로 교체:

```ts
/**
 * 같은 id 행에 서버가 돌려준 필드를 겹쳐 쓴다 — 이름 변경과 공유 상태 변경이
 * 함께 쓴다. 통째 교체가 아니라 병합인 이유: 이름 변경 액션은 공유 필드를
 * 돌려주지 않으므로, 교체하면 클라이언트가 들고 있던 공유 상태가 사라진다.
 * 이름이 바뀌면 정렬 위치도 다시 잡는다.
 */
export function withUpdatedCategory<T extends CategorySummary>(
  categories: readonly T[],
  category: CategorySummary
): T[] {
  return sortCategories(
    categories.map((c) => (c.id === category.id ? { ...c, ...category } : c))
  )
}
```

`withoutCategory` 를 제네릭으로:

```ts
export function withoutCategory<T extends CategorySummary>(
  categories: readonly T[],
  id: number
): T[] {
  return categories.filter((c) => c.id !== id)
}
```

`src/components/category-picker.tsx`: import 의 `withRenamedCategory` → `withUpdatedCategory`, 91-93행의 `onRenamed` 핸들러도 `withUpdatedCategory(categories, category)` 로.

- [ ] **Step 4: 통과 확인 + 타입 확인**

Run: `npm test && npx tsc --noEmit`
Expected: 둘 다 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/categories.ts src/lib/categories.test.ts src/components/category-picker.tsx
git commit -m "feat: Change/카테고리 갱신 헬퍼를 병합 의미론으로 바꾸고 공유 상태 타입을 더한다"
```

---

### Task 6: getCategories 확장 + setCategorySharingAction

**Files:**
- Modify: `src/lib/categories.server.ts` (`getCategories` 반환 확장)
- Modify: `src/actions/category.ts` (액션 추가)

**Interfaces:**
- Consumes: `generateShareToken()` (Task 2), `categorySharingSchema` (Task 4), `CategoryWithShare` (Task 5).
- Produces: `getCategories(userId): Promise<CategoryWithShare[]>` — select 에 share 필드 추가.
- Produces: `setCategorySharingAction(input: unknown): Promise<ActionResult<{ category: CategoryWithShare }>>` — Task 8의 CategoryManager 가 부른다.

- [ ] **Step 1: getCategories 확장**

`src/lib/categories.server.ts`: import 타입을 `CategoryWithShare` 로 바꾸고 select 를 넓힌다:

```ts
import { sortCategories, type CategoryWithShare } from "@/lib/categories"

export async function getCategories(
  userId: string
): Promise<CategoryWithShare[]> {
  const categories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true, shareEnabled: true, shareToken: true },
  })
  return sortCategories(categories)
}
```

(함수 위 기존 주석은 그대로 둔다.)

- [ ] **Step 2: 액션 추가**

`src/actions/category.ts` 끝에 추가. import 에 `categorySharingSchema`(스키마), `generateShareToken`(`@/lib/share-token`), `CategoryWithShare`(`@/lib/categories`) 를 더한다:

```ts
/**
 * 카테고리 공유를 켜거나 끈다. 링크 유효성은 shareEnabled 하나로 판단하고,
 * 토큰은 처음 켤 때 한 번 만들어 영구 보관한다 — 껐다 켜도 같은 링크가
 * 살아나는 것이 설계 결정이다.
 *
 * 토큰 생성(shareToken: null 인 행에만)과 플래그 갱신이 서로 다른 문장이지만
 * 둘 다 where 에 userId 가 들어가므로 소유권 검증은 각 문장 안에 있다.
 * 경쟁 조건은 마지막 쓰기가 이기는 것뿐이고, 두 요청 모두 자기 결과를 정직히
 * 돌려받으므로 잠금까지 갈 일이 아니다.
 */
export async function setCategorySharingAction(
  input: unknown
): Promise<ActionResult<{ category: CategoryWithShare }>> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { ok: false, error: UNAUTHENTICATED }
  }

  const parsed = categorySharingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: NOT_FOUND }
  }

  try {
    if (parsed.data.enabled) {
      // 토큰이 아직 없을 때만 만든다. 128비트 난수라 유니크 충돌은 사실상
      // 불가능하지만, 만에 하나는 한 번의 재시도로 덮는다.
      for (let attempt = 0; ; attempt++) {
        try {
          await prisma.category.updateMany({
            where: { id: parsed.data.id, userId, shareToken: null },
            data: { shareToken: generateShareToken() },
          })
          break
        } catch (error) {
          const collision =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          if (!collision || attempt >= 1) throw error
        }
      }
    }

    const category = await prisma.category.update({
      where: { id: parsed.data.id, userId },
      data: { shareEnabled: parsed.data.enabled },
      select: { id: true, name: true, shareEnabled: true, shareToken: true },
    })
    revalidatePath("/")
    return { ok: true, category }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { ok: false, error: NOT_FOUND }
    }
    return { ok: false, error: "공유 설정에 실패했습니다" }
  }
}
```

- [ ] **Step 3: 타입·테스트 확인**

Run: `npx tsc --noEmit && npm test`
Expected: 통과. (`getCategories` 의 반환이 넓어졌지만 `CategoryWithShare` 는 `CategorySummary` 에 구조적으로 대입 가능하므로 기존 호출부 — `app/page.tsx`, `PlaceExplorer` — 는 그대로 컴파일된다.)

- [ ] **Step 4: 커밋**

```bash
git add src/lib/categories.server.ts src/actions/category.ts
git commit -m "feat: Add/카테고리 공유를 켜고 끄는 서버 액션을 만든다"
```

---

### Task 7: getSharedPlaces — 토큰으로 공유 카테고리 조회

**Files:**
- Create: `src/lib/share.server.ts`

**Interfaces:**
- Produces: `getSharedPlaces(token: string): Promise<{ name: string; places: PlaceWithCategories[] } | null>` — 무효/꺼짐/없음 전부 null. Task 11 페이지가 쓴다.
- Consumes: `PlaceWithCategories` (`@/lib/places`), `prisma`.

- [ ] **Step 1: 구현**

`src/lib/share.server.ts`:

```ts
import "server-only"

import type { PlaceWithCategories } from "@/lib/places"
import { prisma } from "@/lib/prisma"

/**
 * 공유 토큰으로 카테고리와 그 장소 전체를 조회한다. 미인증 열람의 유일한
 * 입구이므로 스코프(토큰)가 필수 인자인 것은 places.server.ts 와 같은
 * 이유다.
 *
 * 없는 토큰·공유가 꺼진 토큰을 구분 없이 null 로 접는다 — 꺼진 링크의
 * 존재가 새면 "예전에 공유했던 적이 있다"는 사실이 새는 것이다.
 *
 * 장소 수 상한을 두지 않는 것은 getAllPlaces 와 같은 판단이다. 개수는
 * 개인 기록 규모(수십~수백)를 넘지 않고, 공유 화면은 재조회 없이 이 한 번의
 * 결과로만 그린다.
 */
export async function getSharedPlaces(
  token: string
): Promise<{ name: string; places: PlaceWithCategories[] } | null> {
  const category = await prisma.category.findUnique({
    where: { shareToken: token },
    select: { id: true, name: true, shareEnabled: true },
  })
  if (!category?.shareEnabled) return null

  const rows = await prisma.place.findMany({
    where: { categories: { some: { categoryId: category.id } } },
    orderBy: { imageCreationTime: "desc" },
  })

  return {
    name: category.name,
    // categories 를 일부러 비워 보낸다. 공유된 장소가 공유되지 않은 다른
    // 카테고리("데이트 코스" 같은)도 달고 있을 수 있고, 그 이름이 방문자에게
    // 새면 안 된다. 화면 쪽에서도 전부 같은 카테고리라 라벨의 정보 가치가
    // 없다.
    places: rows.map((place) => ({ ...place, categories: [] })),
  }
}
```

- [ ] **Step 2: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/share.server.ts
git commit -m "feat: Add/공유 토큰으로 카테고리 장소 전체를 조회한다"
```

---

### Task 8: CategoryManager 공유 토글·링크 복사 + 타입 좁히기

**Files:**
- Modify: `src/components/category-manager.tsx`
- Modify: `src/components/category-picker.tsx` (props 타입, onShareChanged 전달, 새 카테고리의 공유 기본값)
- Modify: `src/components/place-fields.tsx:8,29,31` / `src/components/place-form.tsx:24,72-73` / `src/components/create-place-dialog.tsx:5,35-36` / `src/components/edit-place-dialog.tsx:19,46-47` / `src/components/place-explorer.tsx:42,113` — `categories`/`onCategoriesChange` prop 타입을 `CategorySummary` → `CategoryWithShare` 로 (import 교체 포함, 기계적 치환)

**Interfaces:**
- Consumes: `setCategorySharingAction` (Task 6), `CategoryWithShare`·`withCategory`·`withUpdatedCategory` (Task 5).
- Produces: `CategoryManager` props — `categories: CategoryWithShare[]`, `onRenamed`, `onDeleted`, **`onShareChanged: (category: CategoryWithShare) => void`**.

주의: `place-explorer.tsx` 의 `onUpdated`(327-338행)가 `categories.filter(...)` 를 `selected.categories`(`CategorySummary[]`)에 대입하는 것은 구조적 대입이라 그대로 컴파일된다 — 건드리지 않는다.

- [ ] **Step 1: 타입 좁히기 (기계적)**

위 다섯 파일에서 `CategorySummary` import 와 prop 주석을 `CategoryWithShare` 로 바꾼다. `place-explorer.tsx` 는 `initialCategories: CategoryWithShare[]` 와 `useState(initialCategories)` 타입만 영향받는다 (import: `sortCategories, type CategoryWithShare`). `onCategoriesChange: (categories: CategoryWithShare[]) => void`.

- [ ] **Step 2: CategoryPicker — 새 카테고리 기본값과 onShareChanged**

`src/components/category-picker.tsx` 의 `create()` 안, 성공 분기의 `onCategoriesChange` 호출을 바꾼다:

```ts
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
```

`CategoryManager` 렌더에 prop 추가:

```tsx
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
```

- [ ] **Step 3: CategoryManager — 공유 토글과 링크 복사**

`src/components/category-manager.tsx`:

import 를 넓힌다:

```tsx
import {
  CheckIcon,
  LinkIcon,
  PencilIcon,
  Share2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { setCategorySharingAction } from "@/actions/category" // deleteCategoryAction 등 기존 import 에 추가
import type { CategoryWithShare } from "@/lib/categories"
```

props:

```tsx
export function CategoryManager({
  categories,
  onRenamed,
  onDeleted,
  onShareChanged,
}: {
  categories: CategoryWithShare[]
  onRenamed: (category: CategorySummary) => void
  onDeleted: (id: number) => void
  onShareChanged: (category: CategoryWithShare) => void
}) {
```

(`CategorySummary` import 는 남는다 — `onRenamed`/`deleting` 이 쓴다. `deleting` state 는 `CategoryWithShare | null` 로 바꾼다 — 삭제 확인 문구가 공유 여부를 읽는다.)

state 와 핸들러 추가 (기존 state 들 아래):

```tsx
  // 행 단위가 아니라 전체 잠금이다. 같은 행 연타만이 아니라, 토글이 도는
  // 동안 다른 행의 상태가 함께 어긋나 보이는 것도 막는다 — 어차피 사람 손이
  // 두 행을 동시에 만질 일은 없다.
  const [shareBusy, setShareBusy] = useState(false)

  const toggleShare = async (category: CategoryWithShare) => {
    if (shareBusy) return

    setShareBusy(true)
    try {
      const result = await setCategorySharingAction({
        id: category.id,
        enabled: !category.shareEnabled,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onShareChanged(result.category)
      toast.success(
        result.category.shareEnabled
          ? "공유를 켰습니다. 링크 아이콘으로 주소를 복사해 보내세요."
          : "공유를 껐습니다. 보냈던 링크는 더 이상 열리지 않습니다."
      )
    } catch {
      toast.error("공유 설정 중 문제가 발생했습니다.")
    } finally {
      setShareBusy(false)
    }
  }

  const copyShareLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/share/${token}`
      )
      toast.success("공유 링크를 복사했습니다.")
    } catch {
      // http 등 비보안 컨텍스트나 권한 거부. 링크가 사라진 것은 아니므로
      // 문구는 복사 실패에만 한정한다.
      toast.error("클립보드에 복사하지 못했습니다.")
    }
  }
```

목록 렌더: `categories.map((category) => (` 를 블록 몸통으로 바꿔 복사 버튼이 쓸 좁혀진 토큰을 상수로 뽑는다 — 프로퍼티 내로잉은 클로저 안까지 살아남지 않는다:

```tsx
        {categories.map((category) => {
          // 켜져 있으면서 토큰이 있는 행만 복사 버튼을 얻는다. 프로퍼티는
          // 콜백 안까지 내로잉이 살지 않으므로 상수로 뽑는다.
          const shareToken = category.shareEnabled ? category.shareToken : null
          return (
            <li
              key={category.id}
              className="flex min-h-11 items-center gap-2 px-3 py-1.5"
            >
              {/* ...기존 editingId 분기 그대로... */}
            </li>
          )
        })}
```

비편집 분기(이름 + 연필 + 휴지통)에서 연필 버튼 **앞**에 두 버튼을 추가:

```tsx
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void toggleShare(category)}
                  disabled={shareBusy}
                  aria-pressed={category.shareEnabled}
                  aria-label={
                    category.shareEnabled
                      ? `${category.name} 공유 끄기`
                      : `${category.name} 공유 켜기`
                  }
                  className={category.shareEnabled ? "text-primary" : undefined}
                >
                  <Share2Icon />
                </Button>
                {shareToken && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void copyShareLink(shareToken)}
                    aria-label={`${category.name} 공유 링크 복사`}
                  >
                    <LinkIcon />
                  </Button>
                )}
```

삭제 확인 `DialogDescription`(194-198행)에 공유 안내를 더한다:

```tsx
            <DialogDescription>
              &lsquo;{deleting?.name ?? ""}&rsquo; 을(를) 지웁니다. 이
              카테고리를 쓰는 장소에서도 함께 사라집니다(장소 자체는
              남습니다).
              {deleting?.shareEnabled &&
                " 공유 중이므로, 보냈던 공유 링크도 더 이상 열리지 않습니다."}{" "}
              되돌릴 수 없습니다.
            </DialogDescription>
```

- [ ] **Step 4: 타입·테스트·빌드 확인**

Run: `npx tsc --noEmit && npm test`
Expected: 통과.

- [ ] **Step 5: 수동 확인**

Run: `npm run dev` 후 브라우저에서 로그인 → 등록 모달 → 카테고리 `관리`:
- 공유 아이콘 토글 시 강조색 전환 + 토스트.
- 켠 행에 링크 아이콘이 나타나고, 누르면 클립보드에 `http://localhost:3000/share/<22자>` 가 들어간다.
- 끄고 다시 켜면 **같은 토큰**이다 (복사해 비교).

- [ ] **Step 6: 커밋**

```bash
git add src/components src/lib
git commit -m "feat: Add/카테고리 관리에서 공유를 켜고 링크를 복사한다"
```

---

### Task 9: PlaceListPanel 읽기 전용 모드

**Files:**
- Modify: `src/components/place-list-panel.tsx`

**Interfaces:**
- Produces: props 변경 — `readOnly?: boolean` 추가, `onEdit`·`onDelete` 를 옵셔널로. `readOnly` 는 범위 토글·필터 영역을 숨기고 빈 문구를 바꾼다. 카드 메뉴는 두 핸들러가 다 있어야 뜬다.
- Consumes: 없음. 기존 호출부(PlaceExplorer)는 두 핸들러를 계속 넘기므로 동작 불변.

- [ ] **Step 1: props 수정**

```tsx
  onEdit?: (place: PlaceWithCategories) => void
  onDelete?: (place: PlaceWithCategories) => void
  /**
   * 공유 화면용. 범위 토글과 필터 영역을 숨기고 빈 문구를 방문자 시점으로
   * 바꾼다. 수정·삭제 메뉴는 이 플래그가 아니라 핸들러 유무를 따른다 —
   * 읽기 전용 화면은 애초에 핸들러를 넘기지 않는다.
   */
  readOnly?: boolean
```

(구조 분해에 `readOnly = false` 추가.)

- [ ] **Step 2: 범위 토글·필터 영역 숨김**

125행 부근 `<div className="shrink-0 space-y-2 border-b px-4 py-2">` 블록 전체를 `{!readOnly && ( ... )}` 로 감싼다. (공유 화면은 categories 가 빈 배열이라 칩도 어차피 없지만, 빈 컨테이너의 border 줄이 남지 않게 컨테이너째 숨긴다.)

- [ ] **Step 3: 빈 문구 분기**

```tsx
            {readOnly
              ? "이 카테고리에는 아직 장소가 없습니다."
              : activeFilterIds.length > 0 && places && places.length > 0
                ? "고른 카테고리의 장소가 없습니다. 필터를 바꾸거나 해제해 보세요."
                : EMPTY_MESSAGE[scope]}
```

- [ ] **Step 4: 카드 메뉴를 핸들러 유무로**

메뉴 블록(202-208행)을 다음으로:

```tsx
                {onEdit && onDelete && (
                  <div className="absolute top-2 left-2 sm:right-2 sm:left-auto">
                    <PlaceCardMenu
                      title={place.title}
                      onEdit={() => onEdit(place)}
                      onDelete={() => onDelete(place)}
                    />
                  </div>
                )}
```

- [ ] **Step 5: 타입·테스트 확인 + 커밋**

Run: `npx tsc --noEmit && npm test`
Expected: 통과.

```bash
git add src/components/place-list-panel.tsx
git commit -m "feat: Add/목록 패널에 읽기 전용 모드를 더한다"
```

---

### Task 10: PlaceExplorer share 모드 + useLocalState persist 옵션

**Files:**
- Modify: `src/hooks/use-local-state.ts`
- Modify: `src/components/place-explorer.tsx`

**Interfaces:**
- Produces: `useLocalState(key, initial, persist = true)` — `persist: false` 면 일반 `useState` 처럼 동작하고 `hydrated` 는 처음부터 true, `restored` 는 항상 false.
- Produces: `PlaceExplorer` 새 prop `share?: { categoryName: string } | null` (기본 null). share 모드에서는: 재조회·위치 질문·localStorage 저장 없음, 조작 버튼은 목록 토글 하나, 모달 전부 없음, 지도는 `initialBounds` 를 fitBounds 로 띄움, 왼쪽 위에 카테고리 이름 헤더.
- Consumes: `PlaceListPanel.readOnly` (Task 9).

- [ ] **Step 1: useLocalState 에 persist 매개변수**

`src/hooks/use-local-state.ts`:

```ts
export function useLocalState<S>(
  key: string,
  initial: S,
  // 공유 화면처럼 "이 화면의 상태는 브라우저에 남기지 않는다"가 필요한
  // 호출부용. false 면 일반 useState 로 동작한다 — hydrated 를 처음부터
  // true 로 두는 것은 읽기 effect 자체가 없어 기다릴 것이 없기 때문이다.
  persist = true
): [S, Dispatch<SetStateAction<S>>, boolean, boolean] {
  const [value, setValue] = useState<S>(initial)
  const [hydrated, setHydrated] = useState(!persist)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    if (!persist) return
    const saved = window.localStorage.getItem(key)
    if (saved !== null) {
      try {
        setValue(JSON.parse(saved) as S)
        setRestored(true)
      } catch {
        window.localStorage.removeItem(key)
      }
    }
    setHydrated(true)
  }, [key, persist])

  useEffect(() => {
    if (!persist) return
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, persist, value])

  return [value, setValue, hydrated, restored]
}
```

- [ ] **Step 2: PlaceExplorer — prop 과 파생 플래그**

`src/components/place-explorer.tsx` props 에 추가:

```tsx
  /**
   * 공유 화면(/share/[token]) 모드. 값이 있으면 읽기 전용이 된다 — 쓰기
   * UI 와 재조회를 전부 끄고, initialPlaces 만으로 그린다. 방문자는
   * 미인증이므로 isAuthenticated 는 항상 false 로 함께 온다.
   */
  share?: { categoryName: string } | null
```

(구조 분해에 `share = null` 추가.) 함수 몸통 시작에:

```tsx
  const isShare = share !== null
```

- [ ] **Step 3: 상태·effect 를 share 모드에 맞춘다**

- `useLocalState` 두 호출에 `!isShare` 를 넘긴다:

```tsx
  const [viewport, setViewport, viewportHydrated, viewportRestored] =
    useLocalState<Viewport>(
      "viewport",
      initialCenter ? { ...initialCenter, zoom: FOCUS_ZOOM } : DEFAULT_VIEWPORT,
      !isShare
    )
  const [bounds, setBounds] = useLocalState<Bounds>(
    "bounds",
    initialBounds,
    !isShare
  )
```

- `allPlaces` 초기값: 공유 화면은 받은 것이 전부다.

```tsx
  const [allPlaces, setAllPlaces] = useState<PlaceWithCategories[] | null>(
    isShare ? initialPlaces : null
  )
```

- bounds 재조회 effect(174-184행) 맨 위에 가드 (`isShare` 를 deps 에 추가):

```tsx
    // 공유 화면은 서버가 내려준 장소가 전부다. /api/places 는 세션 스코프라
    // 방문자에게 어차피 빈 배열을 줄 뿐이고, 마커가 지워지기만 한다.
    if (isShare) return
```

- scope=all effect(186-201행) 맨 위에도 같은 가드 (`isShare` deps 추가). 기존 `!isAuthenticated` 분기보다 **앞**이어야 한다 — 공유 화면은 미인증이지만 `allPlaces` 를 비우면 안 된다.

- 위치 질문 effect(203-238행) 맨 위에 `if (isShare) return` (deps 에 `isShare` 추가) — 가드가 없으면 공유 화면에서 저장 위치도 initialCenter 도 없어 방문자에게 위치 권한을 묻는다.

- [ ] **Step 4: 지도 초기 화면 — fitBounds**

`<Map>` 의 `initialViewState` 를 분기한다 (react-map-gl 8 의 `initialViewState.bounds`/`fitBoundsOptions` 는 `node_modules/@vis.gl/react-maplibre/dist/components/map.d.ts:23-30` 에서 확인 완료):

```tsx
        <Map
          ref={mapRef}
          // 공유 화면은 "이 카테고리의 모든 장소가 보이는 범위"에서 시작한다.
          // 장소가 하나거나 몰려 있으면 maxZoom 이 과확대를 막는다.
          initialViewState={
            isShare
              ? {
                  bounds: [
                    [initialBounds.sw.longitude, initialBounds.sw.latitude],
                    [initialBounds.ne.longitude, initialBounds.ne.latitude],
                  ],
                  fitBoundsOptions: { padding: 60, maxZoom: FOCUS_ZOOM },
                }
              : viewport
          }
```

(`persist=false` 라 `viewportHydrated` 가 처음부터 true — 공유 화면은 Map 이 즉시 마운트된다. `onMoveEnd` 는 그대로 둔다: setBounds/setViewport 가 저장도 재조회도 일으키지 않으므로 무해하다.)

- [ ] **Step 5: 조작 버튼·헤더·모달 분기**

조작 버튼 블록(464-504행): share 모드에서는 목록 토글 하나만, `gated` 없이 —

```tsx
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
        {isShare ? (
          <Button
            variant="outline"
            onClick={() => setListOpen((open) => !open)}
            aria-label="장소 목록"
            aria-pressed={listOpen}
            className="size-11 rounded-full shadow-lg"
          >
            <ListIcon className="size-5" />
          </Button>
        ) : (
          <>
            {/* ...기존 등록·목록·로그인/로그아웃 버튼 세 개 그대로... */}
          </>
        )}
      </div>
```

share 헤더 (버튼 div 앞이나 뒤, 형제로). 목록 패널(z-20)이 열리면 덮도록 z-10:

```tsx
      {share && (
        <div className="bg-background/90 absolute top-4 left-4 z-10 rounded-lg px-3 py-2 shadow-lg backdrop-blur">
          <p className="font-heading text-sm font-medium">
            {share.categoryName}
          </p>
          <p className="text-muted-foreground text-xs tabular-nums">
            공유된 장소 {shownPlaces.length}곳
          </p>
        </div>
      )}
```

`PlaceListPanel` 호출을 share 에 맞춘다:

```tsx
      <PlaceListPanel
        ref={panelRef}
        open={listOpen}
        places={listScope === "map" ? shownPlaces : everyPlace}
        categories={categories}
        scope={listScope}
        onScopeChange={setListScope}
        selectedId={selected?.id ?? null}
        onSelect={onSelectFromList}
        onEdit={isShare ? undefined : setEditing}
        onDelete={isShare ? undefined : setDeleting}
        readOnly={isShare}
        onClose={() => setListOpen(false)}
      />
```

(share 모드에서 scope 는 기본 `"all"` 에서 바뀔 길이 없고 — 토글이 숨어 있다 — `everyPlace` 는 `initialPlaces` 로 초기화되어 있다.)

다섯 모달(CreatePlaceDialog·LoginDialog·SignOutDialog·EditPlaceDialog·DeletePlaceDialog)을 통째로 감싼다:

```tsx
      {!isShare && (
        <>
          {/* ...기존 다섯 모달 그대로... */}
        </>
      )}
```

- [ ] **Step 6: 타입·테스트 확인**

Run: `npx tsc --noEmit && npm test`
Expected: 통과. 기존 `/` 화면 동작은 prop 기본값(null) 덕에 불변.

- [ ] **Step 7: 수동 확인 — 기존 화면 회귀**

`npm run dev` 로 `/` 를 열어: 마커·목록·등록·수정·삭제·로그인/로그아웃, 지도 이동 시 재조회, 새로고침 후 위치 복원이 전과 같은지 훑는다.

- [ ] **Step 8: 커밋**

```bash
git add src/hooks/use-local-state.ts src/components/place-explorer.tsx
git commit -m "feat: Add/장소 탐색 화면에 읽기 전용 공유 모드를 더한다"
```

---

### Task 11: /share/[token] 페이지

**Files:**
- Create: `app/share/[token]/page.tsx`

**Interfaces:**
- Consumes: `getSharedPlaces` (Task 7), `boundsOf`·`FALLBACK_BOUNDS` (Task 3), `PlaceExplorer.share` (Task 10).

- [ ] **Step 1: 구현**

`app/share/[token]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PlaceExplorer } from "@/components/place-explorer"
import { boundsOf, FALLBACK_BOUNDS } from "@/lib/places"
import { getSharedPlaces } from "@/lib/share.server"

// 홈과 같은 이유로 정적 프리렌더를 끈다 — 매 요청이 공유 상태의 최신을
// 반영해야 하고, 빌드 시점에는 DB 도 토큰도 없다.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "공유된 장소 — my-place",
  // 링크를 아는 사람만 보는 페이지다. 검색엔진이 토큰 URL 을 수집해 두면
  // 공유를 꺼도 캐시된 목록이 남는다.
  robots: { index: false, follow: false },
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // 없는 토큰과 공유가 꺼진 토큰은 같은 404 다 — 존재 여부를 새지 않게
  // 하는 것은 수정·삭제 액션과 같은 원칙이다.
  const shared = await getSharedPlaces(token)
  if (!shared) notFound()

  return (
    <main>
      <h1 className="sr-only">{shared.name} — 공유된 장소 지도</h1>
      <PlaceExplorer
        share={{ categoryName: shared.name }}
        initialPlaces={shared.places}
        initialBounds={boundsOf(shared.places) ?? FALLBACK_BOUNDS}
        initialCenter={null}
        initialCategories={[]}
        isAuthenticated={false}
      />
    </main>
  )
}
```

- [ ] **Step 2: 타입·테스트·빌드 확인**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: 전부 통과. (build 는 `NEXT_PUBLIC_SUPABASE_URL` 이 있는 로컬 .env 기준.)

- [ ] **Step 3: 수동 확인 — 공유 흐름 전체**

`npm run dev` 에서:
1. 로그인 → 카테고리 하나에 장소 2곳 이상 등록 → `관리` 에서 그 카테고리 공유 켜기 → 링크 복사.
2. **시크릿 창**(미인증)에서 복사한 링크 접속: 왼쪽 위에 카테고리 이름 헤더, 모든 장소가 보이는 범위로 지도가 뜨고, 마커 팝업·목록 패널·카드 클릭 flyTo 가 동작. 등록·로그인 버튼·카드 ⋮ 메뉴·범위 토글·필터 칩이 **없음**. 카드에 카테고리 라벨이 **없음**. 위치 권한을 묻지 **않음**.
3. 지도를 움직여도 마커가 사라지지 않음(재조회 없음). 새로고침해도 같은 화면(localStorage 미사용 — DevTools Application 탭에서 viewport/bounds 키가 안 생겼는지 확인).
4. 공유 끄기 → 시크릿 창 새로고침 → 404. 다시 켜기 → 같은 URL 이 다시 열림.
5. 아무 문자열 토큰(`/share/abc`) → 404.
6. 공유 중인 카테고리 삭제 → 링크 404.

- [ ] **Step 4: 커밋**

```bash
git add app/share
git commit -m "feat: Add/로그인 없이 보는 카테고리 공유 페이지를 만든다"
```

---

### Task 12: README 갱신 + 최종 검증

**Files:**
- Modify: `README.md` (주요 기능 표·카테고리 절·아키텍처 다이어그램·데이터 모델·디렉터리 구조)

- [ ] **Step 1: README 반영**

- 주요 기능의 카테고리 항목 끝에 공유 문단 추가: 관리 화면에서 카테고리별 공유를 켜고 끌 수 있다는 것, `/share/<토큰>` 링크는 로그인 없이 열리는 읽기 전용 지도라는 것, 토큰은 첫 공유 때 만들어 영구 보관하므로 껐다 켜도 링크가 같다는 것, 꺼진/삭제된 카테고리 링크는 404 라는 것, 공유 화면에는 다른 카테고리 이름이 내려가지 않는다는 것.
- "화면은 `/` 한 페이지뿐입니다" 문구를 공유 페이지 존재에 맞게 손본다 (예: "사용자 화면은 `/` 한 페이지이고, 공유 링크용 읽기 전용 화면 `/share/[token]` 이 있습니다").
- 데이터 모델의 `categories` 항목에 `shareToken`(unique, 첫 공유 시 생성·영구 보관)·`shareEnabled` 를 추가.
- 디렉터리 구조에 `app/share/[token]/page.tsx`, `src/lib/share.server.ts`, `src/lib/share-token.ts` 반영. 테스트 개수 문구(94개/5파일)를 실제 수치로 갱신.
- 배포 절에 한 줄: 배포 DB 에도 `npx prisma db push` 로 새 컬럼을 반영해야 한다.

- [ ] **Step 2: 최종 검증**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 전부 통과.

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: Update/README 에 카테고리 공유 링크를 적는다"
```
