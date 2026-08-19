# MapLibre 전환 · 이미지 Supabase Storage 통합 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도를 Mapbox GL에서 MapLibre GL + OpenFreeMap으로, 이미지 저장소를 Cloudinary에서 Supabase Storage로 옮겨 외부 벤더를 Supabase 한 곳으로 줄인다.

**Architecture:** `react-map-gl` v8이 mapbox/maplibre 두 엔트리를 동일 API로 제공하므로 지도 전환은 import 경로와 스타일 URL 교체로 끝난다. 이미지는 서버 액션이 시크릿 키로 서명 업로드 URL을 발급하고 브라우저가 그 URL로 직접 PUT하는 방식이라 브라우저에 Supabase 키가 나가지 않는다. Free 플랜이라 Storage 이미지 변환을 쓸 수 없으므로 최적화는 Next.js 내장 Image Optimization이 담당하고, DB `image` 컬럼에는 전체 URL 대신 storage path를 저장한다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Prisma 6 + PostgreSQL(Supabase), MapLibre GL + `react-map-gl` 8, `@supabase/supabase-js` 2, Tailwind 4 + shadcn/ui, Vitest

**설계 문서:** `docs/superpowers/specs/2026-08-19-maplibre-supabase-storage-design.md`

## Global Constraints

- Supabase 프로젝트 ref는 `xhttvfbzqhprmentinxm`, 리전 `ap-northeast-1`.
- 환경 변수는 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DATABASE_URL` 세 개만 사용한다. 이미 `.env`에 채워져 있다.
- `SUPABASE_SECRET_KEY`는 신규 `sb_secret_...` 형식이다. 레거시 `service_role` 키를 쓰지 않는다. 절대 `NEXT_PUBLIC_` 접두사를 붙이지 않고, 클라이언트 컴포넌트에서 참조하지 않는다.
- `public.places`는 RLS 활성 · 정책 0개 상태이며 **이 상태를 유지한다.** 정책을 추가하지 않는다. Prisma는 테이블 소유자 롤로 접속해 RLS를 우회한다(실측 확인됨).
- 인증은 구현하지 않는다. `getCurrentUserId()`는 고정값 `"1"` 스텁을 유지한다.
- Storage 버킷 이름은 `places`, public read.
- 허용 이미지 MIME은 `image/jpeg`, `image/png`, `image/webp` 세 개뿐이다. HEIC는 지원하지 않는다.
- 저장 경로 형식은 `<uuid v4>.<jpg|png|webp>`이며 하위 폴더를 쓰지 않는다.
- 테스트는 Vitest, `src/**/*.test.ts`만 수집되며 `environment: "node"`다. `@` 별칭은 `./src`.
- 코드 주석과 사용자 노출 문자열은 한국어로 쓴다. 기존 파일의 주석 밀도와 문체를 따른다.
- 커밋 메시지는 기존 이력의 `<type>: <Verb>/<한국어 요약>` 형식을 따른다(예: `fix: Restore/map preview on the create page`).

---

## File Structure

| 파일 | 책임 | 변화 |
| --- | --- | --- |
| `src/lib/supabase.ts` | 시크릿 키를 쓰는 서버 전용 Supabase 클라이언트 | 신규 |
| `src/lib/images.ts` | storage path → 공개 URL 조립 (순수 함수, 서버·클라이언트 공용) | 신규 |
| `src/lib/images.test.ts` | 위 단위 테스트 | 신규 |
| `src/actions/place.ts` | 서명 업로드 URL 발급, Place 생성 | 수정 |
| `src/components/place-form.tsx` | 업로드 폼, 확인용 지도 | 수정 |
| `src/components/map-view.tsx` | 지도 + 마커 + 팝업 | 수정 |
| `src/components/place-card.tsx` | 홈 사진 카드 | 수정 |
| `src/lib/places.ts` | Place 조회, 직렬화 왕복 | 수정 (publicId 개념 제거) |
| `src/lib/places.test.ts` | 위 단위 테스트 | 수정 |
| `src/schemas/place.ts` | Zod 스키마 | 수정 (`image` 검증) |
| `src/schemas/place.test.ts` | 위 단위 테스트 | 수정 |
| `src/lib/cloudinary-loader.ts` | — | 삭제 |
| `src/auth/*` (3개) | — | 삭제 |
| `next.config.ts` | 이미지 설정 | 수정 |
| `src/types/env.d.ts` | env 타입 선언 | 수정 |
| `README.md` | 기술 스택 문서 | 수정 |

`app/page.tsx`, `app/map/page.tsx`, `app/api/places/route.ts`는 **수정하지 않는다.** 반환 타입을 추론으로만 사용하므로 타입 변화가 그대로 흘러간다.

### 설계 문서의 작업 순서와 다른 점

설계 11절은 이미지 저장소 전환(쓰기)을 publicId 제거(읽기)보다 앞에 두었으나, 이 계획은 순서를 뒤집고 4행 삭제를 읽기 경로 태스크로 당겼다. 쓰기를 먼저 바꾸면 새 업로드가 path를 저장하는데 렌더링은 여전히 Cloudinary 로더를 타므로 두 커밋 사이에 이미지가 깨진 상태가 생긴다. 읽기를 먼저 바꾸고 행을 비우면 그 구간의 정상 상태가 "빈 목록"이 되어 깨진 상태를 만들지 않는다.

---

## Task 1: Storage 버킷 생성과 서명 URL 업로드 실증

설계의 유일한 미검증 가정을 먼저 해소한다. `fetch(signedUrl, { method: "PUT" })`이 동작하지 않으면 클라이언트에 publishable 키가 필요해지므로, 다른 작업을 쌓기 전에 확인한다.

**Files:**
- Create: `src/lib/supabase.ts`
- Modify: `package.json` (의존성 추가)

**Interfaces:**
- Consumes: 없음
- Produces: `supabaseAdmin` — `@supabase/supabase-js`의 `SupabaseClient`. Task 4의 서버 액션이 `supabaseAdmin.storage.from("places").createSignedUploadUrl(path)`로 사용한다.

- [ ] **Step 1: `@supabase/supabase-js` 설치**

```bash
npm install @supabase/supabase-js@^2.112.3
```

- [ ] **Step 2: `places` 버킷 생성**

Supabase MCP의 `apply_migration`으로 아래 SQL을 적용한다. 마이그레이션 이름은 `create_places_storage_bucket`.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'places',
  'places',
  true,
  10485760,
  '{image/jpeg,image/png,image/webp}'
)
on conflict (id) do nothing;
```

`file_size_limit`(10MB)과 `allowed_mime_types`는 애플리케이션 검증을 버킷 수준에서 한 번 더 받치는 장치다. 앱 코드에 버그가 있어도 버킷이 거부한다.

- [ ] **Step 3: 버킷 생성 확인**

`execute_sql`로 확인한다.

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
```

기대: `places` 1행, `public = true`, `file_size_limit = 10485760`, `allowed_mime_types = {image/jpeg,image/png,image/webp}`.

- [ ] **Step 4: 서버 전용 Supabase 클라이언트 작성**

`src/lib/supabase.ts`를 만든다. `src/lib/auth.ts`와 같이 `server-only`를 import해 클라이언트 번들 유입을 컴파일 단계에서 막는다.

```ts
import "server-only"

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !secretKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 필요합니다"
  )
}

/**
 * 시크릿 키를 쓰는 서버 전용 클라이언트. RLS 를 우회하므로 절대 클라이언트
 * 컴포넌트로 내보내지 않는다. server-only import 가 그 사고를 컴파일 시점에
 * 막아 준다.
 *
 * 인증을 쓰지 않으므로 세션 저장과 토큰 갱신을 끈다. 서버에서는 요청마다
 * 상태가 없어야 한다.
 */
export const supabaseAdmin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const PLACES_BUCKET = "places"
```

- [ ] **Step 5: 업로드 왕복 실증 스크립트 작성**

일회용 스크립트다. 프로젝트 루트에 만들어야 `@supabase/supabase-js`가 해석된다.

```bash
cat > _spike.mjs <<'EOF'
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// 1x1 빨간 점 PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64"
)
const path = `${crypto.randomUUID()}.png`

const { data, error } = await supabase.storage
  .from("places")
  .createSignedUploadUrl(path)
if (error) throw new Error(`서명 URL 발급 실패: ${error.message}`)
console.log("서명 URL 발급 성공, path:", data.path)

// 핵심 검증: supabase-js 없이 raw PUT 으로 올라가는가
const put = await fetch(data.signedUrl, {
  method: "PUT",
  headers: { "content-type": "image/png" },
  body: png,
})
console.log("PUT 응답:", put.status, put.ok ? "성공" : await put.text())
if (!put.ok) throw new Error("raw PUT 실패 — uploadToSignedUrl 폴백 필요")

// public 버킷이므로 키 없이 읽혀야 한다
const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/places/${path}`
const get = await fetch(publicUrl)
console.log("공개 URL 응답:", get.status, get.headers.get("content-type"))
if (!get.ok) throw new Error("공개 URL 읽기 실패")

// 정리
await supabase.storage.from("places").remove([path])
console.log("\n실증 완료: raw PUT 방식 사용 가능")
EOF
node --env-file=.env _spike.mjs; rm -f _spike.mjs
```

- [ ] **Step 6: 결과 판정**

기대 출력: `서명 URL 발급 성공` → `PUT 응답: 200 성공` → `공개 URL 응답: 200 image/png` → `실증 완료`.

- **성공하면** Task 4를 계획대로 진행한다.
- **`raw PUT 실패`가 나오면** 폴백으로 전환한다. Task 4에서 클라이언트가 `@supabase/supabase-js`의 `uploadToSignedUrl(path, token, file)`을 쓰고, 서버 액션이 `token`도 함께 반환하며, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_s7_yL-1GSaRnr6yC9D6YGg_Jy9GmvRB`를 `.env`와 `src/types/env.d.ts`에 추가한다. 이 분기는 다른 태스크에 영향을 주지 않는다. **어느 경로를 택했는지 커밋 메시지에 남긴다.**

- [ ] **Step 7: 커밋**

```bash
git add package.json package-lock.json src/lib/supabase.ts
git commit -m "feat: Add/Supabase Storage 서버 클라이언트와 places 버킷"
```

---

## Task 2: MapLibre + OpenFreeMap 전환

지도는 이미지 경로와 완전히 독립적이므로 먼저 끝내고 단독으로 검증한다.

**Files:**
- Modify: `src/components/map-view.tsx:3`, `src/components/map-view.tsx:11-15`, `src/components/map-view.tsx:137-138`
- Modify: `src/components/place-form.tsx:3`, `src/components/place-form.tsx:11`, `src/components/place-form.tsx:228-229`
- Modify: `package.json`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (내부 구현 교체)

- [ ] **Step 1: 의존성 교체**

```bash
npm uninstall mapbox-gl
npm install maplibre-gl
```

`react-map-gl` 8.1.2는 `mapbox-gl`과 `maplibre-gl`을 모두 optional peer로 두고 `./mapbox`, `./maplibre` 두 엔트리를 export한다. 패키지 자체는 교체하지 않는다.

- [ ] **Step 2: `map-view.tsx` 전환**

3행:

```diff
-import "mapbox-gl/dist/mapbox-gl.css"
+import "maplibre-gl/dist/maplibre-gl.css"
```

11-15행:

```diff
-import Map, {
-  Marker,
-  Popup,
-  type ViewStateChangeEvent,
-} from "react-map-gl/mapbox"
+import Map, {
+  Marker,
+  Popup,
+  type ViewStateChangeEvent,
+} from "react-map-gl/maplibre"
```

137-138행:

```diff
-        mapStyle="mapbox://styles/mapbox/streets-v12"
-        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_TOKEN}
+        mapStyle="https://tiles.openfreemap.org/styles/liberty"
```

`Marker`의 `color="#ef4444"`, `Popup`의 `closeOnClick` / `maxWidth`, `e.target.getBounds()`의 `getSouth()` / `getWest()` / `getNorth()` / `getEast()`는 그대로 둔다. MapLibre에서 동일하게 동작한다.

120-126행의 `initialViewState` 관련 주석은 `@vis.gl/react-mapbox`를 언급한다. 경로를 `@vis.gl/react-maplibre`로 고친다. 동작은 두 패키지가 같으므로 설명 내용 자체는 유효하다.

- [ ] **Step 3: `place-form.tsx` 전환**

3행:

```diff
-import "mapbox-gl/dist/mapbox-gl.css"
+import "maplibre-gl/dist/maplibre-gl.css"
```

11행:

```diff
-import Map, { Marker, type MapRef } from "react-map-gl/mapbox"
+import Map, { Marker, type MapRef } from "react-map-gl/maplibre"
```

228-229행:

```diff
-            mapStyle="mapbox://styles/mapbox/streets-v12"
-            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_TOKEN}
+            mapStyle="https://tiles.openfreemap.org/styles/liberty"
```

`mapRef.current?.panTo({ lng, lat }, { duration: 3000 })`은 MapLibre에서도 같은 시그니처다. 그대로 둔다.

- [ ] **Step 4: 타입 체크와 잔여 참조 확인**

```bash
npx tsc --noEmit
grep -rn "mapbox" src app next.config.ts
```

기대: `tsc`는 오류 없음. `grep`은 결과가 없어야 한다(0건). 결과가 나오면 그 줄을 처리한다.

- [ ] **Step 5: 지도 실행 검증**

```bash
npm run dev
```

`http://localhost:3000/map`을 열어 확인한다.

1. 지도 타일이 렌더링된다(회색 빈 화면이 아니다).
2. 팬/줌 후 1초 뒤 `GET /api/places?swLat=...` 요청이 발생한다(네트워크 탭).
3. 새로고침 시 직전 뷰포트 위치가 복원된다.
4. 브라우저 콘솔에 MapLibre 오류가 없다.
5. **한국 지명이 한글로 표기되는지 확인한다.** 이것이 이 태스크의 유일한 품질 판단 지점이다. 만족스럽지 않으면 구현을 멈추지 말고 그대로 커밋한 뒤 사용자에게 보고한다 — 대응은 `mapStyle` URL 교체뿐이므로 나중에 독립적으로 처리할 수 있다.

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json src/components/map-view.tsx src/components/place-form.tsx
git commit -m "feat: Change/지도를 MapLibre + OpenFreeMap 으로 전환"
```

---

## Task 3: 이미지 읽기 경로 — `publicImageUrl` 도입과 `publicId` 제거

`image` 컬럼의 의미를 Cloudinary URL에서 storage path로 바꾸고, 마지막 세그먼트를 잘라내던 우회 장치를 없앤다. 기존 4행을 먼저 지우므로 이 태스크가 끝난 시점의 정상 상태는 "빈 목록"이다.

**Files:**
- Create: `src/lib/images.ts`, `src/lib/images.test.ts`
- Modify: `src/lib/places.ts:1-60`, `src/lib/places.test.ts:1-27`, `src/lib/places.test.ts:55-95`
- Modify: `src/components/place-card.tsx:4-19`, `src/components/map-view.tsx:14-19`, `src/components/map-view.tsx:46-69`, `src/components/map-view.tsx:151`
- Modify: `next.config.ts`
- Delete: `src/lib/cloudinary-loader.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `publicImageUrl(path: string): string` — `src/lib/images.ts`. storage path를 공개 URL로 만든다. Task 4는 이 함수를 쓰지 않는다(쓰기 경로는 path만 다룬다).
  - `src/lib/places.ts`가 더 이상 `PlaceWithPublicId`, `publicIdFromUrl`, `withPublicId`를 export하지 않는다. `getAllPlaces()`와 `getPlacesInBounds()`의 반환 타입은 `Promise<Place[]>`, `revivePlace()`의 반환 타입은 `Place`(둘 다 `@prisma/client`의 `Place`)다.
  - `SerializedPlace`는 `Place` 기준으로 재정의된다.

- [ ] **Step 1: `publicImageUrl` 실패 테스트 작성**

`src/lib/images.test.ts`를 만든다. Vitest는 `.env`를 자동으로 읽지 않으므로 `vi.stubEnv`로 값을 주입한다.

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { publicImageUrl } from "@/lib/images"

const SUPABASE_URL = "https://xhttvfbzqhprmentinxm.supabase.co"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("publicImageUrl", () => {
  it("storage path 를 places 버킷의 공개 URL 로 만든다", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL)
    expect(publicImageUrl("abc.jpg")).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/places/abc.jpg`
    )
  })

  it("uuid 형식의 실제 경로를 그대로 이어 붙인다", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL)
    const path = "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.webp"
    expect(publicImageUrl(path)).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/places/${path}`
    )
  })
})
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
npx vitest run src/lib/images.test.ts
```

기대: FAIL — `Failed to resolve import "@/lib/images"`.

- [ ] **Step 3: `publicImageUrl` 구현**

`src/lib/images.ts`를 만든다. `server-only`를 붙이지 않는다 — `map-view.tsx`는 클라이언트 컴포넌트이고 이 함수를 쓴다.

```ts
/**
 * Supabase Storage public 버킷의 객체 경로를 공개 URL 로 만든다.
 *
 * DB 의 image 컬럼에는 전체 URL 이 아니라 경로(`<uuid>.jpg`)만 저장한다.
 * 프로젝트 ref 가 데이터에 박히지 않으므로 프로젝트를 옮겨도 행을 고치지
 * 않아도 된다.
 *
 * process.env.NEXT_PUBLIC_SUPABASE_URL 은 Next 가 빌드 시점에 문자열로
 * 치환하므로 반드시 이 형태로 직접 참조해야 한다. 변수에 담아 동적으로
 * 조회하면 클라이언트 번들에서 undefined 가 된다.
 */
export function publicImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/places/${path}`
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/images.test.ts
```

기대: PASS, 2 tests.

- [ ] **Step 5: `places.ts`에서 publicId 개념 제거**

`src/lib/places.ts`를 아래로 교체한다.

```ts
import type { Place } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { Bounds } from "@/schemas/place"

const MAX_PLACES = 50

/** 별점을 0~5 범위로 고정한다. 마이그레이션 이전 데이터에는 상한·하한이 없었다. */
export function clampRating(rating: number): number {
  return Math.max(0, Math.min(5, rating))
}

/** JSON 전송 후의 Place — Date 필드가 문자열로 바뀐 형태. */
export type SerializedPlace = Omit<
  Place,
  "imageCreationTime" | "createdAt" | "updatedAt"
> & {
  imageCreationTime: string
  createdAt: string
  updatedAt: string
}

/** SerializedPlace 를 다시 Place 로 되돌린다. */
export function revivePlace(place: SerializedPlace): Place {
  return {
    ...place,
    imageCreationTime: new Date(place.imageCreationTime),
    createdAt: new Date(place.createdAt),
    updatedAt: new Date(place.updatedAt),
  }
}

export async function getAllPlaces(): Promise<Place[]> {
  return prisma.place.findMany({
    take: MAX_PLACES,
    orderBy: { imageCreationTime: "desc" },
  })
}

export async function getPlacesInBounds(bounds: Bounds): Promise<Place[]> {
  return prisma.place.findMany({
    where: {
      latitude: { gte: bounds.sw.latitude, lte: bounds.ne.latitude },
      longitude: { gte: bounds.sw.longitude, lte: bounds.ne.longitude },
    },
    take: MAX_PLACES,
  })
}
```

- [ ] **Step 6: `places.test.ts` 갱신**

1-7행의 import에서 `publicIdFromUrl`을 제거한다.

```diff
 import { describe, expect, it } from "vitest"
 import {
   clampRating,
-  publicIdFromUrl,
   revivePlace,
   type SerializedPlace,
 } from "@/lib/places"
```

9-27행의 `describe("publicIdFromUrl", ...)` 블록 전체를 삭제한다. 이 동작은 더 이상 존재하지 않는다.

`describe("clampRating", ...)` 블록(29-53행)은 그대로 둔다.

`describe("revivePlace", ...)` 블록의 `serialized` 객체(56-69행)에서 `publicId` 필드를 제거하고 `image`를 storage path로 바꾼다.

```diff
   const serialized: SerializedPlace = {
     id: 1,
     userId: "1",
-    image: "https://res.cloudinary.com/demo/image/upload/v1/abc123.jpg",
+    image: "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.jpg",
     imageCreationTime: "2026-01-01T00:00:00.000Z",
     latitude: 37.65874,
     longitude: 126.97759,
     description: "한강 야경",
     rating: 4,
     category: 2,
     createdAt: "2026-01-02T00:00:00.000Z",
     updatedAt: "2026-01-03T00:00:00.000Z",
-    publicId: "abc123.jpg",
   }
```

93행의 `publicId` 단정을 삭제한다.

```diff
     expect(result.category).toBe(serialized.category)
-    expect(result.publicId).toBe(serialized.publicId)
   })
```

- [ ] **Step 7: `place-card.tsx` 갱신**

기존 파일의 import 순서는 외부 패키지 → `@/` 별칭 순이므로 `@prisma/client`를 `next/image` 위에 넣는다.

```diff
+import type { Place } from "@prisma/client"
 import Image from "next/image"
 import { Card, CardContent } from "@/components/ui/card"
 import { categoryLabel } from "@/lib/categories"
-import { clampRating, type PlaceWithPublicId } from "@/lib/places"
+import { publicImageUrl } from "@/lib/images"
+import { clampRating } from "@/lib/places"

-export function PlaceCard({ place }: { place: PlaceWithPublicId }) {
+export function PlaceCard({ place }: { place: Place }) {
```

19행:

```diff
-          src={place.publicId}
+          src={publicImageUrl(place.image)}
```

- [ ] **Step 8: `map-view.tsx` 갱신**

import 블록을 고친다. `@prisma/client`는 외부 패키지이므로 5행 `import Image from "next/image"` 위에 넣는다.

```diff
+import type { Place } from "@prisma/client"
 import Image from "next/image"
```

14-19행:

```diff
 import { useDebounce } from "use-debounce"
 import { useLastData } from "@/hooks/use-last-data"
 import { useLocalState } from "@/hooks/use-local-state"
-import {
-  revivePlace,
-  type PlaceWithPublicId,
-  type SerializedPlace,
-} from "@/lib/places"
+import { publicImageUrl } from "@/lib/images"
+import { revivePlace, type SerializedPlace } from "@/lib/places"
 import type { Bounds } from "@/schemas/place"
```

`PlaceWithPublicId`를 쓰는 세 곳(46, 49, 68행)을 `Place`로 바꾼다.

```diff
-  initialPlaces: PlaceWithPublicId[]
+  initialPlaces: Place[]
```

```diff
-  const [selected, setSelected] = useState<PlaceWithPublicId | null>(null)
+  const [selected, setSelected] = useState<Place | null>(null)
```

```diff
-  const [places, setPlaces] = useState<PlaceWithPublicId[] | null>(
-    initialPlaces
-  )
+  const [places, setPlaces] = useState<Place[] | null>(initialPlaces)
```

151행:

```diff
-                  src={selected.publicId}
+                  src={publicImageUrl(selected.image)}
```

- [ ] **Step 9: `next.config.ts` 교체**

커스텀 로더를 버리고 Next 내장 최적화가 Supabase 공개 URL을 받도록 허용한다.

```ts
import type { NextConfig } from "next"

// Free 플랜에서는 Supabase Storage 이미지 변환(/render/image)을 쓸 수 없으므로
// 최적화를 Next 내장 Image Optimization 이 담당한다. 그래서 커스텀 로더 대신
// remotePatterns 로 공개 객체 경로만 허용한다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL 이 필요합니다")
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(supabaseUrl).hostname,
        pathname: "/storage/v1/object/public/places/**",
      },
    ],
  },
}

export default nextConfig
```

`pathname`을 `places` 버킷까지 좁힌 것이 의도적이다. 다른 버킷이나 `/object/sign/` 경로는 최적화 API가 400으로 거부한다.

- [ ] **Step 10: 커스텀 로더 삭제**

```bash
git rm src/lib/cloudinary-loader.ts
```

- [ ] **Step 11: 기존 4행 삭제**

`execute_sql`로 실행한다. 설계 9절의 결정이다 — Cloudinary 이미지는 마이그레이션하지 않는다.

```sql
delete from public.places;
```

이어서 확인한다.

```sql
select count(*) from public.places;
```

기대: `0`.

- [ ] **Step 12: 테스트와 타입 체크**

```bash
npx vitest run
npx tsc --noEmit
echo "--- publicId 잔여 (0건이어야 함) ---"
grep -rn "publicId" src app next.config.ts
echo "--- Cloudinary 잔여 (쓰기 경로 4개 파일만) ---"
grep -rln "cloudinary\|Cloudinary" src app next.config.ts
```

기대:

- Vitest 전체 통과. `place.test.ts`는 아직 Cloudinary URL을 쓰지만 `placeInputSchema`도 아직 그것을 요구하므로 통과한다.
- `tsc` 오류 없음.
- `publicId` grep은 **0건**.
- Cloudinary grep은 **정확히 아래 네 파일만** 남는다. 모두 Task 4에서 처리한다. 그 외 파일이 나오면 처리한다.
  - `src/actions/place.ts`
  - `src/components/place-form.tsx`
  - `src/schemas/place.ts`
  - `src/schemas/place.test.ts`

- [ ] **Step 13: 실행 검증**

```bash
npm run dev
```

`http://localhost:3000/`에서 "아직 기록된 장소가 없습니다" 안내가 렌더링되고 콘솔 오류가 없음을 확인한다. `http://localhost:3000/map`에서 지도가 뜨고 마커가 없음을 확인한다. 이 시점의 정상 상태는 빈 목록이다.

- [ ] **Step 14: 커밋**

```bash
git add -A src/lib/images.ts src/lib/images.test.ts src/lib/places.ts src/lib/places.test.ts src/components/place-card.tsx src/components/map-view.tsx next.config.ts src/lib/cloudinary-loader.ts
git commit -m "refactor: Change/이미지 읽기 경로를 Supabase Storage path 기준으로 전환"
```

---

## Task 4: 이미지 쓰기 경로 — 서명 업로드 URL

업로드를 Cloudinary에서 Supabase Storage로 옮긴다. 이 태스크가 끝나면 업로드 → 저장 → 렌더링 전체가 동작한다.

**Files:**
- Modify: `src/schemas/place.ts:44-53`, `src/schemas/place.test.ts:1-12`, `src/schemas/place.test.ts:53-80`
- Modify: `src/actions/place.ts:1-35`
- Modify: `src/components/place-form.tsx:18`, `src/components/place-form.tsx:27-48`, `src/components/place-form.tsx:140-155`, `src/components/place-form.tsx:208`

**Interfaces:**
- Consumes: `supabaseAdmin`, `PLACES_BUCKET` (Task 1, `@/lib/supabase`)
- Produces:
  - `createUploadUrlAction(contentType: string): Promise<ActionResult<{ signedUrl: string; path: string }>>` — `src/actions/place.ts`. `createUploadSignature()`를 대체한다.
  - `placeInputSchema`의 `image` 필드가 URL이 아니라 `<uuid>.<jpg|png|webp>` 형식의 path를 받는다.

- [ ] **Step 1: `image` 검증 실패 테스트 작성**

`src/schemas/place.test.ts`의 4-12행 `validInput`을 고친다.

```diff
 const validInput = {
   description: "한강 야경",
-  image: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
+  image: "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.jpg",
   imageCreationTime: new Date("2026-01-01T00:00:00.000Z"),
```

53-80행의 Cloudinary 전제 테스트 4개(`Cloudinary 이미지 URL을 통과시킨다`, `URL이 아닌 문자열을 image로 거부한다`, `Cloudinary가 아닌 호스트의 URL을 image로 거부한다`, `빈 문자열을 image로 거부한다`)를 아래로 교체한다.

```ts
  it("uuid 형식의 storage path 를 통과시킨다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.webp",
    })
    expect(result.success).toBe(true)
  })

  it("png 확장자를 통과시킨다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.png",
    })
    expect(result.success).toBe(true)
  })

  it("전체 URL 을 image 로 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image:
        "https://xhttvfbzqhprmentinxm.supabase.co/storage/v1/object/public/places/a.jpg",
    })
    expect(result.success).toBe(false)
  })

  it("허용하지 않는 확장자를 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.heic",
    })
    expect(result.success).toBe(false)
  })

  it("uuid 형식이 아닌 파일명을 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: "not-a-uuid.jpg",
    })
    expect(result.success).toBe(false)
  })

  it("경로 이탈 시도를 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: "../../etc/passwd.jpg",
    })
    expect(result.success).toBe(false)
  })

  it("하위 폴더를 포함한 경로를 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: "sub/0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.jpg",
    })
    expect(result.success).toBe(false)
  })

  it("빈 문자열을 image 로 거부한다", () => {
    const result = placeInputSchema.safeParse({ ...validInput, image: "" })
    expect(result.success).toBe(false)
  })
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
npx vitest run src/schemas/place.test.ts
```

기대: FAIL. `validInput`이 이제 Cloudinary URL이 아니므로 `올바른 입력을 통과시킨다`를 포함한 다수 케이스가 실패한다.

- [ ] **Step 3: `place.ts` 스키마 수정**

44-53행의 `placeInputSchema`에서 `image` 필드를 교체한다.

```diff
+/**
+ * 저장 경로는 서버 액션이 crypto.randomUUID() 로 정하므로 형식이 고정되어
+ * 있다. 이 정규식은 클라이언트가 보낸 값이 그 형식임을 확인해 경로 이탈이나
+ * 임의 객체 참조를 막는다. 하위 폴더는 쓰지 않는다.
+ */
+const imagePath = z
+  .string()
+  .regex(
+    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/,
+    "이미지 경로가 올바르지 않습니다"
+  )
+
 export const placeInputSchema = z.object({
   description: z.string().min(1, "설명을 입력해 주세요").max(500),
-  image: z
-    .string()
-    .url()
-    .refine((u) => u.startsWith("https://res.cloudinary.com/"), {
-      message: "이미지 URL이 올바르지 않습니다",
-    }),
+  image: imagePath,
   imageCreationTime: z.coerce.date(),
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/schemas/place.test.ts
```

기대: PASS 전체.

- [ ] **Step 5: 서버 액션 교체**

`src/actions/place.ts`의 1-35행을 교체한다. 파일 상단 주석 블록과 `createPlaceAction`은 그대로 둔다.

```diff
 import { revalidatePath } from "next/cache"
-import { v2 as cloudinary } from "cloudinary"
 import { getCurrentUserId } from "@/lib/auth"
 import { prisma } from "@/lib/prisma"
+import { PLACES_BUCKET, supabaseAdmin } from "@/lib/supabase"
 import { placeInputSchema } from "@/schemas/place"

 export type ActionResult<T> =
   | ({ ok: true } & T)
   | { ok: false; error: string }

-export async function createUploadSignature(): Promise<
-  ActionResult<{ signature: string; timestamp: number }>
-> {
-  const secret = process.env.CLOUDINARY_SECRET
-  if (!secret) {
-    return { ok: false, error: "Cloudinary 설정이 없습니다" }
-  }
-
-  const timestamp = Math.round(Date.now() / 1000)
-  const signature = cloudinary.utils.api_sign_request({ timestamp }, secret)
-  return { ok: true, signature, timestamp }
-}
+/** 허용 MIME 타입과 저장 확장자. HEIC 는 Next 내장 최적화가 다루지 못해 제외한다. */
+const EXTENSIONS: Record<string, string> = {
+  "image/jpeg": "jpg",
+  "image/png": "png",
+  "image/webp": "webp",
+}
+
+/**
+ * 브라우저가 Storage 에 직접 올릴 수 있는 서명 URL 을 발급한다.
+ *
+ * 경로를 서버가 정하는 것이 요점이다. 클라이언트가 경로를 지정하면 남의
+ * 객체를 덮어쓸 수 있다. 서명 URL 은 토큰 자체가 인증 수단이라(유효기간
+ * 2시간) 브라우저에 Supabase 키를 내보내지 않아도 된다.
+ */
+export async function createUploadUrlAction(
+  contentType: string
+): Promise<ActionResult<{ signedUrl: string; path: string }>> {
+  const extension = EXTENSIONS[contentType]
+  if (!extension) {
+    return { ok: false, error: "JPEG, PNG, WebP 이미지만 올릴 수 있습니다" }
+  }
+
+  const { data, error } = await supabaseAdmin.storage
+    .from(PLACES_BUCKET)
+    .createSignedUploadUrl(`${crypto.randomUUID()}.${extension}`)
+
+  if (error || !data) {
+    return { ok: false, error: "업로드 URL 발급에 실패했습니다" }
+  }
+
+  return { ok: true, signedUrl: data.signedUrl, path: data.path }
+}
```

- [ ] **Step 6: 폼의 업로드 함수 교체**

`src/components/place-form.tsx` 18행:

```diff
-import { createPlaceAction, createUploadSignature } from "@/actions/place"
+import { createPlaceAction, createUploadUrlAction } from "@/actions/place"
```

27-48행의 `uploadToCloudinary`를 교체한다.

```diff
-async function uploadToCloudinary(
-  file: File,
-  signature: string,
-  timestamp: number
-): Promise<string> {
-  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
-  const formData = new FormData()
-  formData.append("file", file)
-  formData.append("signature", signature)
-  formData.append("timestamp", String(timestamp))
-  formData.append("api_key", process.env.NEXT_PUBLIC_CLOUDINARY_KEY ?? "")
-
-  const res = await fetch(
-    `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
-    { method: "POST", body: formData }
-  )
-  if (!res.ok) throw new Error("이미지 업로드에 실패했습니다")
-
-  const json = (await res.json()) as { secure_url?: string }
-  if (!json.secure_url) throw new Error("이미지 업로드 응답이 올바르지 않습니다")
-  return json.secure_url
-}
+/**
+ * 서버가 발급한 서명 URL 로 파일을 직접 올린다. supabase-js 를 클라이언트
+ * 번들에 넣지 않기 위해 raw fetch 를 쓴다.
+ */
+async function uploadToStorage(file: File, signedUrl: string): Promise<void> {
+  const res = await fetch(signedUrl, {
+    method: "PUT",
+    headers: { "content-type": file.type },
+    body: file,
+  })
+  if (!res.ok) throw new Error("이미지 업로드에 실패했습니다")
+}
```

> Task 1 Step 6에서 raw PUT이 실패해 폴백을 택한 경우에만: 위 함수 대신 `@supabase/supabase-js`의 `uploadToSignedUrl(path, token, file)`을 쓰고, 서버 액션이 `token`도 반환하도록 고치며, `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)`로 클라이언트를 만든다.

- [ ] **Step 7: `onSubmit` 배선 교체**

140-155행을 교체한다.

```diff
-      const signatureResult = await createUploadSignature()
-      if (!signatureResult.ok) {
-        toast.error(signatureResult.error)
-        setSubmitting(false)
-        return
-      }
-
-      const imageUrl = await uploadToCloudinary(
-        file,
-        signatureResult.signature,
-        signatureResult.timestamp
-      )
+      const uploadUrl = await createUploadUrlAction(file.type)
+      if (!uploadUrl.ok) {
+        toast.error(uploadUrl.error)
+        setSubmitting(false)
+        return
+      }
+
+      await uploadToStorage(file, uploadUrl.signedUrl)

       const result = await createPlaceAction({
         description: values.description,
-        image: imageUrl,
+        image: uploadUrl.path,
         imageCreationTime: exif.createDate,
```

- [ ] **Step 8: 파일 선택 범위 좁히기**

208행. Cloudinary의 `f_auto`가 흡수했던 HEIC를 Next 내장 최적화는 처리하지 못하므로 애초에 받지 않는다.

```diff
-          accept="image/*"
+          accept="image/jpeg,image/png,image/webp"
```

- [ ] **Step 9: 전체 테스트와 타입 체크**

```bash
npx vitest run
npx tsc --noEmit
grep -rn "cloudinary\|Cloudinary\|publicId" src app next.config.ts
```

기대: Vitest 전체 통과, `tsc` 오류 없음, `grep` 0건.

- [ ] **Step 10: 업로드 E2E 실행 검증**

```bash
npm run dev
```

`http://localhost:3000/create`에서 확인한다. **GPS 정보가 있는 JPEG 사진이 필요하다.**

1. 사진을 선택하면 미리보기와 촬영 위치 좌표가 표시된다.
2. 확인용 지도가 촬영 위치를 중심으로 렌더링된다.
3. 설명·별점·카테고리를 입력하고 저장하면 `/map`으로 이동한다.
4. `/map`에 마커가 표시되고, 클릭 시 팝업의 사진이 렌더링된다.
5. `/`에 사진 카드가 렌더링된다.
6. 네트워크 탭에서 이미지 요청이 `/_next/image?url=...supabase.co...` 형태다(Next 최적화 경유).
7. 콘솔 오류가 없다.

DB에 저장된 값이 path 형식인지 확인한다.

```sql
select id, image from public.places;
```

기대: `image`가 `<uuid>.jpg` 형식이며 `http`로 시작하지 않는다.

- [ ] **Step 11: 커밋**

```bash
git add src/schemas/place.ts src/schemas/place.test.ts src/actions/place.ts src/components/place-form.tsx
git commit -m "feat: Change/이미지 업로드를 Supabase Storage 서명 URL 방식으로 전환"
```

---

## Task 5: 죽은 코드 · 의존성 · 문서 정리

**Files:**
- Delete: `src/auth/initFirebase.ts`, `src/auth/tokenCookies.ts`, `src/auth/useAuth.tsx`
- Modify: `package.json`, `src/types/env.d.ts`, `README.md`, `.env`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: `src/auth/`가 정말 참조되지 않는지 재확인**

```bash
grep -rn "auth/useAuth\|auth/initFirebase\|auth/tokenCookies\|useAuth\|initFirebase\|firebase" app src --include="*.ts" --include="*.tsx" | grep -v "^src/auth/"
```

기대: 0건. 결과가 나오면 삭제를 멈추고 보고한다.

- [ ] **Step 2: 죽은 코드 삭제**

```bash
git rm src/auth/initFirebase.ts src/auth/tokenCookies.ts src/auth/useAuth.tsx
```

`useAuth.tsx`는 `next/router`(Pages Router)를 import하고 로그인 함수에 이메일·비밀번호가 하드코딩되어 있으며, `tokenCookies.ts`가 호출하는 `/api/login`, `/api/logout`은 존재하지 않는다. 인증 벤더가 Supabase로 확정되었으므로 되살릴 코드가 아니다.

- [ ] **Step 3: 의존성 제거**

```bash
npm uninstall cloudinary firebase
```

- [ ] **Step 4: `env.d.ts` 갱신**

`src/types/env.d.ts`를 교체한다.

```ts
declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string
    NEXT_PUBLIC_SUPABASE_URL: string
    SUPABASE_SECRET_KEY: string
  }
}
```

> Task 1에서 폴백 경로를 택한 경우에만 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string`을 추가한다.

- [ ] **Step 5: `.env`에서 쓰지 않는 변수 제거**

`NEXT_PUBLIC_MAPBOX_API_TOKEN`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_KEY`, `CLOUDINARY_SECRET`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` 줄을 지운다.

`.env`는 gitignore되어 커밋되지 않는다. **`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` 세 줄은 반드시 남긴다.** 편집 후 남은 변수 이름만 확인한다(값은 출력하지 않는다).

- [ ] **Step 6: `README.md` 갱신**

기술 스택 섹션의 네 항목을 아래 내용으로 교체한다.

```markdown
- **DB / ORM**: PostgreSQL (Supabase) + Prisma 6
- **지도**: MapLibre GL (`react-map-gl` 8) + OpenFreeMap 타일
- **이미지**: Supabase Storage (public 버킷) + next/image 내장 최적화
- **인증**: 미구현. 벤더는 Supabase Auth로 확정했습니다. `src/lib/auth.ts`의 `getCurrentUserId()`가 고정값 `"1"`을 반환하는 스텁입니다.
```

주요 기능 표의 `/map` 행에서 "Mapbox 지도"를 "MapLibre 지도"로 고친다.

"이미지 CDN 업로드" 항목을 고친다. 서버 액션이 Cloudinary 서명을 발급한다는 설명을 서명 업로드 URL 방식으로 바꾼다.

```markdown
- **이미지 업로드** — 서버 액션(`createUploadUrlAction`)이 Supabase Storage 서명 업로드 URL을 발급하고, 브라우저가 그 URL로 직접 올립니다. 브라우저에 Supabase 키가 나가지 않습니다.
```

아키텍처 다이어그램의 `└─ createUploadSignature ──► Cloudinary 직접 업로드`와 `└─ 이미지 next/image + Cloudinary 커스텀 로더` 두 줄을 Supabase Storage 기준으로 고친다.

`## 미완성 / 알려진 이슈` 섹션에 항목을 추가한다.

```markdown
- **HEIC 미지원** — 파일 선택이 JPEG·PNG·WebP로 제한됩니다. Next.js 내장 이미지 최적화가 HEIC 출력을 지원하지 않기 때문입니다.
- **OpenFreeMap 타일은 SLA가 없습니다.** 기부로 운영되는 무료 서비스입니다. 안정성이 필요해지면 `mapStyle` URL만 다른 제공자로 바꾸면 됩니다.
```

- [ ] **Step 7: 잔여 참조 전수 확인**

```bash
grep -rn "mapbox\|cloudinary\|Cloudinary\|firebase\|Firebase\|publicId" \
  app src README.md next.config.ts package.json
```

기대: 0건.

- [ ] **Step 8: 커밋**

```bash
git add -A package.json package-lock.json src/types/env.d.ts README.md src/auth
git commit -m "chore: Remove/Cloudinary·Mapbox·Firebase 잔여 코드와 의존성 정리"
```

---

## Task 6: 최종 검증

**Files:** 없음 (검증만)

**Interfaces:**
- Consumes: Task 1-5의 결과 전체
- Produces: 없음

- [ ] **Step 1: 단위 테스트 전체**

```bash
npx vitest run
```

기대: 전체 통과, 실패 0건. 출력의 통과 개수를 기록한다.

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

기대: 출력 없음.

- [ ] **Step 3: 프로덕션 빌드**

```bash
npm run build
```

기대: 성공. `/`와 `/map`이 `force-dynamic`이라 빌드 시점에 DB에 접근하지 않는다.

- [ ] **Step 4: 시크릿 유출 확인**

빌드 산출물에 시크릿 키가 들어가지 않았는지 확인한다. **이 단계를 건너뛰지 않는다.**

```bash
grep -rl "sb_secret" .next/static .next/server 2>/dev/null; echo "---검사 완료---"
```

기대: `---검사 완료---`만 출력된다. 파일 경로가 하나라도 나오면 시크릿이 번들에 들어간 것이므로 즉시 보고하고 원인을 찾는다.

- [ ] **Step 5: RLS 상태 재확인**

Supabase MCP `get_advisors`(type: `security`)를 호출한다.

기대: `rls_enabled_no_policy` (INFO) 1건만. `rls_disabled` (CRITICAL)가 다시 나타나면 안 된다.

- [ ] **Step 6: 완료 기준 확인**

```bash
node -e "const d=require('./package.json').dependencies; for (const k of ['mapbox-gl','cloudinary','firebase']) console.log(k, k in d ? '남아 있음 (실패)' : 'OK 제거됨'); for (const k of ['maplibre-gl','@supabase/supabase-js']) console.log(k, k in d ? 'OK 설치됨' : '없음 (실패)')"
```

기대: 5줄 모두 OK.

- [ ] **Step 7: 전체 흐름 최종 실행 검증**

```bash
npm run dev
```

GPS가 있는 사진으로 `/create` → 저장 → `/map` 마커 팝업 → `/` 카드까지 한 번 더 통과시킨다. 새로고침 후 지도 뷰포트가 복원되는지 확인한다.

- [ ] **Step 8: 최종 커밋 (변경이 남아 있는 경우에만)**

```bash
git status --short
```

깨끗하면 커밋하지 않는다. `AGENTS.md`가 `next dev`에 의해 재생성된 경우 그 변경은 함께 커밋한다.

---

## 검증 요약

| 항목 | 명령 | 태스크 |
| --- | --- | --- |
| 서명 URL 업로드 가능 | `node --env-file=.env _spike.mjs` | 1 |
| 지도 렌더링 · bounds 재조회 | 브라우저 `/map` | 2 |
| 한글 라벨 품질 | 브라우저 `/map` (판단 지점) | 2 |
| 단위 테스트 | `npx vitest run` | 3, 4, 6 |
| 타입 체크 | `npx tsc --noEmit` | 2, 3, 4, 6 |
| 업로드 E2E | 브라우저 `/create` → `/map` → `/` | 4 |
| 잔여 벤더 참조 0건 | `grep -rn "mapbox\|cloudinary\|firebase"` | 5 |
| 프로덕션 빌드 | `npm run build` | 6 |
| 시크릿 미유출 | `grep -rl "sb_secret" .next/...` | 6 |
| RLS 유지 | MCP `get_advisors` | 6 |
