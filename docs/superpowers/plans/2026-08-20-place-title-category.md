# 장소 등록 필드 재정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장소 등록 폼이 제목(필수)과 설명(선택)을 받고, 별점을 제거하고, 카테고리를 Prisma enum 기반 선택 값으로 바꾼다.

**Architecture:** 세 개의 독립적인 변경을 순서대로 적용한다 — (1) 별점 제거, (2) 제목 추가·설명 선택화, (3) 카테고리 enum 전환. 각 태스크는 스키마(`prisma/schema.prisma`) → 검증(`src/schemas/place.ts`) → UI(폼·카드·팝업) → 테스트를 한 번에 훑어 **각 커밋이 타입 체크와 테스트를 모두 통과하는 상태**로 끝난다. 데이터 마이그레이션은 없다 — `places` 테이블이 0행이므로 `prisma db push` 만으로 충분하다.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7 (`prisma-client` generator, 출력 `src/generated/prisma`), Zod 4, react-hook-form 7 + `@hookform/resolvers`, Base UI (`@base-ui/react`) 기반 shadcn 컴포넌트, Tailwind 4, Vitest 4.

설계 문서: [`docs/superpowers/specs/2026-08-20-place-title-category-design.md`](../specs/2026-08-20-place-title-category-design.md)

## Global Constraints

- **UI 문구·주석·커밋 메시지는 한국어.** 기존 코드베이스 전체가 그렇다.
- **커밋 메시지 형식은 기존 이력을 따른다** — `<type>: <동사>/<한국어 요약>` (예: `feat: Add/로그아웃을 확인 모달로 한 단계 감싼다`). 본문에 "왜"를 적는다.
- **`AGENTS.md` 블록은 `next dev`가 다시 써 넣는다.** 그 변경이 작업 트리에 나타나면 되돌리지 말고 그대로 커밋에 포함한다.
- **`prisma/schema.prisma`를 고친 뒤에는 항상 `npx prisma generate` 를 실행한다.** `src/generated/prisma`는 gitignore 대상이므로 커밋에 들어가지 않는다.
- **`npx prisma db push`는 `.env`의 `DATABASE_URL`을 사용한다.** `places` 테이블은 0행이므로 `--accept-data-loss` 프롬프트가 떠도 그대로 진행해도 된다.
- **클라이언트 컴포넌트에서 Prisma enum을 값으로 쓸 때는 `@/generated/prisma/enums` 에서 가져온다.** `@/generated/prisma/client` 는 `node:process`·`node:path`를 import 하는 서버 전용 엔트리다(타입 전용 import 는 예외).
- **검증 명령 3종:** `npm test` (Vitest 전체), `npx tsc --noEmit` (타입), `npm run build` (Next 빌드). 각 태스크 마지막에 앞의 둘을 돌린다.

---

### Task 1: 별점 제거

`rating` 컬럼과 `StarRating` 컴포넌트, `clampRating` 헬퍼를 전부 지운다. 기본값 3점이 조용히 저장되어 값이 신뢰되지 않았고, 표시 외에 쓰이는 곳이 없었다.

**Files:**
- Modify: `prisma/schema.prisma:21`
- Modify: `src/schemas/place.ts:67`, `src/schemas/place.ts:76`
- Modify: `src/lib/places.ts:3-6`
- Modify: `src/components/place-card.tsx`
- Modify: `src/components/place-form.tsx`
- Delete: `src/components/star-rating.tsx`
- Test: `src/lib/places.test.ts`, `src/schemas/place.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `Place` 모델에 `rating` 필드가 없다. `src/lib/places.ts` 는 `SerializedPlace` 타입과 `revivePlace(place: SerializedPlace): Place` 만 export 한다 (`clampRating` 은 사라짐).

- [ ] **Step 1: 테스트를 먼저 고친다 (실패하는 상태로)**

`src/lib/places.test.ts` — `clampRating` describe 블록 전체와 import 를 지운다. 파일 상단이 이렇게 된다:

```ts
import { describe, expect, it } from "vitest"
import { revivePlace, type SerializedPlace } from "@/lib/places"

describe("revivePlace", () => {
```

같은 파일의 픽스처에서 `rating: 4,` 줄을 지우고, "그 외 필드는 값을 그대로 유지한다" 테스트에서 다음 한 줄을 지운다:

```ts
    expect(result.rating).toBe(serialized.rating)
```

`src/schemas/place.test.ts` — `validInput` 에서 `rating: 4,` 줄을 지우고, 별점 테스트 블록 전체를 지운다:

```ts
  it("별점이 범위를 벗어나면 거부한다", () => {
    expect(placeInputSchema.safeParse({ ...validInput, rating: 0 }).success).toBe(
      false
    )
    expect(placeInputSchema.safeParse({ ...validInput, rating: 6 }).success).toBe(
      false
    )
  })
```

- [ ] **Step 2: 테스트를 돌려 상태를 확인한다**

Run: `npm test`
Expected: PASS. 이 태스크는 기능 추가가 아니라 삭제이므로 "실패하는 테스트를 먼저 쓰는" 빨간 단계가 없다 — 지운 테스트가 사라졌을 뿐이다. 대신 이 태스크의 신호는 **Step 3~4 로 스키마에서 `rating` 이 사라진 직후 `npx tsc --noEmit` 이 `place-card.tsx`·`place-form.tsx`·`place.ts` 에서 에러를 내고, Step 5~6 을 거치면 다시 조용해지는 것**이다. 그 에러 목록이 지워야 할 참조의 완전한 목록이다.

- [ ] **Step 3: Prisma 스키마에서 `rating` 을 지운다**

`prisma/schema.prisma` 의 `model Place` 에서 이 줄을 삭제한다:

```prisma
  rating            Int
```

- [ ] **Step 4: 클라이언트를 재생성하고 DB 에 반영한다**

```bash
npx prisma generate
npx prisma db push
```

Expected: `db push` 가 `rating` 컬럼 삭제를 보고한다. 테이블이 0행이라 손실되는 데이터가 없다.

- [ ] **Step 5: `rating` 을 참조하는 코드를 전부 지운다**

`src/schemas/place.ts` — `placeInputSchema` 와 `placeFormSchema` 양쪽에서 이 줄을 삭제한다(두 곳):

```ts
  rating: z.number().int().min(1).max(5),
```

`src/lib/places.ts` — 파일 맨 위 `clampRating` 과 그 주석을 삭제한다. 남는 것은 `import type { Place } ...`, `SerializedPlace`, `revivePlace` 다.

`src/components/place-card.tsx` — import 에서 `clampRating` 을 지우고(`@/lib/places` import 문 자체가 사라진다), `const stars = clampRating(place.rating)` 줄과 별을 그리는 `<p>` 블록을 삭제한다:

```tsx
        <p className="text-sm" aria-label={`별점 ${stars}점`}>
          {"★".repeat(stars)}
          <span className="text-muted-foreground">
            {"★".repeat(5 - stars)}
          </span>
        </p>
```

`src/components/place-form.tsx` — 네 곳을 고친다.

1. import 삭제: `import { StarRating } from "@/components/star-rating"`
2. `defaultValues` 에서 `rating: 3,` 제거 → `defaultValues: { description: "", category: 1 }`
3. 별점 `Field` 블록 전체 삭제:

```tsx
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
```

4. `createPlaceAction` 호출에서 `rating: values.rating,` 줄 제거

- [ ] **Step 6: `StarRating` 컴포넌트를 삭제한다**

```bash
git rm src/components/star-rating.tsx
```

- [ ] **Step 7: 검증**

```bash
npx tsc --noEmit
npm test
```

Expected: 둘 다 통과. `grep -rn "rating" src app prisma --include="*.ts" --include="*.tsx" --include="*.prisma" | grep -v generated` 결과가 비어 있어야 한다.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: Remove/별점을 컬럼째로 걷어낸다

기본값 3점이 조용히 저장되어 값이 신뢰되지 않았고, 표시 외에 쓰이는 곳이
없었다. 점수로 지도를 읽는 일은 앞으로도 없으므로 컬럼·컴포넌트·헬퍼를 모두
지운다.

places 테이블이 0행이라 데이터 손실은 없다.
EOF
)"
```

---

### Task 2: 제목 추가 · 설명 선택화

지금까지 `description` 이 제목 역할을 겸하고 있었다 — 카드의 굵은 줄, 팝업 제목, 두 곳의 이미지 `alt`. 그 역할을 `title` 로 분리하고 `description` 을 선택 값으로 내린다.

**Files:**
- Modify: `prisma/schema.prisma` (`model Place`)
- Modify: `src/schemas/place.ts`
- Modify: `src/components/place-form.tsx`
- Modify: `src/components/place-card.tsx`
- Modify: `src/components/place-explorer.tsx:247`, `src/components/place-explorer.tsx:251`
- Test: `src/schemas/place.test.ts`, `src/lib/places.test.ts`

**Interfaces:**
- Consumes: Task 1 이후의 `Place` 모델 (rating 없음)
- Produces:
  - `Place.title: string` (필수), `Place.description: string | null`
  - `src/schemas/place.ts` 가 내부에 `placeFields` 객체를 두고 `placeFormSchema` 와 `placeInputSchema` 가 그것을 공유한다
  - `PlaceFormValues = { title: string; description?: string | undefined }` (Task 3 에서 `category` 추가)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/schemas/place.test.ts` — `validInput` 에 `title` 을 넣고 `description` 값을 설명답게 바꾼다:

```ts
const validInput = {
  title: "한강 야경",
  description: "다리 조명이 켜지는 시간에 갔다",
  image: `${OWNER}/${OBJECT}.jpg`,
  imageCreationTime: new Date("2026-01-01T00:00:00.000Z"),
  latitude: 37.65874,
  longitude: 126.97759,
  category: 2,
}
```

기존 "설명이 비어 있으면 거부한다" 테스트를 지우고 그 자리에 다음을 넣는다:

```ts
  it("제목이 비어 있으면 거부한다", () => {
    const result = placeInputSchema.safeParse({ ...validInput, title: "" })
    expect(result.success).toBe(false)
  })

  it("제목이 60자를 넘으면 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      title: "가".repeat(61),
    })
    expect(result.success).toBe(false)
  })

  it("설명은 없어도 통과한다", () => {
    const { description: _omitted, ...withoutDescription } = validInput
    const result = placeInputSchema.safeParse(withoutDescription)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeUndefined()
    }
  })

  it("공백만 있는 설명은 undefined 로 접는다", () => {
    // "" 와 null 이 DB 에 섞이면 "설명이 있는지" 판정이 두 갈래가 된다.
    // Prisma 는 undefined 를 "값 없음"으로 보고 nullable 컬럼에 NULL 을 넣는다.
    const result = placeInputSchema.safeParse({ ...validInput, description: "   " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeUndefined()
    }
  })

  it("설명 앞뒤 공백을 다듬는다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      description: "  다리 조명  ",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe("다리 조명")
    }
  })

  it("설명이 500자를 넘으면 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      description: "가".repeat(501),
    })
    expect(result.success).toBe(false)
  })
```

`src/lib/places.test.ts` — 픽스처에 `title` 을 넣고 `description` 을 설명 문구로 바꾼다:

```ts
    title: "한강 야경",
    description: "다리 조명이 켜지는 시간에 갔다",
```

그리고 "그 외 필드는 값을 그대로 유지한다" 테스트에 한 줄을 더한다:

```ts
    expect(result.title).toBe(serialized.title)
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run src/schemas/place.test.ts`
Expected: FAIL — "제목이 비어 있으면 거부한다" 가 실패한다(스키마에 `title` 이 없어 알 수 없는 키로 무시되므로 `success` 가 `true`). "설명은 없어도 통과한다" 도 실패한다(`description` 이 아직 필수).

- [ ] **Step 3: Prisma 스키마에 `title` 을 넣고 `description` 을 nullable 로 만든다**

`prisma/schema.prisma` 의 `model Place` 에서 `description String` 을 다음 두 줄로 교체한다(`longitude` 다음, `category` 앞):

```prisma
  title             String
  description       String?
```

- [ ] **Step 4: 클라이언트를 재생성하고 DB 에 반영한다**

```bash
npx prisma generate
npx prisma db push
```

Expected: `title` 컬럼 추가와 `description` 의 NOT NULL 해제를 보고한다. 0행이므로 NOT NULL 컬럼 추가에 기본값이 필요하지 않다.

- [ ] **Step 5: 검증 스키마를 공통 필드로 묶는다**

`src/schemas/place.ts` — `placeInputSchema` 와 `placeFormSchema` 정의를 다음으로 교체한다:

```ts
/**
 * 폼과 서버 입력이 공유하는 사용자 작성 필드. 예전에는 두 스키마가 같은
 * 필드를 각각 정의해서, 폼의 defaultValues 까지 합쳐 세 곳이 서로 어긋날 수
 * 있었다.
 */
const placeFields = {
  title: z
    .string()
    .min(1, "제목을 입력해 주세요")
    .max(60, "제목은 60자까지 쓸 수 있습니다"),
  /**
   * 손대지 않은 Textarea 는 ""를 보낸다. DB 에 ""와 null 이 섞이면 "설명이
   * 있는지" 판정이 두 갈래가 되므로 경계에서 undefined 로 접는다. Prisma 는
   * undefined 를 "값 없음"으로 보고 nullable 컬럼에 NULL 을 넣는다.
   *
   * transform 을 거쳐도 입력 타입과 출력 타입이 모두 `string | undefined` 라서
   * react-hook-form 이 이 스키마를 그대로 resolver 로 쓸 수 있다.
   */
  description: z
    .string()
    .max(500, "설명은 500자까지 쓸 수 있습니다")
    .transform((value) => value.trim() || undefined)
    .optional(),
}

export const placeInputSchema = z.object({
  ...placeFields,
  image: imagePath,
  imageCreationTime: z.coerce.date(),
  latitude,
  longitude,
  category: z.number().int().min(1).max(4),
})

export type PlaceInput = z.infer<typeof placeInputSchema>

/** 폼이 다루는 값. 이미지는 업로드 전이므로 File이고 좌표는 EXIF에서 온다. */
export const placeFormSchema = z.object({
  ...placeFields,
  category: z.number().int().min(1).max(4),
})

export type PlaceFormValues = z.infer<typeof placeFormSchema>
```

`category` 는 Task 3 에서 `placeFields` 로 옮긴다. 지금은 기존 정수 검증을 그대로 둔다.

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run src/schemas/place.test.ts`
Expected: PASS (전부)

- [ ] **Step 7: 폼에 제목 필드를 넣고 설명을 선택으로 표시한다**

`src/components/place-form.tsx` — 네 곳을 고친다.

1. `Input` import 를 더한다(`@/components/ui/field` import 아래):

```tsx
import { Input } from "@/components/ui/input"
```

2. `defaultValues` 를 바꾼다:

```tsx
    defaultValues: { title: "", description: "", category: 1 },
```

3. 설명 `Field` **앞에** 제목 `Field` 를 넣는다:

```tsx
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
```

4. 설명 라벨에 선택 사항임을 표시하고 placeholder 를 설명답게 바꾼다:

```tsx
        <FieldLabel htmlFor="description">
          설명{" "}
          <span className="text-muted-foreground font-normal">(선택)</span>
        </FieldLabel>
```

```tsx
              placeholder="이 장소는 어땠나요? (비워 둘 수 있어요)"
```

5. `createPlaceAction` 호출에 `title` 을 더한다 — `description` 바로 위:

```tsx
      const result = await createPlaceAction({
        title: values.title,
        description: values.description,
```

- [ ] **Step 8: 카드와 팝업이 제목을 쓰게 한다**

`src/components/place-card.tsx` — `CardContent` 안의 본문을 다음으로 교체한다:

```tsx
        <p className="font-medium">{place.title}</p>
        {place.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {place.description}
          </p>
        )}
```

같은 파일의 `Image` 에서 `alt={place.description}` → `alt={place.title}`.

`src/components/place-explorer.tsx` — 팝업 두 곳을 고친다(247행, 251행):

```tsx
                <p className="font-medium">{selected.title}</p>
```

```tsx
                    alt={selected.title}
```

설명은 팝업에 넣지 않는다 — 폭이 260px 이고, 전문은 카드에서 읽는다.

- [ ] **Step 9: 검증**

```bash
npx tsc --noEmit
npm test
```

Expected: 둘 다 통과.

- [ ] **Step 10: 사람 눈으로 확인한다**

```bash
npm run dev
```

확인할 것:
1. 등록 모달에 제목·설명·카테고리 순으로 필드가 보인다
2. 제목을 비운 채 저장하면 "제목을 입력해 주세요" 가 뜬다
3. 설명을 비운 채 저장하면 성공한다
4. 저장한 장소의 카드에 제목이 굵게, 설명이 있으면 그 아래 흐리게 보인다
5. 설명 없이 저장한 장소의 카드에는 설명 줄이 아예 없다(빈 줄이 남지 않는다)

- [ ] **Step 11: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Add/제목을 받고 설명을 선택으로 내린다

description 이 제목 역할을 겸하고 있었다 — 카드의 굵은 줄, 팝업 제목, 두 곳의
이미지 alt. 정작 설명을 적을 자리는 없었다. 그 역할을 title 로 갈라내고
description 은 쓰고 싶은 사람만 쓰게 한다.

공백만 있는 설명은 경계에서 undefined 로 접는다. "" 와 null 이 DB 에 섞이면
"설명이 있는지" 판정이 두 갈래가 된다.

placeInputSchema 와 placeFormSchema 가 같은 필드를 각각 정의하던 것도 함께
정리했다. 폼의 defaultValues 까지 세면 세 곳이 어긋날 수 있었다.
EOF
)"
```

---

### Task 3: 카테고리 enum 전환 · `풍경` 추가

`category Int` 는 DB 에서 읽히지 않고 제약도 없었으며, `defaultValues: { category: 1 }` 때문에 신경 쓰지 않은 장소가 전부 "카페"로 저장됐다. 문자열 enum + 선택 값으로 바꾸고 `풍경` 을 추가한다.

**Files:**
- Modify: `prisma/schema.prisma` (enum 추가, `category` 타입 변경)
- Modify: `src/schemas/place.ts`
- Modify: `src/lib/categories.ts`
- Modify: `src/components/category-picker.tsx`
- Modify: `src/components/place-form.tsx`
- Modify: `src/components/place-card.tsx`
- Test: `src/schemas/place.test.ts`, `src/lib/places.test.ts`

**Interfaces:**
- Consumes: Task 2 이후의 `placeFields` 객체와 `Place` 모델
- Produces:
  - `@/generated/prisma/enums` 가 `PlaceCategory` 를 const 객체 + 동명 타입으로 export 한다: `{ CAFE, RESTAURANT, STAY, ATTRACTION, SCENERY }`
  - `Place.category: PlaceCategory | null`
  - `categoryLabel(value: PlaceCategory | null): string | null`
  - `CategoryPicker` props: `{ value: PlaceCategory | null; onChange: (value: PlaceCategory | null) => void }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/schemas/place.test.ts` — `validInput` 의 `category: 2,` 를 문자열로 바꾼다:

```ts
  category: "RESTAURANT",
```

기존 "카테고리가 범위를 벗어나면 거부한다" 테스트를 다음으로 교체한다:

```ts
  it("정의된 카테고리를 통과시킨다", () => {
    expect(
      placeInputSchema.safeParse({ ...validInput, category: "SCENERY" }).success
    ).toBe(true)
  })

  it("카테고리 미선택(null)을 통과시킨다", () => {
    const result = placeInputSchema.safeParse({ ...validInput, category: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBeNull()
    }
  })

  it("enum 에 없는 카테고리를 거부한다", () => {
    // "기타" 는 두지 않는다. nullable 컬럼에 ETC 까지 있으면 "기타" 와
    // "미선택" 이 같은 말을 두 번 하게 된다.
    expect(
      placeInputSchema.safeParse({ ...validInput, category: "ETC" }).success
    ).toBe(false)
  })

  it("옛 정수 카테고리 코드를 거부한다", () => {
    expect(
      placeInputSchema.safeParse({ ...validInput, category: 2 }).success
    ).toBe(false)
  })
```

`src/lib/places.test.ts` — 픽스처의 `category: 2,` 를 바꾼다:

```ts
    category: "RESTAURANT",
```

새 테스트 파일 `src/lib/categories.test.ts` 를 만든다:

```ts
import { describe, expect, it } from "vitest"
import { PlaceCategory } from "@/generated/prisma/enums"
import { CATEGORIES, categoryLabel } from "@/lib/categories"

describe("CATEGORIES", () => {
  it("enum 의 모든 항목에 라벨이 있다", () => {
    // 이 테스트는 타입 단정(_CategoriesAreExhaustive)의 런타임 짝이다.
    // 항목을 추가하고 라벨을 빠뜨리면 컴파일과 테스트가 함께 깨진다.
    const labelled = CATEGORIES.map((category) => category.value)
    expect(labelled.toSorted()).toEqual(Object.values(PlaceCategory).toSorted())
  })

  it("풍경을 포함한다", () => {
    expect(CATEGORIES.some((c) => c.value === "SCENERY")).toBe(true)
  })
})

describe("categoryLabel", () => {
  it("enum 값을 한국어 라벨로 바꾼다", () => {
    expect(categoryLabel("SCENERY")).toBe("풍경")
    expect(categoryLabel("CAFE")).toBe("카페")
  })

  it("미선택이면 null 을 돌려준다", () => {
    // 예전에는 "기타" 로 폴백해서, 고른 적 없는 카테고리가 카드에 라벨로
    // 찍혔다. 호출자가 자리를 비울 수 있어야 한다.
    expect(categoryLabel(null)).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run src/lib/categories.test.ts src/schemas/place.test.ts`
Expected: FAIL — `src/lib/categories.test.ts` 는 `@/generated/prisma/enums` 에 `PlaceCategory` 가 없어 `Object.values(undefined)` 로 죽고, `place.test.ts` 는 "옛 정수 카테고리 코드를 거부한다" 가 실패한다.

- [ ] **Step 3: Prisma 스키마에 enum 을 넣는다**

`prisma/schema.prisma` — `model Place` 의 `category Int` 를 바꾼다:

```prisma
  category          PlaceCategory?
```

파일 끝(`model Place` 블록 뒤)에 enum 을 더한다:

```prisma
enum PlaceCategory {
  CAFE
  RESTAURANT
  STAY
  ATTRACTION
  SCENERY
}
```

- [ ] **Step 4: 클라이언트를 재생성하고 DB 에 반영한다**

```bash
npx prisma generate
npx prisma db push
```

Expected: `src/generated/prisma/enums.ts` 가 다음을 export 한다(확인할 것):

```ts
export const PlaceCategory = {
  CAFE: 'CAFE',
  RESTAURANT: 'RESTAURANT',
  STAY: 'STAY',
  ATTRACTION: 'ATTRACTION',
  SCENERY: 'SCENERY'
} as const

export type PlaceCategory = (typeof PlaceCategory)[keyof typeof PlaceCategory]
```

`db push` 는 `places_category` 타입 생성과 컬럼 타입 변경(`integer` → enum, NOT NULL 해제)을 보고한다. 0행이라 캐스팅할 데이터가 없다.

- [ ] **Step 5: 라벨 맵을 문자열 enum 기반으로 바꾼다**

`src/lib/categories.ts` 전체를 다음으로 교체한다:

```ts
import type { PlaceCategory } from "@/generated/prisma/enums"

export const CATEGORIES = [
  { value: "CAFE", label: "카페" },
  { value: "RESTAURANT", label: "식당" },
  { value: "STAY", label: "숙소" },
  { value: "ATTRACTION", label: "명소" },
  // 명소는 가서 보는 대상, 풍경은 그 자리에서 보이는 경치다. EXIF 좌표로
  // 기록하는 앱에서는 실제로 갈리는 축이다.
  { value: "SCENERY", label: "풍경" },
] as const satisfies readonly { value: PlaceCategory; label: string }[]

/**
 * enum 에 항목을 추가하고 위 목록에 라벨을 빠뜨리면 여기서 컴파일이 깨진다.
 * `satisfies` 는 그 반대 방향(enum 에 없는 값을 적는 실수)만 잡는다.
 */
type AssertNever<T extends never> = T
export type _CategoriesAreExhaustive = AssertNever<
  Exclude<PlaceCategory, (typeof CATEGORIES)[number]["value"]>
>

/**
 * 미선택이면 라벨이 없다. 예전에는 "기타" 로 폴백해서, 고른 적 없는
 * 카테고리가 카드에 라벨로 찍혔다.
 */
export function categoryLabel(value: PlaceCategory | null): string | null {
  return CATEGORIES.find((category) => category.value === value)?.label ?? null
}
```

- [ ] **Step 6: 검증 스키마의 `category` 를 공통 필드로 옮긴다**

`src/schemas/place.ts` — 파일 상단 import 에 다음을 더한다:

```ts
import { PlaceCategory } from "@/generated/prisma/enums"
```

`placeFields` 에 `category` 를 더한다(`description` 다음):

```ts
  /**
   * 선택 값이다. 기본값을 두면 신경 쓰지 않은 장소가 전부 그 값으로
   * 저장되어(옛 코드의 category: 1 = 카페) 값 자체를 믿을 수 없게 된다.
   */
  category: z.enum(PlaceCategory).nullable(),
```

그리고 `placeInputSchema` 와 `placeFormSchema` 에서 각각 이 줄을 지운다:

```ts
  category: z.number().int().min(1).max(4),
```

`placeFormSchema` 는 `z.object(placeFields)` 만 남는다:

```ts
/** 폼이 다루는 값. 이미지는 업로드 전이므로 File이고 좌표는 EXIF에서 온다. */
export const placeFormSchema = z.object(placeFields)
```

- [ ] **Step 7: 피커가 문자열 값을 쓰고 해제도 되게 한다**

`src/components/category-picker.tsx` 전체를 다음으로 교체한다:

```tsx
"use client"

import type { PlaceCategory } from "@/generated/prisma/enums"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CATEGORIES } from "@/lib/categories"

export function CategoryPicker({
  value,
  onChange,
}: {
  value: PlaceCategory | null
  onChange: (value: PlaceCategory | null) => void
}) {
  return (
    <ToggleGroup
      value={value ? [value] : []}
      onValueChange={(next) => {
        // multiple 이 false 인 ToggleGroup 은 눌린 항목을 다시 누르면 빈
        // 배열을 준다. 옛 코드는 그 빈 배열을 무시해서, 한 번 고른
        // 카테고리를 해제할 방법이 없었다 — 잘못 눌러도 되돌릴 수 없으면
        // 선택 사항이 아니다.
        //
        // 목록에서 찾아 넘기므로 캐스팅 없이 PlaceCategory 로 좁혀진다.
        const selected = CATEGORIES.find((category) => category.value === next[0])
        onChange(selected?.value ?? null)
      }}
      variant="outline"
      // 항목이 5개라 좁은 화면에서 한 줄에 들어가지 않는다. ToggleGroup 의
      // 기본 클래스가 w-fit 이므로 max-w-full 을 함께 줘야 접힌다.
      className="max-w-full flex-wrap justify-start"
    >
      {CATEGORIES.map((category) => (
        <ToggleGroupItem
          key={category.value}
          value={category.value}
          aria-label={category.label}
        >
          {category.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
```

- [ ] **Step 8: 폼 기본값을 미선택으로 바꾼다**

`src/components/place-form.tsx` — `defaultValues` 를 바꾼다:

```tsx
    defaultValues: { title: "", description: "", category: null },
```

카테고리 라벨에도 선택 사항임을 표시한다:

```tsx
        <FieldLabel>
          카테고리{" "}
          <span className="text-muted-foreground font-normal">(선택)</span>
        </FieldLabel>
```

`createPlaceAction` 호출의 `category: values.category,` 는 그대로 둔다.

- [ ] **Step 9: 카드가 미선택 카테고리 자리를 비우게 한다**

`src/components/place-card.tsx` — `takenAt` 계산 아래에 라벨을 뽑고, 표시 부분을 조건부로 바꾼다:

```tsx
  const category = categoryLabel(place.category)
```

```tsx
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>{takenAt}</span>
          {category && <span>{category}</span>}
        </div>
```

- [ ] **Step 10: 검증**

```bash
npx tsc --noEmit
npm test
```

Expected: 둘 다 통과.

`AssertNever` 가 실제로 작동하는지 한 번 확인한다 — `src/lib/categories.ts` 의 `CATEGORIES` 에서 `SCENERY` 줄을 잠시 지우고 `npx tsc --noEmit` 을 돌리면 `_CategoriesAreExhaustive` 에서 에러가 나야 한다. 확인 후 되돌린다.

- [ ] **Step 11: 사람 눈으로 확인한다**

```bash
npm run dev
```

확인할 것:
1. 등록 모달의 카테고리에 다섯 항목(카페·식당·숙소·명소·풍경)이 보이고, 처음에는 **아무것도 선택되어 있지 않다**
2. 항목을 눌러 선택하고, **같은 항목을 다시 누르면 해제된다**
3. 브라우저 창을 좁히면 항목이 두 줄로 접힌다(가로로 넘치지 않는다)
4. 카테고리 없이 저장한 장소의 카드에는 오른쪽 라벨이 없다(날짜만 보인다)
5. 카테고리를 고른 장소의 카드에는 그 라벨이 보인다

- [ ] **Step 12: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: Change/카테고리를 정수 코드에서 enum 으로 바꾸고 풍경을 더한다

category Int 에는 세 가지 문제가 있었다. DB 에서 값이 읽히지 않고, zod 의
min(1).max(4) 밖에는 제약이 없어 항목을 재정렬하면 의미가 밀리고,
defaultValues: { category: 1 } 때문에 신경 쓰지 않은 장소가 전부 "카페"로
저장됐다.

문자열 enum 으로 바꿔 값이 읽히고 DB 가 제약을 걸게 했다. 기본값을 없애
미선택은 null 로 두고, 라벨 폴백 "기타" 도 지웠다 — nullable 컬럼에 ETC 까지
있으면 "기타" 와 "미선택" 이 같은 말을 두 번 한다.

피커는 같은 항목을 다시 눌러 해제할 수 있게 했다. 되돌릴 수 없으면 선택
사항이 아니다.

별점과 달리 카테고리를 살린 이유는 앞으로의 쓸모다. 점수로 지도를 읽는 일은
없지만, 카테고리는 마커 아이콘·색 구분과 목록 필터라는 다음 단계가 있고 그때
정수 코드가 걸림돌이 된다.
EOF
)"
```

---

### Task 4: README 갱신

**Files:**
- Modify: `README.md:17`, `README.md:26`, `README.md:93`

**Interfaces:**
- Consumes: Task 1~3 의 최종 상태
- Produces: 없음 (문서)

- [ ] **Step 1: 기능 표의 등록 흐름을 고친다**

`README.md` 17행 — `설명/별점/카테고리 입력` 을 `제목·설명(선택)·카테고리(선택) 입력` 으로 바꾼다. 그 행 전체:

```markdown
| 등록 | 오른쪽 위 `MapPinPlus` 아이콘 | 모달로 등록 폼을 띄운다. 사진 업로드 → EXIF 파싱 → 폼 안 지도에 촬영 위치 표시 → 제목·설명(선택)·카테고리(선택) 입력 후 저장. 저장하면 모달이 닫히고 지도가 그 좌표로 날아간다 |
```

- [ ] **Step 2: 기능 목록의 별점 항목을 교체한다**

`README.md` 26행 — `- **별점 / 카테고리 선택** — 커스텀 별점 컴포넌트와 shadcn \`ToggleGroup\` 기반 카테고리 선택.` 을 다음으로 바꾼다:

```markdown
- **카테고리 선택** — `ToggleGroup` 기반 5지선다(카페·식당·숙소·명소·풍경)이며 선택 사항입니다. 같은 항목을 다시 누르면 해제됩니다. 값은 Prisma enum `PlaceCategory` 이고 미선택은 `null` 입니다.
```

- [ ] **Step 3: 데이터 모델 줄을 고친다**

`README.md` 93행을 다음으로 바꾼다:

```markdown
`places` 테이블 (Prisma `Place`) — `userId`(인덱스), `image`, `imageCreationTime`, `latitude`, `longitude`, `title`, `description`(nullable), `category`(`PlaceCategory` enum, nullable), `createdAt`, `updatedAt`.
```

- [ ] **Step 4: 낡은 언급이 더 없는지 확인한다**

```bash
grep -n "별점\|rating\|기타" README.md
```

Expected: 별점·rating 언급이 없다. (`기타` 는 다른 문맥의 "그 외 스크립트" 등이라면 그대로 둔다.)

- [ ] **Step 5: 커밋**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: Update/README 의 등록 필드 설명을 실제와 맞춘다

별점이 사라지고 제목이 생겼으며 카테고리가 enum·선택 값이 되었다.
EOF
)"
```

---

## Self-Review

**스펙 커버리지**

| 스펙 항목 | 태스크 |
|---|---|
| 1절 제목 필수 | Task 2 |
| 1절 설명 선택 | Task 2 |
| 1절 별점 제거 | Task 1 |
| 1절 카테고리 enum·선택·`풍경` | Task 3 |
| 2절 결정 표 전체 | Task 1~3 (각 커밋 메시지가 근거를 담음) |
| 3절 데이터 모델 | Task 1 Step 3, Task 2 Step 3, Task 3 Step 3 |
| 3절 `supabase/migrations/` 에 파일 추가 안 함 | 어느 태스크도 그 디렉터리를 건드리지 않음 |
| 4절 공통 필드 추출·description 접기 | Task 2 Step 5, Task 3 Step 6 |
| 5절 라벨 맵·`categoryLabel` 반환형·누락 단정 | Task 3 Step 5 |
| 6절 폼 필드 순서·`flex-wrap`·해제 가능 | Task 2 Step 7, Task 3 Step 7~8 |
| 7절 카드·팝업·`clampRating` 삭제 | Task 1 Step 5, Task 2 Step 8, Task 3 Step 9 |
| 8절 테스트 | Task 1 Step 1, Task 2 Step 1, Task 3 Step 1 |
| 9절 README 3개 지점 | Task 4 |

누락 없음.

**타입 일관성**

- `PlaceCategory` 는 Task 3 에서 `@/generated/prisma/enums` 에서 가져오며 스키마·라벨·피커·카드가 모두 같은 출처를 쓴다
- `categoryLabel` 시그니처(`PlaceCategory | null → string | null`)가 Task 3 Step 5 정의와 Step 9 사용처에서 일치
- `CategoryPicker` props 가 Task 3 Step 7 정의와 폼의 `Controller` 사용처에서 일치(`field.value` 는 `PlaceCategory | null`)
- `placeFields` 는 Task 2 에서 만들어지고 Task 3 에서 `category` 가 더해진다 — Task 3 은 Task 2 이후에만 실행 가능하다

**태스크 간 컴파일 가능성**

각 태스크는 스키마·검증·UI·테스트를 함께 고쳐 끝나므로, 태스크 경계에서 `npx tsc --noEmit` 과 `npm test` 가 모두 통과한다. 중간에 깨진 트리를 커밋하지 않는다.
