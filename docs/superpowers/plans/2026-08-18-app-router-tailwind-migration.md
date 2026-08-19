# App Router · Tailwind · shadcn/ui 마이그레이션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js 12 Pages Router + GraphQL + styled-components 앱을 Next.js 16 App Router + 서버 액션 + Tailwind 4/shadcn-ui로 이전한다.

**Architecture:** 읽기는 서버 컴포넌트가 Prisma를 직접 호출한다. 지도의 bounds 재조회만 GET Route Handler를 쓰고, 쓰기는 서버 액션을 쓴다. Zod 스키마 하나를 클라이언트 폼과 서버 액션이 공유한다. 첫 태스크에서 골격만 있는 상태(walking skeleton)를 만들어 빌드가 통과하게 하고, 이후 태스크가 라우트를 하나씩 채운다.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Tailwind CSS 4, shadcn/ui, Prisma 6.19 + PostgreSQL, Zod 4, react-hook-form 7, react-map-gl 8 + mapbox-gl 3, Cloudinary, Vitest 4

**설계 문서:** `docs/superpowers/specs/2026-08-18-app-router-tailwind-migration-design.md`

## Global Constraints

- 브랜치: `feat/app-router-tailwind`. 이미 생성되어 있다.
- 패키지 매니저는 npm이다. `yarn`을 쓰지 않는다.
- Node >= 20.9 (Next 16 요구사항). 현재 환경은 Node 24.19.0이다.
- `@/*` 경로 별칭은 `./src/*`를 가리킨다. `app/`에서 `src/`를 참조할 때는 항상 `@/`를 쓴다.
- 인증은 구현하지 않는다. 모든 쓰기 경로는 `getCurrentUserId()`를 통과하며, 이 함수는 고정값 `"1"`을 반환한다.
- 서버 액션은 예외를 던지지 않고 `{ ok: boolean; error?: string }` 형태를 반환한다.
- `nearby`(반경 10km 조회)와 `deletePlace`는 이전 대상이 아니다. 구현하지 않는다.
- 좌표 범위 제약: 위도 -90~90, 경도 -180~180.
- Prisma는 6.19.x까지만 올린다. 7로 올리지 않는다.
- 커밋 메시지는 기존 저장소 관례를 따른다: `<type>: <Verb>/<subject>` (예: `feat: Add/place form`).
- 각 커밋 메시지 마지막에 다음 줄을 넣는다:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## File Structure

| 파일 | 책임 |
| --- | --- |
| `app/layout.tsx` | 루트 레이아웃. `<html>`/`<body>`, globals.css, Header, View Transitions |
| `app/globals.css` | Tailwind 4 진입점 + shadcn 테마 변수 (shadcn CLI 생성) |
| `app/page.tsx` | 홈. 서버 컴포넌트. 전체 장소 목록 |
| `app/map/page.tsx` | 지도. 서버에서 초기 데이터를 읽어 MapView에 전달 |
| `app/create/page.tsx` | 등록. PlaceForm을 감싸는 얇은 셸 |
| `app/api/places/route.ts` | GET. bounds 기반 장소 조회 |
| `app/error.tsx` `app/loading.tsx` `app/not-found.tsx` | 오류/로딩/404 |
| `src/lib/prisma.ts` | PrismaClient 싱글턴 |
| `src/lib/places.ts` | 장소 조회 함수와 `publicIdFromUrl` 순수 함수 |
| `src/lib/auth.ts` | `getCurrentUserId()` — 인증 스텁의 유일한 지점 |
| `src/lib/cloudinary-loader.ts` | next/image 커스텀 로더 |
| `src/lib/utils.ts` | `cn()` (shadcn CLI 생성) |
| `src/lib/categories.ts` | 카테고리 번호↔라벨 매핑. PlaceCard와 CategoryPicker가 공유 |
| `src/schemas/place.ts` | Zod 스키마. 클라이언트 폼과 서버 액션이 공유 |
| `src/actions/place.ts` | `createPlaceAction`, `createUploadSignature` |
| `src/components/header.tsx` | 내비게이션 |
| `src/components/place-card.tsx` | 홈의 장소 카드 |
| `src/components/map-view.tsx` | 클라이언트 지도 |
| `src/components/place-form.tsx` | 등록 폼 |
| `src/components/star-rating.tsx` | 별점 입력 (커스텀) |
| `src/components/category-picker.tsx` | 카테고리 입력 (ToggleGroup) |
| `src/hooks/use-local-state.ts` | localStorage 동기화 (기존 `src/utils/useLocalState.ts` 이전) |
| `src/hooks/use-last-data.ts` | 직전 데이터 유지 (기존 `src/utils/useLastData.ts` 이전) |
| `src/components/ui/*` | shadcn 생성물. 직접 작성하지 않는다 |

---

### Task 1: 의존성 교체와 App Router 골격

옛 `pages/` 코드는 styled-components와 Apollo에 의존하므로 의존성을 바꾸는 순간 컴파일되지 않는다. 따라서 이 태스크에서 의존성 교체와 옛 코드 삭제, 그리고 빌드가 통과하는 최소 골격 생성을 한 번에 처리한다. 홈은 이 태스크에서 자리표시자이며 Task 3에서 채운다.

**Files:**
- Modify: `package.json`
- Create: `postcss.config.mjs`
- Create: `next.config.ts`
- Delete: `next.config.js`
- Modify: `tsconfig.json`
- Delete: `pages/` (전체), `src/schema/` (전체), `src/apollo.ts`, `src/styles/` (전체), `src/components/pageTransitions.tsx`, `src/components/spiner.tsx`, `schema.gql`, `styled.d.ts`, `env.d.ts`
- Create: `app/layout.tsx`, `app/page.tsx`
- Create: `src/types/env.d.ts`
- Modify: `prisma/schema.prisma` (변경 없음 확인용)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `@/*` → `./src/*` 별칭, `app/globals.css` (shadcn CLI 생성), `src/lib/utils.ts`의 `cn(...inputs: ClassValue[]): string`

- [ ] **Step 1: package.json 의존성 교체**

`package.json` 전체를 다음으로 바꾼다.

```json
{
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.9.1",
    "@prisma/client": "^6.19.3",
    "cloudinary": "^1.32.0",
    "exifr": "^7.1.3",
    "firebase": "^12.17.1",
    "js-cookie": "^3.0.1",
    "lottie-web": "^5.9.6",
    "mapbox-gl": "^3.28.1",
    "next": "^16.3.1",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-hook-form": "^7.85.0",
    "react-map-gl": "^8.1.2",
    "server-only": "^0.0.1",
    "use-debounce": "^10.0.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.3",
    "@types/js-cookie": "^3.0.2",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "postcss": "^8.4.0",
    "prisma": "^6.19.3",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.6.0",
    "vitest": "^4.1.10"
  }
}
```

제거된 것: `@apollo/client`, `apollo-server-micro`, `type-graphql`, `graphql`, `micro`, `micro-cors`, `class-validator`, `reflect-metadata`, `styled-components`, `react-transition-group`, `@reach/combobox`, `use-places-autocomplete`, `react-google-autocomplete`, `next-cloudinary`, `geolib`, `cookie`, `@types/cookie`, `@types/micro-cors`, `@types/react-lottie`, `@types/react-transition-group`, `@types/styled-components`, `codegen` 스크립트.

`geolib`과 `cookie`는 이 태스크에서 삭제되는 코드에서만 쓰였다. `geolib`은 `nearby` 리졸버(`src/schema/place.ts`)에서만, `cookie`는 `pages/api/login.ts`·`logout.ts`에서만 사용됐다. `nearby`는 이전 대상이 아니고, App Router에서 쿠키는 `next/headers`의 `cookies()`로 다루므로 `cookie` 패키지는 다시 쓸 일이 없다. `js-cookie`는 유지되는 `src/auth/tokenCookies.ts`가 쓰므로 남긴다.

`cloudinary`는 1.x를 유지한다(서버 서명 발급에만 쓰이고 API가 그대로다). `use-debounce`는 React 19 지원을 위해 10.x로 올린다.

- [ ] **Step 2: 옛 코드 삭제와 재설치**

```bash
git rm -r --quiet pages src/schema src/styles src/apollo.ts \
  src/components/pageTransitions.tsx src/components/spiner.tsx \
  src/components/header.tsx src/components/starRating.tsx \
  src/components/category.tsx \
  schema.gql styled.d.ts env.d.ts next.config.js
rm -f .npmrc
rm -rf node_modules package-lock.json
npm install
```

`.npmrc`를 먼저 지우고 설치하는 이유: `@reach/combobox`가 제거되었으므로 `legacy-peer-deps` 없이 해소되어야 한다.

`header.tsx`, `starRating.tsx`, `category.tsx`도 이 태스크에서 삭제한다. 세 파일 모두 `styled-components`를 import하므로 남겨두면 `next build`의 전체 타입 체크가 실패한다. 대체물은 뒤 태스크가 새 파일명으로 만든다: `star-rating.tsx`·`category-picker.tsx`(Task 5), `header.tsx`(Task 6). **타입 오류를 `@ts-nocheck`로 억제하지 않는다** — 삭제가 올바른 처리다.

- [ ] **Step 3: 설치가 플래그 없이 성공했는지 확인**

Run: `npm install`
Expected: `ERESOLVE` 없이 성공. 실패하면 어떤 패키지가 충돌하는지 기록하고, `.npmrc`를 되살리는 대신 해당 패키지의 버전을 조정한다.

- [ ] **Step 4: Prisma 6 클라이언트 재생성**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client (6.x.x | library) to ./node_modules/@prisma/client`

`prisma/schema.prisma`는 수정하지 않는다. Prisma 6에서 `prisma-client-js` 제너레이터와 `Place` 모델 정의가 그대로 유효하다.

- [ ] **Step 5: PostCSS 설정 생성**

`postcss.config.mjs`:

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
```

- [ ] **Step 6: next.config.ts 생성**

`next.config.ts` (기존 `next.config.js`는 Step 2에서 삭제됨):

```ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./src/lib/cloudinary-loader.ts",
  },
}

export default nextConfig
```

`reactStrictMode: false`와 `compiler.styledComponents`는 제거한다. 전자는 기본값(true)이 바람직하고, 후자는 styled-components가 사라졌다.

`images.loader: "cloudinary"`는 Next 13에서 제거된 설정이므로 커스텀 로더로 대체한다. 로더 파일은 Step 8에서 만든다.

- [ ] **Step 7: tsconfig.json 갱신**

`tsconfig.json` 전체를 다음으로 바꾼다.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "forceConsistentCasingInFileNames": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`emitDecoratorMetadata`와 `experimentalDecorators`는 type-graphql 전용이었으므로 제거한다. `moduleResolution`을 `bundler`로 올리고 `target`을 ES2022로 올린다.

- [ ] **Step 8: Cloudinary 이미지 로더 작성**

`src/lib/cloudinary-loader.ts`:

```ts
"use client"

/**
 * next/image 커스텀 로더.
 * DB에 저장된 값은 Cloudinary secure_url 전체이지만, 화면에서는
 * publicIdFromUrl()로 잘라낸 publicId를 src로 넘긴다.
 */
export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const params = ["f_auto", "c_limit", `w_${width}`, `q_${quality ?? "auto"}`]
  return `https://res.cloudinary.com/${cloudName}/image/upload/${params.join(",")}/${src}`
}
```

- [ ] **Step 9: 환경 변수 타입 선언**

`src/types/env.d.ts`:

```ts
declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string
    NEXT_PUBLIC_MAPBOX_API_TOKEN: string
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: string
    NEXT_PUBLIC_CLOUDINARY_KEY: string
    CLOUDINARY_SECRET: string
    NEXT_PUBLIC_FIREBASE_API_KEY: string
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: string
  }
}
```

옛 `env.d.ts`는 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 하나만 선언했고 그 변수를 읽는 코드가 없었다.

- [ ] **Step 10: shadcn 초기화**

```bash
npx shadcn@latest init --base radix --template next --css-variables --yes
```

이 명령이 생성/수정하는 것: `components.json`, `app/globals.css`, `src/lib/utils.ts`(`cn`), 그리고 `clsx`·`tailwind-merge`·`lucide-react`·`radix-ui` 의존성 추가.

`components.json`의 `aliases`가 `@/components`, `@/lib/utils`를 가리키고 `rsc: true`인지 확인한다. 아니면 다음으로 고친다.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 11: shadcn 컴포넌트 일괄 추가**

```bash
npx shadcn@latest add button input textarea field card sonner skeleton toggle-group --yes
```

**`form`이 아니라 `field`다.** shadcn은 최신 스타일(`base-nova`)에서 react-hook-form 전용 `Form` 컴포넌트를 폐기하고 `Field`로 대체했다. `form`을 요청하면 파일 0개인 빈 스텁이 설치되어 `src/components/ui/form.tsx`가 만들어지지 않는다. `field`는 `label`과 `separator`를 registryDependency로 함께 끌어온다.

생성물은 `src/components/ui/`에 놓인다. 설치 후 다음 파일이 존재하는지 확인한다: `button.tsx`, `input.tsx`, `textarea.tsx`, `field.tsx`, `label.tsx`, `card.tsx`, `sonner.tsx`, `skeleton.tsx`, `toggle-group.tsx`.

`shadcn`은 **`dependencies`가 아니라 `devDependencies`에 둔다.** CLI가 자기 자신을 runtime dependency로 추가했다면 devDependencies로 옮긴다.

런타임 의존성이 아닌 이유는 명령을 `npx`로 실행하기 때문이고, 그럼에도 완전히 제거할 수는 없는 이유는 이 패키지가 `./tailwind.css`(→ `dist/tailwind.css`)를 export하고 CLI가 생성한 `app/globals.css`가 그것을 `@import`하기 때문이다. 생성된 컴포넌트들이 쓰는 `data-horizontal:`·`data-vertical:`·`has-data-checked:` 커스텀 variant가 거기 정의되어 있다. **이 CSS를 `globals.css`에 인라인해 의존성을 없애려 하지 말 것** — 762줄의 서드파티 CSS가 앱 테마와 뒤섞이고, 업스트림 수정이 반영되지 않으며, 이후 `shadcn add`를 실행할 때마다 재추가되는 import를 수동 병합해야 한다.

`style`은 `base-nova`이며, 이 스타일의 프리미티브는 Radix가 아니라 `@base-ui/react`다. CLI가 `@base-ui/react`를 설치하지 않은 채 그것을 import하는 파일을 생성하는 경우가 있으므로, 생성 후 `npm ls @base-ui/react`로 확인하고 없으면 설치한다.

- [ ] **Step 12: 루트 레이아웃 작성**

`app/layout.tsx`:

```tsx
import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "my-place",
  description: "사진으로 다녀온 장소를 기록하고 지도에 모아 봅니다",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-background text-foreground min-h-dvh antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

Header와 View Transitions는 Task 6에서 이 파일에 추가한다.

- [ ] **Step 13: 홈 자리표시자 작성**

`app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold">my-place</h1>
    </main>
  )
}
```

Task 3에서 실제 목록으로 교체한다.

- [ ] **Step 14: 빌드 확인**

Run: `npm run build`
Expected: 성공. `/` 라우트가 목록에 나타난다. 옛 `/create`의 lottie 오류("Failed to collect page data for /create")가 더 이상 발생하지 않는다.

- [ ] **Step 15: 타입 체크 확인**

Run: `npx tsc --noEmit`
Expected: 오류 없음.

- [ ] **Step 16: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: Change/의존성을 App Router · Tailwind 4 · shadcn 기반으로 교체

- Next 12→16, React 18→19, Prisma 4→6, react-map-gl 7→8, mapbox-gl 2→3
- GraphQL 스택(@apollo/client, apollo-server-micro, type-graphql, graphql,
  micro, micro-cors)과 class-validator/reflect-metadata 제거
- styled-components, react-transition-group 제거
- 미사용 의존성 제거(@reach/combobox, use-places-autocomplete,
  react-google-autocomplete, next-cloudinary)로 .npmrc legacy-peer-deps 해소
- pages/, src/schema/, src/styles/, schema.gql 삭제
- Tailwind 4 + shadcn 초기화, app/ 골격 생성
- images.loader를 custom + cloudinary-loader로 교체

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 데이터 계층과 단위 테스트

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/prisma.ts`
- Create: `src/lib/places.ts`
- Create: `src/lib/auth.ts`
- Create: `src/schemas/place.ts`
- Test: `src/lib/places.test.ts`
- Test: `src/schemas/place.test.ts`

**Interfaces:**
- Consumes: Task 1의 `@/*` 별칭, Prisma 6 생성 클라이언트
- Produces:
  - `publicIdFromUrl(url: string): string`
  - `getAllPlaces(): Promise<PlaceWithPublicId[]>`
  - `getPlacesInBounds(bounds: Bounds): Promise<PlaceWithPublicId[]>`
  - `type PlaceWithPublicId = Place & { publicId: string }`
  - `getCurrentUserId(): Promise<string>`
  - `placeInputSchema`, `type PlaceInput`
  - `boundsSchema`, `type Bounds`
  - `boundsQuerySchema`

- [ ] **Step 1: Vitest 설정**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
```

- [ ] **Step 2: 실패하는 테스트 작성 — publicIdFromUrl**

`src/lib/places.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { publicIdFromUrl } from "@/lib/places"

describe("publicIdFromUrl", () => {
  it("Cloudinary secure_url의 마지막 세그먼트를 반환한다", () => {
    const url =
      "https://res.cloudinary.com/demo/image/upload/v1667000000/abc123.jpg"
    expect(publicIdFromUrl(url)).toBe("abc123.jpg")
  })

  it("세그먼트가 하나뿐이면 그 값을 그대로 반환한다", () => {
    expect(publicIdFromUrl("abc123.jpg")).toBe("abc123.jpg")
  })

  it("빈 문자열이면 빈 문자열을 반환한다", () => {
    expect(publicIdFromUrl("")).toBe("")
  })

  it("끝에 슬래시가 있으면 빈 문자열을 반환한다", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/demo/")).toBe("")
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/places.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/places"` 또는 `publicIdFromUrl is not a function`

- [ ] **Step 4: Prisma 싱글턴 작성**

`src/lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
```

옛 `src/prisma.ts`는 매 요청마다 새 인스턴스를 만들 수 있고 `log: ["query", "info", "warn"]`으로 쿼리를 전부 출력했다. dev 환경에서 전역에 캐시해 핫 리로드 시 연결이 누적되지 않게 하고, 로그는 경고 이상으로 낮춘다.

- [ ] **Step 5: places 모듈 작성**

`src/lib/places.ts`:

```ts
import type { Place } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { Bounds } from "@/schemas/place"

export type PlaceWithPublicId = Place & { publicId: string }

const MAX_PLACES = 50

/**
 * Cloudinary secure_url에서 publicId(마지막 세그먼트)를 추출한다.
 * next/image의 커스텀 로더가 이 값을 src로 받는다.
 */
export function publicIdFromUrl(url: string): string {
  const parts = url.split("/")
  return parts[parts.length - 1]
}

function withPublicId(place: Place): PlaceWithPublicId {
  return { ...place, publicId: publicIdFromUrl(place.image) }
}

export async function getAllPlaces(): Promise<PlaceWithPublicId[]> {
  const places = await prisma.place.findMany({
    take: MAX_PLACES,
    orderBy: { imageCreationTime: "desc" },
  })
  return places.map(withPublicId)
}

export async function getPlacesInBounds(
  bounds: Bounds
): Promise<PlaceWithPublicId[]> {
  const places = await prisma.place.findMany({
    where: {
      latitude: { gte: bounds.sw.latitude, lte: bounds.ne.latitude },
      longitude: { gte: bounds.sw.longitude, lte: bounds.ne.longitude },
    },
    take: MAX_PLACES,
  })
  return places.map(withPublicId)
}
```

옛 `allPlaces` 리졸버에는 정렬이 없어 순서가 비결정적이었다. 홈이 사진 촬영 시각 카드를 보여주므로 `imageCreationTime` 내림차순으로 고정한다.

- [ ] **Step 6: 테스트가 통과하는지 확인**

Run: `npx vitest run src/lib/places.test.ts`
Expected: PASS (4개)

- [ ] **Step 7: 실패하는 테스트 작성 — Zod 스키마**

`src/schemas/place.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { boundsQuerySchema, placeInputSchema } from "@/schemas/place"

const validInput = {
  description: "한강 야경",
  image: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
  imageCreationTime: new Date("2026-01-01T00:00:00.000Z"),
  latitude: 37.65874,
  longitude: 126.97759,
  rating: 4,
  category: 2,
}

describe("placeInputSchema", () => {
  it("올바른 입력을 통과시킨다", () => {
    const result = placeInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("위도가 90을 넘으면 거부한다", () => {
    const result = placeInputSchema.safeParse({ ...validInput, latitude: 90.1 })
    expect(result.success).toBe(false)
  })

  it("경도가 -180 미만이면 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      longitude: -180.1,
    })
    expect(result.success).toBe(false)
  })

  it("설명이 비어 있으면 거부한다", () => {
    const result = placeInputSchema.safeParse({ ...validInput, description: "" })
    expect(result.success).toBe(false)
  })

  it("별점이 범위를 벗어나면 거부한다", () => {
    expect(placeInputSchema.safeParse({ ...validInput, rating: 0 }).success).toBe(
      false
    )
    expect(placeInputSchema.safeParse({ ...validInput, rating: 6 }).success).toBe(
      false
    )
  })

  it("카테고리가 범위를 벗어나면 거부한다", () => {
    expect(
      placeInputSchema.safeParse({ ...validInput, category: 5 }).success
    ).toBe(false)
  })

  it("ISO 문자열 날짜를 Date로 강제한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      imageCreationTime: "2026-01-01T00:00:00.000Z",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.imageCreationTime).toBeInstanceOf(Date)
    }
  })
})

describe("boundsQuerySchema", () => {
  it("쿼리 문자열을 숫자 bounds로 강제한다", () => {
    const result = boundsQuerySchema.safeParse({
      swLat: "37.0",
      swLng: "126.0",
      neLat: "38.0",
      neLng: "128.0",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sw.latitude).toBe(37)
      expect(result.data.ne.longitude).toBe(128)
    }
  })

  it("숫자가 아닌 값을 거부한다", () => {
    const result = boundsQuerySchema.safeParse({
      swLat: "abc",
      swLng: "126.0",
      neLat: "38.0",
      neLng: "128.0",
    })
    expect(result.success).toBe(false)
  })

  it("값이 누락되면 거부한다", () => {
    const result = boundsQuerySchema.safeParse({ swLat: "37.0" })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 8: 테스트가 실패하는지 확인**

Run: `npx vitest run src/schemas/place.test.ts`
Expected: FAIL — `Failed to resolve import "@/schemas/place"`

- [ ] **Step 9: Zod 스키마 작성**

`src/schemas/place.ts`:

```ts
import { z } from "zod"

const latitude = z.number().min(-90).max(90)
const longitude = z.number().min(-180).max(180)

export const coordinatesSchema = z.object({
  latitude,
  longitude,
})

export const boundsSchema = z.object({
  sw: coordinatesSchema,
  ne: coordinatesSchema,
})

export type Bounds = z.infer<typeof boundsSchema>

/** Route Handler의 쿼리 문자열을 Bounds로 강제한다. */
export const boundsQuerySchema = z
  .object({
    swLat: z.coerce.number().min(-90).max(90),
    swLng: z.coerce.number().min(-180).max(180),
    neLat: z.coerce.number().min(-90).max(90),
    neLng: z.coerce.number().min(-180).max(180),
  })
  .transform((q) => ({
    sw: { latitude: q.swLat, longitude: q.swLng },
    ne: { latitude: q.neLat, longitude: q.neLng },
  }))

export const placeInputSchema = z.object({
  description: z.string().min(1, "설명을 입력해 주세요").max(500),
  image: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://res.cloudinary.com/"), {
      message: "이미지 URL이 올바르지 않습니다",
    }),
  imageCreationTime: z.coerce.date(),
  latitude,
  longitude,
  rating: z.number().int().min(1).max(5),
  category: z.number().int().min(1).max(4),
})

export type PlaceInput = z.infer<typeof placeInputSchema>

/** 폼이 다루는 값. 이미지는 업로드 전이므로 File이고 좌표는 EXIF에서 온다. */
export const placeFormSchema = z.object({
  description: z.string().min(1, "설명을 입력해 주세요").max(500),
  rating: z.number().int().min(1).max(5),
  category: z.number().int().min(1).max(4),
})

export type PlaceFormValues = z.infer<typeof placeFormSchema>
```

별점 1~5와 카테고리 1~4는 각각 `starRating.tsx`가 5단계, `category.tsx`가 4종을 렌더하던 것과 일치한다. 옛 `class-validator`에는 이 상한 제약이 없었다.

- [ ] **Step 10: 테스트가 통과하는지 확인**

Run: `npx vitest run`
Expected: PASS (`places.test.ts` 4개 + `place.test.ts` 10개)

- [ ] **Step 11: 인증 스텁 작성**

`src/lib/auth.ts`:

```ts
import "server-only"

/**
 * 현재 사용자 id를 반환한다.
 *
 * 인증은 아직 구현되지 않았다. 원래 pages/api/graphql.ts가 Firebase Admin으로
 * ID 토큰을 검증해야 했으나 그 코드는 주석 처리되어 있었고 uid가 "1"로
 * 하드코딩되어 있었다. firebase-admin 패키지도 설치되지 않은 상태다.
 *
 * 이 함수가 인증을 붙일 유일한 지점이다. 실제 구현 시 여기서 세션 쿠키를
 * 검증하고 uid를 반환하도록 바꾸면 모든 쓰기 경로에 한 번에 적용된다.
 */
export async function getCurrentUserId(): Promise<string> {
  return "1"
}
```

- [ ] **Step 12: 타입 체크와 커밋**

```bash
npx tsc --noEmit
git add -A
git commit -m "$(cat <<'EOF'
feat: Add/데이터 계층 — Prisma 싱글턴, 장소 조회, Zod 스키마

- src/lib/prisma.ts: dev 환경 전역 캐시로 핫 리로드 시 연결 누적 방지
- src/lib/places.ts: getAllPlaces, getPlacesInBounds, publicIdFromUrl
  (allPlaces 는 정렬이 없어 비결정적이었으므로 촬영시각 내림차순 고정)
- src/schemas/place.ts: 클라이언트 폼과 서버 액션이 공유하는 Zod 스키마
- src/lib/auth.ts: getCurrentUserId — 인증 미구현 지점을 한 곳으로 격리
- Vitest 도입, 순수 함수와 스키마에 단위 테스트 14개

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 홈 — 서버 컴포넌트 목록

**Files:**
- Modify: `app/page.tsx`
- Create: `src/lib/categories.ts`
- Create: `src/components/place-card.tsx`
- Create: `app/loading.tsx`
- Create: `app/error.tsx`
- Create: `app/not-found.tsx`

**Interfaces:**
- Consumes: `getAllPlaces()`, `PlaceWithPublicId` (Task 2)
- Produces:
  - `CATEGORIES: readonly { value: number; label: string }[]`
  - `categoryLabel(value: number): string`
  - `<PlaceCard place={place} />`

- [ ] **Step 1: 카테고리 매핑 작성**

`src/lib/categories.ts`:

```ts
export const CATEGORIES = [
  { value: 1, label: "카페" },
  { value: 2, label: "식당" },
  { value: 3, label: "숙소" },
  { value: 4, label: "명소" },
] as const

export function categoryLabel(value: number): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? "기타"
}
```

값 1~4는 `placeInputSchema`의 `category` 제약(`min(1).max(4)`)과 일치해야 한다. `PlaceCard`(이 태스크)와 `CategoryPicker`(Task 5)가 모두 이 모듈을 쓴다. 옛 `category.tsx`는 SVG 아이콘 4종만 있고 라벨이 없어 각 아이콘의 의미가 코드에 드러나지 않았다.

- [ ] **Step 2: PlaceCard 작성**

`src/components/place-card.tsx`:

```tsx
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { categoryLabel } from "@/lib/categories"
import type { PlaceWithPublicId } from "@/lib/places"

export function PlaceCard({ place }: { place: PlaceWithPublicId }) {
  const takenAt = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(place.imageCreationTime)

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative aspect-[16/9] w-full">
        <Image
          src={place.publicId}
          alt={place.description}
          fill
          sizes="(max-width: 640px) 100vw, 640px"
          className="object-cover"
        />
      </div>
      <CardContent className="space-y-2 p-4">
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>{takenAt}</span>
          <span>{categoryLabel(place.category)}</span>
        </div>
        <p className="font-medium">{place.description}</p>
        <p className="text-sm" aria-label={`별점 ${place.rating}점`}>
          {"★".repeat(place.rating)}
          <span className="text-muted-foreground">
            {"★".repeat(Math.max(0, 5 - place.rating))}
          </span>
        </p>
      </CardContent>
    </Card>
  )
}
```

옛 홈 카드에는 `<li>` 23개로 만든 티켓 절취선과 `:before` 노치가 있었으나 shadcn Card 기반으로 재구성한다. 카테고리 숫자를 라벨로 보여주는 것은 새 동작이다 — 옛 홈은 카테고리를 표시하지 않았고 별점을 `<button>{item.rating}</button>`로 숫자만 찍었다.

- [ ] **Step 3: 홈 페이지 작성**

`app/page.tsx`:

```tsx
import { PlaceCard } from "@/components/place-card"
import { getAllPlaces } from "@/lib/places"

// 장소 목록은 매 요청마다 최신 DB 상태를 반영해야 하므로 정적 프리렌더를 끈다.
// Next는 Prisma 호출을 동적 신호로 인식하지 못하므로, 이 설정이 없으면 빌드
// 시점에 이 페이지를 정적 생성하며 그 결과가 영구히 굳는다.
export const dynamic = "force-dynamic"

export default async function HomePage() {
  const places = await getAllPlaces()

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">다녀온 장소</h1>

      {places.length === 0 ? (
        <p className="text-muted-foreground">
          아직 기록된 장소가 없습니다. 사진을 올려 첫 장소를 남겨 보세요.
        </p>
      ) : (
        <ul className="space-y-4">
          {places.map((place) => (
            <li key={place.id}>
              <PlaceCard place={place} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

빈 상태 처리는 새 동작이다. 옛 홈은 `data?.allPlaces?.map`으로 아무것도 렌더하지 않았다.

- [ ] **Step 4: 로딩·오류·404 경계 작성**

`app/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    </main>
  )
}
```

`app/error.tsx`:

```tsx
"use client"

import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-xl font-bold">문제가 발생했습니다</h1>
      <p className="text-muted-foreground text-sm">{error.message}</p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  )
}
```

`app/not-found.tsx` — 이 저장소의 shadcn Button은 Radix가 아니라 `@base-ui/react`를 감싸므로 `asChild`가 없다. 합성은 `render` prop으로 한다:

```tsx
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-xl font-bold">페이지를 찾을 수 없습니다</h1>
      <Button render={<Link href="/">홈으로</Link>} />
    </main>
  )
}
```

- [ ] **Step 3: 빌드와 타입 체크**

Run: `npm run build && npx tsc --noEmit`
Expected: 성공. `/`가 동적 렌더링(`ƒ`)으로 표시된다 — DB를 읽으므로 정적화되지 않는다.

- [ ] **Step 6: 홈이 서버에서 렌더되는지 확인**

```bash
npm run dev &
sleep 15
curl -s http://localhost:3000/ | grep -c "다녀온 장소"
```

Expected: `1` 이상. JS 실행 없이 받은 HTML에 제목이 들어 있어야 한다. DB에 데이터가 있으면 장소 설명 문자열도 HTML에 포함되는지 함께 확인한다. 확인 후 dev 서버를 종료한다.

이것이 이 마이그레이션의 핵심 검증 항목이다. 옛 홈은 HTML이 비어 있고 JS가 `/api/graphql`을 호출한 뒤에야 카드가 나타났다.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Add/홈을 서버 컴포넌트로 재작성

- app/page.tsx 가 Prisma 를 직접 읽어 첫 HTML 에 목록을 담아 응답
  (기존에는 빈 화면 → JS 로드 → /api/graphql 왕복 후 렌더)
- PlaceCard 를 shadcn Card 기반으로 재구성, 카테고리 라벨과 별점 표시 추가
- 빈 상태 안내 추가
- loading / error / not-found 경계 추가

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 지도 — Route Handler와 클라이언트 지도

**Files:**
- Create: `app/api/places/route.ts`
- Create: `app/map/page.tsx`
- Create: `src/components/map-view.tsx`
- Create: `src/hooks/use-local-state.ts`
- Create: `src/hooks/use-last-data.ts`
- Delete: `src/utils/useLocalState.ts`, `src/utils/useLastData.ts`

**Interfaces:**
- Consumes: `getPlacesInBounds()`, `boundsQuerySchema`, `PlaceWithPublicId` (Task 2)
- Produces:
  - `GET /api/places?swLat&swLng&neLat&neLng` → `{ places: PlaceWithPublicId[] }` (200) 또는 `{ error: string }` (400)
  - `<MapView initialPlaces={...} initialBounds={...} />`
  - `useLocalState<S>(key: string, initial: S): [S, Dispatch<SetStateAction<S>>]`
  - `useLastData<S>(data: S): S`

- [ ] **Step 1: Route Handler 작성**

`app/api/places/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server"
import { getPlacesInBounds } from "@/lib/places"
import { boundsQuerySchema } from "@/schemas/place"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const parsed = boundsQuerySchema.safeParse({
    swLat: sp.get("swLat"),
    swLng: sp.get("swLng"),
    neLat: sp.get("neLat"),
    neLng: sp.get("neLng"),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "bounds 파라미터가 올바르지 않습니다" },
      { status: 400 }
    )
  }

  const places = await getPlacesInBounds(parsed.data)
  return NextResponse.json({ places })
}
```

- [ ] **Step 2: 훅 이전**

`src/hooks/use-local-state.ts`:

```ts
"use client"

import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

export function useLocalState<S>(
  key: string,
  initial: S
): [S, Dispatch<SetStateAction<S>>] {
  const [value, setValue] = useState<S>(initial)

  // 서버 렌더 결과와 어긋나지 않도록 마운트 이후에 읽는다.
  useEffect(() => {
    const saved = window.localStorage.getItem(key)
    if (saved !== null) {
      try {
        setValue(JSON.parse(saved) as S)
      } catch {
        window.localStorage.removeItem(key)
      }
    }
  }, [key])

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}
```

옛 `useLocalState`는 `useState` 초기화 함수에서 localStorage를 읽어 서버와 클라이언트의 첫 렌더 결과가 달라질 수 있었고(하이드레이션 불일치), `JSON.parse` 실패를 처리하지 않았다.

`src/hooks/use-last-data.ts`:

```ts
"use client"

import { useRef } from "react"

/** 재조회 중 이전 데이터를 유지해 지도가 비지 않게 한다. */
export function useLastData<S>(data: S): S {
  const ref = useRef(data)
  if (data !== null && data !== undefined) {
    ref.current = data
  }
  return ref.current
}
```

```bash
git rm --quiet src/utils/useLocalState.ts src/utils/useLastData.ts
```

- [ ] **Step 3: MapView 작성**

`src/components/map-view.tsx`:

```tsx
"use client"

import "mapbox-gl/dist/mapbox-gl.css"

import Image from "next/image"
import { useEffect, useState } from "react"
import Map, {
  Marker,
  Popup,
  type ViewStateChangeEvent,
} from "react-map-gl/mapbox"
import { useDebounce } from "use-debounce"
import { useLastData } from "@/hooks/use-last-data"
import { useLocalState } from "@/hooks/use-local-state"
import type { PlaceWithPublicId } from "@/lib/places"
import type { Bounds } from "@/schemas/place"

type Viewport = { latitude: number; longitude: number; zoom: number }

const DEFAULT_VIEWPORT: Viewport = {
  latitude: 37.65874,
  longitude: 126.97759,
  zoom: 10,
}

function toQuery(bounds: Bounds): string {
  return new URLSearchParams({
    swLat: String(bounds.sw.latitude),
    swLng: String(bounds.sw.longitude),
    neLat: String(bounds.ne.latitude),
    neLng: String(bounds.ne.longitude),
  }).toString()
}

export function MapView({
  initialPlaces,
  initialBounds,
}: {
  initialPlaces: PlaceWithPublicId[]
  initialBounds: Bounds
}) {
  const [selected, setSelected] = useState<PlaceWithPublicId | null>(null)
  const [viewport, setViewport] = useLocalState<Viewport>(
    "viewport",
    DEFAULT_VIEWPORT
  )
  const [bounds, setBounds] = useLocalState<Bounds>("bounds", initialBounds)
  const [debouncedBounds] = useDebounce(bounds, 1000)
  const [places, setPlaces] = useState<PlaceWithPublicId[] | null>(
    initialPlaces
  )
  const shownPlaces = useLastData(places) ?? []

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const res = await fetch(`/api/places?${toQuery(debouncedBounds)}`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const json = (await res.json()) as { places: PlaceWithPublicId[] }
        setPlaces(
          json.places.map((p) => ({
            ...p,
            imageCreationTime: new Date(p.imageCreationTime),
          }))
        )
      } catch {
        // 중단되었거나 네트워크 오류. 이전 데이터를 유지한다.
      }
    }

    void load()
    return () => controller.abort()
  }, [debouncedBounds])

  const onMoveEnd = (e: ViewStateChangeEvent) => {
    const b = e.target.getBounds()
    if (b) {
      setBounds({
        sw: { latitude: b.getSouth(), longitude: b.getWest() },
        ne: { latitude: b.getNorth(), longitude: b.getEast() },
      })
    }
    setViewport({
      latitude: e.viewState.latitude,
      longitude: e.viewState.longitude,
      zoom: e.viewState.zoom,
    })
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] w-full">
      <Map
        initialViewState={viewport}
        onMoveEnd={onMoveEnd}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_TOKEN}
        style={{ width: "100%", height: "100%" }}
      >
        {shownPlaces.map((place) => (
          <Marker
            key={place.id}
            latitude={place.latitude}
            longitude={place.longitude}
            color="#ef4444"
            onClick={() => setSelected(place)}
          />
        ))}

        {selected && (
          <Popup
            latitude={selected.latitude}
            longitude={selected.longitude}
            onClose={() => setSelected(null)}
            closeOnClick={false}
            maxWidth="260px"
          >
            <div className="space-y-2">
              <p className="font-medium">{selected.description}</p>
              <div className="relative aspect-square w-full overflow-hidden rounded">
                <Image
                  src={selected.publicId}
                  alt={selected.description}
                  fill
                  sizes="260px"
                  className="object-cover"
                />
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  )
}
```

v8 변경 반영: import 경로가 `react-map-gl/mapbox`이고 기본 export 이름이 `Map`이다. `e.viewState`로 중심과 줌을 얻는다(v7에서는 `e.target.getCenter()`를 호출했다). `getBounds()`는 `null`을 반환할 수 있어 확인 후 사용한다.

`mapStyle`은 `streets-v9`에서 `streets-v12`로 올린다. mapbox-gl 3에서 v9 스타일은 오래된 스펙이다.

옛 `map.tsx`는 bounds를 `"[[126,37],[128,38]]"` 형태의 JSON 문자열로 localStorage에 넣고 매 렌더마다 파싱했다. 구조화된 `Bounds` 객체로 바꾼다. **localStorage 키 `bounds`의 값 형식이 바뀌므로**, 이전 형식이 남아 있으면 `JSON.parse`는 성공하지만 모양이 달라 `sw`가 `undefined`가 된다. Step 4에서 이를 처리한다.

- [ ] **Step 4: 옛 localStorage 형식 방어**

`src/components/map-view.tsx`의 `MapView` 안, `useLocalState` 호출 직후에 다음을 추가한다.

```tsx
  // 옛 버전은 bounds 를 "[[lng,lat],[lng,lat]]" 문자열로 저장했다.
  // 형식이 맞지 않으면 초기값으로 되돌린다.
  useEffect(() => {
    const malformed =
      typeof bounds?.sw?.latitude !== "number" ||
      typeof bounds?.ne?.latitude !== "number"
    if (malformed) {
      setBounds(initialBounds)
    }
  }, [bounds, initialBounds, setBounds])
```

`viewport`도 같은 이유로 확인이 필요하나, 옛 형식이 `{latitude, longitude, zoom}`으로 동일해 추가 처리가 필요 없다.

- [ ] **Step 5: 지도 페이지 작성**

`app/map/page.tsx`:

```tsx
import { MapView } from "@/components/map-view"
import { getPlacesInBounds } from "@/lib/places"
import type { Bounds } from "@/schemas/place"

// 홈과 같은 이유로 정적 프리렌더를 끈다.
export const dynamic = "force-dynamic"

const INITIAL_BOUNDS: Bounds = {
  sw: { latitude: 37, longitude: 126 },
  ne: { latitude: 38, longitude: 128 },
}

export default async function MapPage() {
  const places = await getPlacesInBounds(INITIAL_BOUNDS)

  return <MapView initialPlaces={places} initialBounds={INITIAL_BOUNDS} />
}
```

초기 bounds는 옛 기본값 `[[126,37],[128,38]]`과 동일한 영역이다. 서버에서 미리 읽어 넘기므로 지도가 처음 뜰 때 마커가 이미 있다.

- [ ] **Step 6: 빌드와 타입 체크**

Run: `npm run build && npx tsc --noEmit`
Expected: 성공

- [ ] **Step 7: Route Handler 동작 확인**

```bash
npm run dev &
sleep 15
echo "-- 정상 --"
curl -s "http://localhost:3000/api/places?swLat=37&swLng=126&neLat=38&neLng=128" | head -c 200
echo
echo "-- 잘못된 파라미터 --"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/places?swLat=abc"
echo "-- 지도 페이지 --"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/map
```

Expected: 정상 요청은 `{"places":[...]}`, 잘못된 파라미터는 `400`, `/map`은 `200`. 확인 후 dev 서버를 종료한다.

- [ ] **Step 8: 브라우저 수동 확인**

`npm run dev`로 띄운 뒤 `/map`에서 확인한다.

1. 마커가 표시되는가 (DB에 데이터가 있는 경우)
2. 지도를 드래그하면 1초 후 새 요청이 나가는가 (네트워크 탭에서 `/api/places` 확인)
3. 마커를 클릭하면 팝업에 설명과 사진이 뜨는가
4. 새로고침 후 마지막으로 보던 위치가 유지되는가
5. 콘솔에 하이드레이션 경고가 없는가

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Add/지도 라우트 — GET Route Handler + 클라이언트 지도

- app/api/places/route.ts: bounds 조회를 GET 으로 노출, Zod 로 쿼리 검증
  (서버 액션은 POST 전용·순차 실행이라 팬/줌 재조회에 부적합)
- app/map/page.tsx 가 초기 데이터를 서버에서 읽어 넘김
- react-map-gl v8 대응: import 를 react-map-gl/mapbox 로, 중심·줌을
  e.viewState 에서 읽도록 변경, mapStyle streets-v9→v12
- useLocalState 를 마운트 이후 읽도록 바꿔 하이드레이션 불일치 제거,
  JSON.parse 실패와 옛 bounds 형식 방어 추가
- src/utils/* 훅을 src/hooks/* 로 이전

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 등록 — 서버 액션과 폼

**Files:**
- Create: `src/actions/place.ts`
- Create: `src/components/place-form.tsx`
- Create: `src/components/star-rating.tsx`
- Create: `src/components/category-picker.tsx`
- Create: `app/create/page.tsx`

`src/components/starRating.tsx`와 `category.tsx`는 Task 1에서 이미 삭제되었다. 이 태스크는 새 파일명(`star-rating.tsx`, `category-picker.tsx`)으로 대체물을 만든다.

**Interfaces:**
- Consumes: `placeInputSchema`, `placeFormSchema`, `PlaceFormValues` (Task 2), `getCurrentUserId()` (Task 2), `CATEGORIES` (Task 3), shadcn `Field`/`FieldLabel`/`FieldError`/`Button`/`Textarea`/`ToggleGroup` + `toast` from sonner (Task 1)
- Produces:
  - `createUploadSignature(): Promise<{ ok: true; signature: string; timestamp: number } | { ok: false; error: string }>`
  - `createPlaceAction(input: unknown): Promise<{ ok: true; id: number } | { ok: false; error: string }>`
  - `<StarRating value={number} onChange={(v: number) => void} />`
  - `<CategoryPicker value={number} onChange={(v: number) => void} />`

- [ ] **Step 1: 서버 액션 작성**

`src/actions/place.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { v2 as cloudinary } from "cloudinary"
import { getCurrentUserId } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { placeInputSchema } from "@/schemas/place"

export type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

export async function createUploadSignature(): Promise<
  ActionResult<{ signature: string; timestamp: number }>
> {
  const secret = process.env.CLOUDINARY_SECRET
  if (!secret) {
    return { ok: false, error: "Cloudinary 설정이 없습니다" }
  }

  const timestamp = Math.round(Date.now() / 1000)
  const signature = cloudinary.utils.api_sign_request({ timestamp }, secret)
  return { ok: true, signature, timestamp }
}

export async function createPlaceAction(
  input: unknown
): Promise<ActionResult<{ id: number }>> {
  const parsed = placeInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다" }
  }

  const userId = await getCurrentUserId()

  try {
    const place = await prisma.place.create({
      data: { ...parsed.data, userId },
    })
    revalidatePath("/")
    revalidatePath("/map")
    return { ok: true, id: place.id }
  } catch {
    return { ok: false, error: "저장에 실패했습니다" }
  }
}
```

서명 발급이 서버 액션으로 옮겨져 `CLOUDINARY_SECRET`은 서버에만 머문다.

`revalidatePath`는 홈과 지도가 `force-dynamic`이어도 여전히 필요하다. 서버는 매 요청 재렌더하지만 **클라이언트 Router Cache**는 RSC 페이로드를 잠시 보관하므로, 저장 직후 클라이언트 내비게이션으로 홈에 돌아가면 방금 만든 장소가 빠진 화면을 볼 수 있다. `revalidatePath`가 그 캐시까지 무효화한다. 옛 코드에는 이에 대응하는 동작이 없어 Apollo 캐시가 낡은 상태로 남았다.

- [ ] **Step 2: StarRating 작성**

`src/components/star-rating.tsx`:

```tsx
"use client"

import { cn } from "@/lib/utils"

const STARS = [1, 2, 3, 4, 5]

export function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="별점">
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star}점`}
          onClick={() => onChange(star)}
          className={cn(
            "focus-visible:ring-ring rounded text-2xl leading-none transition-colors focus-visible:ring-2 focus-visible:outline-none",
            star <= value ? "text-amber-400" : "text-muted-foreground/40"
          )}
        >
          ★
        </button>
      ))}
    </div>
  )
}
```

옛 `starRating.tsx`는 SVG `<polygon>`을 5번 복사하고 클릭 핸들러를 각각 인라인으로 달았으며 자체 `useState`로 값을 들고 있어 폼과 상태가 이중화되어 있었다. 값은 폼이 소유하고 이 컴포넌트는 표시만 한다.

- [ ] **Step 3: CategoryPicker 작성**

`src/components/category-picker.tsx`:

```tsx
"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CATEGORIES } from "@/lib/categories"

export function CategoryPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <ToggleGroup
      value={[String(value)]}
      onValueChange={(next) => {
        const selected = next[0]
        if (selected) onChange(Number(selected))
      }}
      variant="outline"
      className="justify-start"
    >
      {CATEGORIES.map((category) => (
        <ToggleGroupItem
          key={category.value}
          value={String(category.value)}
          aria-label={category.label}
        >
          {category.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
```

`@base-ui/react`의 `ToggleGroup`은 Radix와 달리 `type` prop이 없고 값을 **배열**로 다룬다(단일 선택이 기본). 경계에서 숫자↔문자열을 변환하고, 선택 해제로 빈 배열이 오면 무시해 항상 하나가 선택된 상태를 유지한다. 라벨은 Task 3에서 만든 `@/lib/categories`를 공유하므로 `PlaceCard`와 어긋날 수 없다.

- [ ] **Step 4: 등록 폼 작성**

`src/components/place-form.tsx`:

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import exifr from "exifr"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { CategoryPicker } from "@/components/category-picker"
import { StarRating } from "@/components/star-rating"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { createPlaceAction, createUploadSignature } from "@/actions/place"
import { placeFormSchema, type PlaceFormValues } from "@/schemas/place"

type ExifData = {
  latitude: number
  longitude: number
  createDate: Date
}

async function uploadToCloudinary(
  file: File,
  signature: string,
  timestamp: number
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const formData = new FormData()
  formData.append("file", file)
  formData.append("signature", signature)
  formData.append("timestamp", String(timestamp))
  formData.append("api_key", process.env.NEXT_PUBLIC_CLOUDINARY_KEY ?? "")

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
    { method: "POST", body: formData }
  )
  if (!res.ok) throw new Error("이미지 업로드에 실패했습니다")

  const json = (await res.json()) as { secure_url?: string }
  if (!json.secure_url) throw new Error("이미지 업로드 응답이 올바르지 않습니다")
  return json.secure_url
}

export function PlaceForm() {
  const router = useRouter()
  const lottieRef = useRef<HTMLDivElement>(null)
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
  // 옛 코드는 최상위 정적 import 를 해서 /create 의 SSR 이 깨졌다.
  useEffect(() => {
    let destroy: (() => void) | undefined

    void (async () => {
      if (!lottieRef.current) return
      const [{ default: lottie }, { default: animationData }] =
        await Promise.all([
          import("lottie-web"),
          import("@/assets/photo-upload.json"),
        ])
      const animation = lottie.loadAnimation({
        container: lottieRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        animationData,
      })
      destroy = () => animation.destroy()
    })()

    return () => destroy?.()
  }, [])

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return

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
      const signatureResult = await createUploadSignature()
      if (!signatureResult.ok) {
        toast.error(signatureResult.error)
        return
      }

      const imageUrl = await uploadToCloudinary(
        file,
        signatureResult.signature,
        signatureResult.timestamp
      )

      const result = await createPlaceAction({
        description: values.description,
        image: imageUrl,
        imageCreationTime: exif.createDate,
        latitude: exif.latitude,
        longitude: exif.longitude,
        rating: values.rating,
        category: values.category,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("장소를 저장했습니다.")
      // 성공 시에는 setSubmitting(false)를 하지 않는다. router.push는 await되지
      // 않으므로 여기서 버튼을 되살리면 내비게이션이 끝나기 전에 두 번째 제출이
      // 들어와 같은 장소가 중복 저장될 수 있다.
      router.push("/map")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "저장 중 문제가 발생했습니다."
      )
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto max-w-xl space-y-6 px-4 py-10"
    >
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
          accept="image/*"
          className="sr-only"
          onChange={onFileChange}
        />
        {exif && (
          <p className="text-muted-foreground mt-2 text-sm">
            촬영 위치 {exif.latitude.toFixed(5)}, {exif.longitude.toFixed(5)}
          </p>
        )}
      </div>

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
```

제출 핸들러는 성공 시 버튼을 되살리지 않는다. 실패로 조기 반환하는 경로(서명 실패, 액션 실패)에서는 각각 `setSubmitting(false)`를 호출해야 한다.

EXIF 좌표 판정에 `!parsed?.latitude`를 쓰면 안 된다. 위도 0(적도)이나 경도 0(본초자오선)이 falsy라 GPS가 있는 사진을 거부한다. `== null`로 존재 여부만 본다.

shadcn은 최신 스타일에서 react-hook-form 전용 `Form`/`FormField`를 폐기하고 `Field`로 대체했다. `Field`는 react-hook-form을 알지 못하므로 `Controller`로 직접 배선하고, 오류는 `FieldError`의 `errors` prop에 배열로 넘긴다(시그니처: `errors?: Array<{ message?: string } | undefined>`).

미리보기는 `URL.createObjectURL`을 쓰고 `unoptimized`를 붙인다. 옛 코드는 `FileReader`로 data URL을 만들어 `next/image`에 넘겼는데, Cloudinary 로더가 붙은 상태에서 data URL은 처리되지 않는다. blob URL은 언마운트 시 해제한다.

옛 `create.tsx`의 `register("image")` 사용은 `{...(register("image"), { required: true })}`로 쉼표 연산자 때문에 `register` 결과가 버려지고 `{required: true}`만 적용되는 버그였다. 파일은 폼 필드에서 분리해 별도 상태로 다룬다.

- [ ] **Step 5: Lottie 애셋 경로 정리**

```bash
mkdir -p src/assets
git mv src/assets/photoUpload.json src/assets/photo-upload.json 2>/dev/null || \
  mv src/assets/photoUpload.json src/assets/photo-upload.json
```

`tsconfig.json`의 `resolveJsonModule`이 이미 `true`이므로 JSON 동적 import가 동작한다.

- [ ] **Step 6: 등록 페이지 작성**

`app/create/page.tsx`:

```tsx
import { PlaceForm } from "@/components/place-form"

export default function CreatePage() {
  return (
    <main>
      <h1 className="sr-only">장소 등록</h1>
      <PlaceForm />
    </main>
  )
}
```

- [ ] **Step 7: 빌드와 타입 체크**

Run: `npm run build && npx tsc --noEmit`
Expected: 성공. **`/create`가 빌드되는 것이 이 태스크의 핵심 지표다** — 마이그레이션 전에는 lottie의 `document` 접근 때문에 "Failed to collect page data for /create"로 빌드가 실패했다.

- [ ] **Step 8: 라우트 응답 확인**

```bash
npm run dev &
sleep 15
curl -s -o /dev/null -w "create=%{http_code}\n" http://localhost:3000/create
```

Expected: `create=200` (마이그레이션 전에는 500이었다). 확인 후 dev 서버를 종료한다.

- [ ] **Step 9: 등록 흐름 수동 확인**

`npm run dev`로 띄운 뒤 `/create`에서 확인한다.

1. Lottie 애니메이션이 재생되는가
2. GPS 정보가 있는 사진을 선택하면 미리보기와 좌표가 표시되는가
3. GPS 정보가 없는 사진을 선택하면 토스트 경고가 뜨고 선택이 취소되는가
4. 설명을 비운 채 저장을 누르면 필드 오류 메시지가 뜨는가
5. 정상 입력으로 저장하면 성공 토스트가 뜨고 `/map`으로 이동하는가
6. 이동한 지도와 홈에 새 장소가 보이는가 (`revalidatePath` 확인)

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Add/등록 폼을 서버 액션 기반으로 재작성

- src/actions/place.ts: createPlaceAction, createUploadSignature
  Zod 로 서버측 재검증, 저장 후 revalidatePath 로 홈·지도 갱신
- shadcn Form(react-hook-form + zodResolver) 으로 폼 재구성,
  alert 을 sonner 토스트로 교체
- lottie-web 을 useEffect 안 동적 import 로 바꿔 /create SSR 오류 해소
  (기존에는 dev 500, build 실패)
- 미리보기를 data URL 에서 blob URL 로 바꿔 Cloudinary 로더와 충돌 제거
- register("image") 의 쉼표 연산자 오용 제거, 파일을 별도 상태로 분리
- StarRating·CategoryPicker 를 값 소유 없는 표시 컴포넌트로 재작성

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Header와 View Transitions

**Files:**
- Modify: `src/components/header.tsx` (기존 파일 전체를 덮어쓴다. 옛 버전은 styled-components를 쓰고 default export였다)
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `cn()` (Task 1)
- Produces: `<Header />`

- [ ] **Step 1: Header 작성**

`src/components/header.tsx` (기존 파일을 덮어쓴다):

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/create", label: "등록" },
  { href: "/map", label: "지도" },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="bg-background/80 border-border sticky top-0 z-10 flex h-[var(--header-height)] items-center justify-center gap-1 border-b backdrop-blur">
      <nav className="flex gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
```

옛 헤더에는 버그가 있었다 — Create 링크의 활성 조건이 `route === "/about"`이어서 어떤 경로에서도 활성화되지 않았다. `usePathname()`으로 정확히 비교한다. 또한 옛 헤더는 `position: fixed`에 `height: 7vh`였고 각 페이지가 `margin-top: 7vh`로 보정했다. `sticky`와 `h-[var(--header-height)]`로 바꿔 보정이 필요 없게 한다. `--header-height`는 Task 4에서 `app/globals.css`의 `:root`에 추가한 변수로, 지도 뷰포트 높이 계산과 값을 공유한다.

- [ ] **Step 2: 페이지 전환은 구현하지 않는다**

설계 단계에서는 React의 `<ViewTransition>`으로 크로스페이드를 넣기로 했으나, 실제 설치된 버전에서 사용할 수 없음이 확인되었다.

- `react@19.2.8`은 `ViewTransition`도 `unstable_ViewTransition`도 export하지 않는다.
- `next@16.3.1`의 config 스키마에 `experimental.viewTransition` 키가 없어 내부의 `react-experimental` 번들로 전환할 방법이 없다.

CSS만 넣는 대체안도 성립하지 않는다. `::view-transition-*`는 전환이 실제로 시작되어야 적용되는데, App Router의 클라이언트 내비게이션은 same-document라 브라우저가 자동으로 시작하지 않는다. 규칙만 남고 아무것도 실행되지 않는 죽은 코드가 된다.

프로젝트 소유자 결정에 따라 **전환 효과 없이 마무리한다.** `::view-transition-*` CSS를 넣지 않고, `app/layout.tsx`는 `{children}`을 그대로 렌더한다. 이 사실을 Task 7에서 README에 기록한다.

`react-transition-group`은 Task 1에서 이미 제거되었으므로 추가 정리는 없다.

- [ ] **Step 5: 빌드와 타입 체크**

Run: `npm run build && npx tsc --noEmit`
Expected: 성공. `/`가 동적 렌더링(`ƒ`)으로 표시된다 — DB를 읽으므로 정적화되지 않는다.

- [ ] **Step 6: 홈이 서버에서 렌더되는지 확인**

```bash
npm run dev &
sleep 15
curl -s http://localhost:3000/ | grep -c "다녀온 장소"
```

Expected: `1` 이상. JS 실행 없이 받은 HTML에 제목이 들어 있어야 한다. DB에 데이터가 있으면 장소 설명 문자열도 HTML에 포함되는지 함께 확인한다. 확인 후 dev 서버를 종료한다.

이것이 이 마이그레이션의 핵심 검증 항목이다. 옛 홈은 HTML이 비어 있고 JS가 `/api/graphql`을 호출한 뒤에야 카드가 나타났다.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Add/홈을 서버 컴포넌트로 재작성

- app/page.tsx 가 Prisma 를 직접 읽어 첫 HTML 에 목록을 담아 응답
  (기존에는 빈 화면 → JS 로드 → /api/graphql 왕복 후 렌더)
- PlaceCard 를 shadcn Card 기반으로 재구성, 카테고리 라벨과 별점 표시 추가
- 빈 상태 안내 추가
- loading / error / not-found 경계 추가

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 지도 — Route Handler와 클라이언트 지도

**Files:**
- Create: `app/api/places/route.ts`
- Create: `app/map/page.tsx`
- Create: `src/components/map-view.tsx`
- Create: `src/hooks/use-local-state.ts`
- Create: `src/hooks/use-last-data.ts`
- Delete: `src/utils/useLocalState.ts`, `src/utils/useLastData.ts`

**Interfaces:**
- Consumes: `getPlacesInBounds()`, `boundsQuerySchema`, `PlaceWithPublicId` (Task 2)
- Produces:
  - `GET /api/places?swLat&swLng&neLat&neLng` → `{ places: PlaceWithPublicId[] }` (200) 또는 `{ error: string }` (400)
  - `<MapView initialPlaces={...} initialBounds={...} />`
  - `useLocalState<S>(key: string, initial: S): [S, Dispatch<SetStateAction<S>>]`
  - `useLastData<S>(data: S): S`

- [ ] **Step 1: Route Handler 작성**

`app/api/places/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server"
import { getPlacesInBounds } from "@/lib/places"
import { boundsQuerySchema } from "@/schemas/place"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const parsed = boundsQuerySchema.safeParse({
    swLat: sp.get("swLat"),
    swLng: sp.get("swLng"),
    neLat: sp.get("neLat"),
    neLng: sp.get("neLng"),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "bounds 파라미터가 올바르지 않습니다" },
      { status: 400 }
    )
  }

  const places = await getPlacesInBounds(parsed.data)
  return NextResponse.json({ places })
}
```

- [ ] **Step 2: 훅 이전**

`src/hooks/use-local-state.ts`:

```ts
"use client"

import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

export function useLocalState<S>(
  key: string,
  initial: S
): [S, Dispatch<SetStateAction<S>>] {
  const [value, setValue] = useState<S>(initial)

  // 서버 렌더 결과와 어긋나지 않도록 마운트 이후에 읽는다.
  useEffect(() => {
    const saved = window.localStorage.getItem(key)
    if (saved !== null) {
      try {
        setValue(JSON.parse(saved) as S)
      } catch {
        window.localStorage.removeItem(key)
      }
    }
  }, [key])

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}
```

옛 `useLocalState`는 `useState` 초기화 함수에서 localStorage를 읽어 서버와 클라이언트의 첫 렌더 결과가 달라질 수 있었고(하이드레이션 불일치), `JSON.parse` 실패를 처리하지 않았다.

`src/hooks/use-last-data.ts`:

```ts
"use client"

import { useRef } from "react"

/** 재조회 중 이전 데이터를 유지해 지도가 비지 않게 한다. */
export function useLastData<S>(data: S): S {
  const ref = useRef(data)
  if (data !== null && data !== undefined) {
    ref.current = data
  }
  return ref.current
}
```

```bash
git rm --quiet src/utils/useLocalState.ts src/utils/useLastData.ts
```

- [ ] **Step 3: MapView 작성**

`src/components/map-view.tsx`:

```tsx
"use client"

import "mapbox-gl/dist/mapbox-gl.css"

import Image from "next/image"
import { useEffect, useState } from "react"
import Map, {
  Marker,
  Popup,
  type ViewStateChangeEvent,
} from "react-map-gl/mapbox"
import { useDebounce } from "use-debounce"
import { useLastData } from "@/hooks/use-last-data"
import { useLocalState } from "@/hooks/use-local-state"
import type { PlaceWithPublicId } from "@/lib/places"
import type { Bounds } from "@/schemas/place"

type Viewport = { latitude: number; longitude: number; zoom: number }

const DEFAULT_VIEWPORT: Viewport = {
  latitude: 37.65874,
  longitude: 126.97759,
  zoom: 10,
}

function toQuery(bounds: Bounds): string {
  return new URLSearchParams({
    swLat: String(bounds.sw.latitude),
    swLng: String(bounds.sw.longitude),
    neLat: String(bounds.ne.latitude),
    neLng: String(bounds.ne.longitude),
  }).toString()
}

export function MapView({
  initialPlaces,
  initialBounds,
}: {
  initialPlaces: PlaceWithPublicId[]
  initialBounds: Bounds
}) {
  const [selected, setSelected] = useState<PlaceWithPublicId | null>(null)
  const [viewport, setViewport] = useLocalState<Viewport>(
    "viewport",
    DEFAULT_VIEWPORT
  )
  const [bounds, setBounds] = useLocalState<Bounds>("bounds", initialBounds)
  const [debouncedBounds] = useDebounce(bounds, 1000)
  const [places, setPlaces] = useState<PlaceWithPublicId[] | null>(
    initialPlaces
  )
  const shownPlaces = useLastData(places) ?? []

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const res = await fetch(`/api/places?${toQuery(debouncedBounds)}`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const json = (await res.json()) as { places: PlaceWithPublicId[] }
        setPlaces(
          json.places.map((p) => ({
            ...p,
            imageCreationTime: new Date(p.imageCreationTime),
          }))
        )
      } catch {
        // 중단되었거나 네트워크 오류. 이전 데이터를 유지한다.
      }
    }

    void load()
    return () => controller.abort()
  }, [debouncedBounds])

  const onMoveEnd = (e: ViewStateChangeEvent) => {
    const b = e.target.getBounds()
    if (b) {
      setBounds({
        sw: { latitude: b.getSouth(), longitude: b.getWest() },
        ne: { latitude: b.getNorth(), longitude: b.getEast() },
      })
    }
    setViewport({
      latitude: e.viewState.latitude,
      longitude: e.viewState.longitude,
      zoom: e.viewState.zoom,
    })
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] w-full">
      <Map
        initialViewState={viewport}
        onMoveEnd={onMoveEnd}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_TOKEN}
        style={{ width: "100%", height: "100%" }}
      >
        {shownPlaces.map((place) => (
          <Marker
            key={place.id}
            latitude={place.latitude}
            longitude={place.longitude}
            color="#ef4444"
            onClick={() => setSelected(place)}
          />
        ))}

        {selected && (
          <Popup
            latitude={selected.latitude}
            longitude={selected.longitude}
            onClose={() => setSelected(null)}
            closeOnClick={false}
            maxWidth="260px"
          >
            <div className="space-y-2">
              <p className="font-medium">{selected.description}</p>
              <div className="relative aspect-square w-full overflow-hidden rounded">
                <Image
                  src={selected.publicId}
                  alt={selected.description}
                  fill
                  sizes="260px"
                  className="object-cover"
                />
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  )
}
```

v8 변경 반영: import 경로가 `react-map-gl/mapbox`이고 기본 export 이름이 `Map`이다. `e.viewState`로 중심과 줌을 얻는다(v7에서는 `e.target.getCenter()`를 호출했다). `getBounds()`는 `null`을 반환할 수 있어 확인 후 사용한다.

`mapStyle`은 `streets-v9`에서 `streets-v12`로 올린다. mapbox-gl 3에서 v9 스타일은 오래된 스펙이다.

옛 `map.tsx`는 bounds를 `"[[126,37],[128,38]]"` 형태의 JSON 문자열로 localStorage에 넣고 매 렌더마다 파싱했다. 구조화된 `Bounds` 객체로 바꾼다. **localStorage 키 `bounds`의 값 형식이 바뀌므로**, 이전 형식이 남아 있으면 `JSON.parse`는 성공하지만 모양이 달라 `sw`가 `undefined`가 된다. Step 4에서 이를 처리한다.

- [ ] **Step 4: 옛 localStorage 형식 방어**

`src/components/map-view.tsx`의 `MapView` 안, `useLocalState` 호출 직후에 다음을 추가한다.

```tsx
  // 옛 버전은 bounds 를 "[[lng,lat],[lng,lat]]" 문자열로 저장했다.
  // 형식이 맞지 않으면 초기값으로 되돌린다.
  useEffect(() => {
    const malformed =
      typeof bounds?.sw?.latitude !== "number" ||
      typeof bounds?.ne?.latitude !== "number"
    if (malformed) {
      setBounds(initialBounds)
    }
  }, [bounds, initialBounds, setBounds])
```

`viewport`도 같은 이유로 확인이 필요하나, 옛 형식이 `{latitude, longitude, zoom}`으로 동일해 추가 처리가 필요 없다.

- [ ] **Step 5: 지도 페이지 작성**

`app/map/page.tsx`:

```tsx
import { MapView } from "@/components/map-view"
import { getPlacesInBounds } from "@/lib/places"
import type { Bounds } from "@/schemas/place"

// 홈과 같은 이유로 정적 프리렌더를 끈다.
export const dynamic = "force-dynamic"

const INITIAL_BOUNDS: Bounds = {
  sw: { latitude: 37, longitude: 126 },
  ne: { latitude: 38, longitude: 128 },
}

export default async function MapPage() {
  const places = await getPlacesInBounds(INITIAL_BOUNDS)

  return <MapView initialPlaces={places} initialBounds={INITIAL_BOUNDS} />
}
```

초기 bounds는 옛 기본값 `[[126,37],[128,38]]`과 동일한 영역이다. 서버에서 미리 읽어 넘기므로 지도가 처음 뜰 때 마커가 이미 있다.

- [ ] **Step 6: 빌드와 타입 체크**

Run: `npm run build && npx tsc --noEmit`
Expected: 성공

- [ ] **Step 7: Route Handler 동작 확인**

```bash
npm run dev &
sleep 15
echo "-- 정상 --"
curl -s "http://localhost:3000/api/places?swLat=37&swLng=126&neLat=38&neLng=128" | head -c 200
echo
echo "-- 잘못된 파라미터 --"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/places?swLat=abc"
echo "-- 지도 페이지 --"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/map
```

Expected: 정상 요청은 `{"places":[...]}`, 잘못된 파라미터는 `400`, `/map`은 `200`. 확인 후 dev 서버를 종료한다.

- [ ] **Step 8: 브라우저 수동 확인**

`npm run dev`로 띄운 뒤 `/map`에서 확인한다.

1. 마커가 표시되는가 (DB에 데이터가 있는 경우)
2. 지도를 드래그하면 1초 후 새 요청이 나가는가 (네트워크 탭에서 `/api/places` 확인)
3. 마커를 클릭하면 팝업에 설명과 사진이 뜨는가
4. 새로고침 후 마지막으로 보던 위치가 유지되는가
5. 콘솔에 하이드레이션 경고가 없는가

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Add/지도 라우트 — GET Route Handler + 클라이언트 지도

- app/api/places/route.ts: bounds 조회를 GET 으로 노출, Zod 로 쿼리 검증
  (서버 액션은 POST 전용·순차 실행이라 팬/줌 재조회에 부적합)
- app/map/page.tsx 가 초기 데이터를 서버에서 읽어 넘김
- react-map-gl v8 대응: import 를 react-map-gl/mapbox 로, 중심·줌을
  e.viewState 에서 읽도록 변경, mapStyle streets-v9→v12
- useLocalState 를 마운트 이후 읽도록 바꿔 하이드레이션 불일치 제거,
  JSON.parse 실패와 옛 bounds 형식 방어 추가
- src/utils/* 훅을 src/hooks/* 로 이전

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 등록 — 서버 액션과 폼

**Files:**
- Create: `src/actions/place.ts`
- Create: `src/components/place-form.tsx`
- Create: `src/components/star-rating.tsx`
- Create: `src/components/category-picker.tsx`
- Create: `app/create/page.tsx`

`src/components/starRating.tsx`와 `category.tsx`는 Task 1에서 이미 삭제되었다. 이 태스크는 새 파일명(`star-rating.tsx`, `category-picker.tsx`)으로 대체물을 만든다.

**Interfaces:**
- Consumes: `placeInputSchema`, `placeFormSchema`, `PlaceFormValues` (Task 2), `getCurrentUserId()` (Task 2), `CATEGORIES` (Task 3), shadcn `Field`/`FieldLabel`/`FieldError`/`Button`/`Textarea`/`ToggleGroup` + `toast` from sonner (Task 1)
- Produces:
  - `createUploadSignature(): Promise<{ ok: true; signature: string; timestamp: number } | { ok: false; error: string }>`
  - `createPlaceAction(input: unknown): Promise<{ ok: true; id: number } | { ok: false; error: string }>`
  - `<StarRating value={number} onChange={(v: number) => void} />`
  - `<CategoryPicker value={number} onChange={(v: number) => void} />`

- [ ] **Step 1: 서버 액션 작성**

`src/actions/place.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { v2 as cloudinary } from "cloudinary"
import { getCurrentUserId } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { placeInputSchema } from "@/schemas/place"

export type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

export async function createUploadSignature(): Promise<
  ActionResult<{ signature: string; timestamp: number }>
> {
  const secret = process.env.CLOUDINARY_SECRET
  if (!secret) {
    return { ok: false, error: "Cloudinary 설정이 없습니다" }
  }

  const timestamp = Math.round(Date.now() / 1000)
  const signature = cloudinary.utils.api_sign_request({ timestamp }, secret)
  return { ok: true, signature, timestamp }
}

export async function createPlaceAction(
  input: unknown
): Promise<ActionResult<{ id: number }>> {
  const parsed = placeInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다" }
  }

  const userId = await getCurrentUserId()

  try {
    const place = await prisma.place.create({
      data: { ...parsed.data, userId },
    })
    revalidatePath("/")
    revalidatePath("/map")
    return { ok: true, id: place.id }
  } catch {
    return { ok: false, error: "저장에 실패했습니다" }
  }
}
```

서명 발급이 서버 액션으로 옮겨져 `CLOUDINARY_SECRET`은 서버에만 머문다.

`revalidatePath`는 홈과 지도가 `force-dynamic`이어도 여전히 필요하다. 서버는 매 요청 재렌더하지만 **클라이언트 Router Cache**는 RSC 페이로드를 잠시 보관하므로, 저장 직후 클라이언트 내비게이션으로 홈에 돌아가면 방금 만든 장소가 빠진 화면을 볼 수 있다. `revalidatePath`가 그 캐시까지 무효화한다. 옛 코드에는 이에 대응하는 동작이 없어 Apollo 캐시가 낡은 상태로 남았다.

- [ ] **Step 2: StarRating 작성**

`src/components/star-rating.tsx`:

```tsx
"use client"

import { cn } from "@/lib/utils"

const STARS = [1, 2, 3, 4, 5]

export function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="별점">
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star}점`}
          onClick={() => onChange(star)}
          className={cn(
            "focus-visible:ring-ring rounded text-2xl leading-none transition-colors focus-visible:ring-2 focus-visible:outline-none",
            star <= value ? "text-amber-400" : "text-muted-foreground/40"
          )}
        >
          ★
        </button>
      ))}
    </div>
  )
}
```

옛 `starRating.tsx`는 SVG `<polygon>`을 5번 복사하고 클릭 핸들러를 각각 인라인으로 달았으며 자체 `useState`로 값을 들고 있어 폼과 상태가 이중화되어 있었다. 값은 폼이 소유하고 이 컴포넌트는 표시만 한다.

- [ ] **Step 3: CategoryPicker 작성**

`src/components/category-picker.tsx`:

```tsx
"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CATEGORIES } from "@/lib/categories"

export function CategoryPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <ToggleGroup
      value={[String(value)]}
      onValueChange={(next) => {
        const selected = next[0]
        if (selected) onChange(Number(selected))
      }}
      variant="outline"
      className="justify-start"
    >
      {CATEGORIES.map((category) => (
        <ToggleGroupItem
          key={category.value}
          value={String(category.value)}
          aria-label={category.label}
        >
          {category.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
```

`@base-ui/react`의 `ToggleGroup`은 Radix와 달리 `type` prop이 없고 값을 **배열**로 다룬다(단일 선택이 기본). 경계에서 숫자↔문자열을 변환하고, 선택 해제로 빈 배열이 오면 무시해 항상 하나가 선택된 상태를 유지한다. 라벨은 Task 3에서 만든 `@/lib/categories`를 공유하므로 `PlaceCard`와 어긋날 수 없다.

- [ ] **Step 4: 등록 폼 작성**

`src/components/place-form.tsx`:

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import exifr from "exifr"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { CategoryPicker } from "@/components/category-picker"
import { StarRating } from "@/components/star-rating"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { createPlaceAction, createUploadSignature } from "@/actions/place"
import { placeFormSchema, type PlaceFormValues } from "@/schemas/place"

type ExifData = {
  latitude: number
  longitude: number
  createDate: Date
}

async function uploadToCloudinary(
  file: File,
  signature: string,
  timestamp: number
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const formData = new FormData()
  formData.append("file", file)
  formData.append("signature", signature)
  formData.append("timestamp", String(timestamp))
  formData.append("api_key", process.env.NEXT_PUBLIC_CLOUDINARY_KEY ?? "")

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
    { method: "POST", body: formData }
  )
  if (!res.ok) throw new Error("이미지 업로드에 실패했습니다")

  const json = (await res.json()) as { secure_url?: string }
  if (!json.secure_url) throw new Error("이미지 업로드 응답이 올바르지 않습니다")
  return json.secure_url
}

export function PlaceForm() {
  const router = useRouter()
  const lottieRef = useRef<HTMLDivElement>(null)
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
  // 옛 코드는 최상위 정적 import 를 해서 /create 의 SSR 이 깨졌다.
  useEffect(() => {
    let destroy: (() => void) | undefined

    void (async () => {
      if (!lottieRef.current) return
      const [{ default: lottie }, { default: animationData }] =
        await Promise.all([
          import("lottie-web"),
          import("@/assets/photo-upload.json"),
        ])
      const animation = lottie.loadAnimation({
        container: lottieRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        animationData,
      })
      destroy = () => animation.destroy()
    })()

    return () => destroy?.()
  }, [])

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return

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
      const signatureResult = await createUploadSignature()
      if (!signatureResult.ok) {
        toast.error(signatureResult.error)
        return
      }

      const imageUrl = await uploadToCloudinary(
        file,
        signatureResult.signature,
        signatureResult.timestamp
      )

      const result = await createPlaceAction({
        description: values.description,
        image: imageUrl,
        imageCreationTime: exif.createDate,
        latitude: exif.latitude,
        longitude: exif.longitude,
        rating: values.rating,
        category: values.category,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("장소를 저장했습니다.")
      // 성공 시에는 setSubmitting(false)를 하지 않는다. router.push는 await되지
      // 않으므로 여기서 버튼을 되살리면 내비게이션이 끝나기 전에 두 번째 제출이
      // 들어와 같은 장소가 중복 저장될 수 있다.
      router.push("/map")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "저장 중 문제가 발생했습니다."
      )
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto max-w-xl space-y-6 px-4 py-10"
    >
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
          accept="image/*"
          className="sr-only"
          onChange={onFileChange}
        />
        {exif && (
          <p className="text-muted-foreground mt-2 text-sm">
            촬영 위치 {exif.latitude.toFixed(5)}, {exif.longitude.toFixed(5)}
          </p>
        )}
      </div>

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
```

제출 핸들러는 성공 시 버튼을 되살리지 않는다. 실패로 조기 반환하는 경로(서명 실패, 액션 실패)에서는 각각 `setSubmitting(false)`를 호출해야 한다.

EXIF 좌표 판정에 `!parsed?.latitude`를 쓰면 안 된다. 위도 0(적도)이나 경도 0(본초자오선)이 falsy라 GPS가 있는 사진을 거부한다. `== null`로 존재 여부만 본다.

shadcn은 최신 스타일에서 react-hook-form 전용 `Form`/`FormField`를 폐기하고 `Field`로 대체했다. `Field`는 react-hook-form을 알지 못하므로 `Controller`로 직접 배선하고, 오류는 `FieldError`의 `errors` prop에 배열로 넘긴다(시그니처: `errors?: Array<{ message?: string } | undefined>`).

미리보기는 `URL.createObjectURL`을 쓰고 `unoptimized`를 붙인다. 옛 코드는 `FileReader`로 data URL을 만들어 `next/image`에 넘겼는데, Cloudinary 로더가 붙은 상태에서 data URL은 처리되지 않는다. blob URL은 언마운트 시 해제한다.

옛 `create.tsx`의 `register("image")` 사용은 `{...(register("image"), { required: true })}`로 쉼표 연산자 때문에 `register` 결과가 버려지고 `{required: true}`만 적용되는 버그였다. 파일은 폼 필드에서 분리해 별도 상태로 다룬다.

- [ ] **Step 5: Lottie 애셋 경로 정리**

```bash
mkdir -p src/assets
git mv src/assets/photoUpload.json src/assets/photo-upload.json 2>/dev/null || \
  mv src/assets/photoUpload.json src/assets/photo-upload.json
```

`tsconfig.json`의 `resolveJsonModule`이 이미 `true`이므로 JSON 동적 import가 동작한다.

- [ ] **Step 6: 등록 페이지 작성**

`app/create/page.tsx`:

```tsx
import { PlaceForm } from "@/components/place-form"

export default function CreatePage() {
  return (
    <main>
      <h1 className="sr-only">장소 등록</h1>
      <PlaceForm />
    </main>
  )
}
```

- [ ] **Step 7: 빌드와 타입 체크**

Run: `npm run build && npx tsc --noEmit`
Expected: 성공. **`/create`가 빌드되는 것이 이 태스크의 핵심 지표다** — 마이그레이션 전에는 lottie의 `document` 접근 때문에 "Failed to collect page data for /create"로 빌드가 실패했다.

- [ ] **Step 8: 라우트 응답 확인**

```bash
npm run dev &
sleep 15
curl -s -o /dev/null -w "create=%{http_code}\n" http://localhost:3000/create
```

Expected: `create=200` (마이그레이션 전에는 500이었다). 확인 후 dev 서버를 종료한다.

- [ ] **Step 9: 등록 흐름 수동 확인**

`npm run dev`로 띄운 뒤 `/create`에서 확인한다.

1. Lottie 애니메이션이 재생되는가
2. GPS 정보가 있는 사진을 선택하면 미리보기와 좌표가 표시되는가
3. GPS 정보가 없는 사진을 선택하면 토스트 경고가 뜨고 선택이 취소되는가
4. 설명을 비운 채 저장을 누르면 필드 오류 메시지가 뜨는가
5. 정상 입력으로 저장하면 성공 토스트가 뜨고 `/map`으로 이동하는가
6. 이동한 지도와 홈에 새 장소가 보이는가 (`revalidatePath` 확인)

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Add/등록 폼을 서버 액션 기반으로 재작성

- src/actions/place.ts: createPlaceAction, createUploadSignature
  Zod 로 서버측 재검증, 저장 후 revalidatePath 로 홈·지도 갱신
- shadcn Form(react-hook-form + zodResolver) 으로 폼 재구성,
  alert 을 sonner 토스트로 교체
- lottie-web 을 useEffect 안 동적 import 로 바꿔 /create SSR 오류 해소
  (기존에는 dev 500, build 실패)
- 미리보기를 data URL 에서 blob URL 로 바꿔 Cloudinary 로더와 충돌 제거
- register("image") 의 쉼표 연산자 오용 제거, 파일을 별도 상태로 분리
- StarRating·CategoryPicker 를 값 소유 없는 표시 컴포넌트로 재작성

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Header와 View Transitions

**Files:**
- Modify: `src/components/header.tsx` (기존 파일 전체를 덮어쓴다. 옛 버전은 styled-components를 쓰고 default export였다)
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `cn()` (Task 1)
- Produces: `<Header />`

- [ ] **Step 1: Header 작성**

`src/components/header.tsx` (기존 파일을 덮어쓴다):

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/create", label: "등록" },
  { href: "/map", label: "지도" },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="bg-background/80 border-border sticky top-0 z-10 flex h-14 items-center justify-center gap-1 border-b backdrop-blur">
      <nav className="flex gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
```

옛 헤더에는 버그가 있었다 — Create 링크의 활성 조건이 `route === "/about"`이어서 어떤 경로에서도 활성화되지 않았다. `usePathname()`으로 정확히 비교한다. 또한 옛 헤더는 `position: fixed`에 `height: 7vh`였고 각 페이지가 `margin-top: 7vh`로 보정했다. `sticky`와 고정 높이 `h-14`로 바꿔 보정이 필요 없게 한다.

- [ ] **Step 2: ViewTransition export 이름 확인**

React의 View Transition 컴포넌트는 버전에 따라 `ViewTransition` 또는 `unstable_ViewTransition`으로 노출된다. 실제 이름을 확인한다.

```bash
node -e "const r=require('react'); console.log(Object.keys(r).filter(k=>/ViewTransition/i.test(k)))"
```

Expected: `[ 'ViewTransition' ]` 또는 `[ 'unstable_ViewTransition' ]`.

- 배열이 비어 있으면 이 React 버전에 해당 API가 없다는 뜻이다. Step 3을 건너뛰고 Step 4의 CSS만 적용한 뒤(전환 애니메이션 없음), 이 사실을 커밋 메시지와 README에 기록한다.
- 이름이 나오면 Step 3에서 그 이름을 쓴다.

- [ ] **Step 3: 루트 레이아웃에 Header와 ViewTransition 배선**

`app/layout.tsx`를 다음으로 바꾼다. `ViewTransition`은 Step 2에서 확인한 이름을 쓴다(아래는 `ViewTransition`인 경우).

```tsx
import type { Metadata } from "next"
import { ViewTransition } from "react"
import { Header } from "@/components/header"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "my-place",
  description: "사진으로 다녀온 장소를 기록하고 지도에 모아 봅니다",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <Header />
        <ViewTransition>{children}</ViewTransition>
        <Toaster />
      </body>
    </html>
  )
}
```

이름이 `unstable_ViewTransition`이면 import를 다음으로 바꾼다.

```tsx
import { unstable_ViewTransition as ViewTransition } from "react"
```

- [ ] **Step 4: 크로스페이드 CSS 추가**

`app/globals.css` 맨 끝에 추가한다.

```css
::view-transition-old(root) {
  animation: 180ms cubic-bezier(0.4, 0, 1, 1) both fade-out;
}

::view-transition-new(root) {
  animation: 220ms cubic-bezier(0, 0, 0.2, 1) both fade-in;
}

@keyframes fade-out {
  to {
    opacity: 0;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
  }
}
```

옛 연출은 1000ms 회색 와이프였다. 400ms 크로스페이드로 줄인다. `prefers-reduced-motion`을 존중하는 것은 새 동작이다.

- [ ] **Step 5: 빌드와 타입 체크**

Run: `npm run build && npx tsc --noEmit`
Expected: 성공

- [ ] **Step 4: 내비게이션 수동 확인**

`npm run dev`로 띄운 뒤 확인한다.

1. 헤더의 세 링크가 각 페이지로 이동하는가
2. 현재 페이지 링크가 활성 표시되는가 (특히 `/create` — 옛 버전에서는 되지 않았다)
4. 헤더가 지도 위에 겹치지 않고 지도 높이가 화면에 맞는가

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Add/Header 재작성과 View Transitions 기반 페이지 전환

- usePathname 으로 활성 링크 판정 (옛 헤더는 Create 링크 조건이
  route === "/about" 이라 활성화되지 않는 버그가 있었다)
- fixed + 7vh 를 sticky + h-14 로 바꿔 페이지별 margin-top 보정 제거
- react-transition-group 와이프(1000ms) 를 View Transitions
  크로스페이드(400ms) 로 교체, prefers-reduced-motion 존중

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 정리와 문서 갱신

**Files:**
- Modify: `README.md`
- Delete: `src/auth/tokenCookies.ts`의 fetch 대상이 사라진 부분 확인용 (변경 여부는 Step 2에서 판단)
- Modify: `.gitignore` (필요 시)

**Interfaces:**
- Consumes: 앞선 모든 태스크의 결과
- Produces: 없음 (문서와 정리)

- [ ] **Step 1: 남은 참조 점검**

```bash
echo "-- 사라진 스택 참조 --"
grep -rn "styled-components\|@apollo\|type-graphql\|graphql\|apollo-server\|react-transition-group\|next-cloudinary" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=docs --exclude=package-lock.json . || echo "없음"
echo "-- 옛 경로 참조 --"
grep -rn "src/schema\|src/apollo\|src/styles\|src/utils/use\|from \"react-map-gl\"" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=docs . || echo "없음"
echo "-- pages 디렉터리 --"
ls pages 2>/dev/null || echo "없음"
```

Expected: 모두 "없음". 남은 것이 있으면 해당 파일을 정리한다.

- [ ] **Step 2: 끊긴 인증 배선 점검**

`src/auth/tokenCookies.ts`는 `/api/login`과 `/api/logout`으로 fetch하는데, 두 라우트는 `pages/api/`에 있었으므로 Task 1에서 삭제되었다. 인증은 이번 스코프가 아니므로 라우트를 다시 만들지 않는다. 대신 해당 파일 최상단에 상황을 기록한다.

`src/auth/tokenCookies.ts` 맨 위에 추가한다.

```ts
/**
 * 주의: 이 파일의 setTokenCookie/removeTokenCookie 는 /api/login,
 * /api/logout 으로 요청하지만 해당 라우트는 존재하지 않는다.
 * App Router 이전 시 pages/api 와 함께 삭제되었고, 인증 구현은
 * 이번 마이그레이션 스코프에서 제외되었다.
 * 인증을 붙일 때 Route Handler 로 다시 만들고 src/lib/auth.ts 의
 * getCurrentUserId 를 실제 구현으로 바꾼다.
 */
```

- [ ] **Step 3: 전체 검증 실행**

```bash
npm install
npx prisma generate
npm run test
npm run build
npx tsc --noEmit
```

Expected: 모두 성공. `npm install`은 `--legacy-peer-deps` 없이 통과해야 한다. `.npmrc`가 저장소에 없는지 확인한다.

```bash
ls .npmrc 2>/dev/null && echo "경고: .npmrc 가 남아 있다" || echo "확인: .npmrc 없음"
```

- [ ] **Step 4: 세 라우트 응답 확인**

```bash
npm run dev &
sleep 15
for r in / /map /create; do
  printf "%-8s %s\n" "$r" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$r)"
done
curl -s -o /dev/null -w "api %{http_code}\n" \
  "http://localhost:3000/api/places?swLat=37&swLng=126&neLat=38&neLng=128"
```

Expected: 세 라우트 모두 `200`, API도 `200`. 확인 후 dev 서버를 종료한다.

- [ ] **Step 5: README 갱신**

`README.md`에서 다음을 수정한다.

1. **기술 스택** 절 전체를 교체한다.

```markdown
## 기술 스택

- **프레임워크**: Next.js 16 (App Router), React 19, TypeScript
- **스타일**: Tailwind CSS 4 + shadcn/ui
- **데이터**: 서버 컴포넌트가 Prisma를 직접 호출. 쓰기는 서버 액션,
  지도 bounds 재조회는 Route Handler(GET)
- **검증**: Zod (클라이언트 폼과 서버 액션이 스키마 공유)
- **DB / ORM**: PostgreSQL + Prisma 6
- **지도**: Mapbox GL 3 (`react-map-gl` 8)
- **이미지**: Cloudinary (next/image 커스텀 로더)
- **인증**: Firebase Auth 클라이언트 코드만 존재 — 미구현 (아래 참고)
- **테스트**: Vitest
- **기타**: react-hook-form, exifr, lottie-web, use-debounce
```

2. **아키텍처** 절 전체(다이어그램, GraphQL API 절, `schema.gql`·`yarn codegen` 언급 포함)를 다음으로 교체한다.

````markdown
## 아키텍처

```text
브라우저
 ├─ 홈 /            서버 컴포넌트 ──► Prisma ──► PostgreSQL
 ├─ 지도 /map       서버에서 초기 데이터 ──► 클라이언트 지도
 │                   팬/줌 ──► GET /api/places?swLat&swLng&neLat&neLng
 ├─ 등록 /create    폼 ──► 서버 액션 createPlaceAction ──► Prisma
 │                       └─ createUploadSignature ──► Cloudinary 직접 업로드
 └─ 이미지          next/image + Cloudinary 커스텀 로더
```

읽기는 서버 컴포넌트가 Prisma를 직접 호출한다. 지도의 bounds 재조회만
Route Handler(GET)를 쓰는데, 서버 액션은 POST 전용이고 순차 실행되어
팬/줌마다 호출하기에 맞지 않기 때문이다. 쓰기는 서버 액션이 담당하며
`CLOUDINARY_SECRET`은 서버에만 머문다.

`src/schemas/place.ts`의 Zod 스키마 하나를 클라이언트 폼 검증과 서버 액션
검증이 공유한다.
````

3. **데이터 모델** 절은 유지한다(Prisma 모델은 변경되지 않았다).

4. **디렉터리 구조** 절을 다음으로 교체한다.

````markdown
## 디렉터리 구조

```text
app/
  layout.tsx           루트 레이아웃 (Header, View Transitions)
  globals.css          Tailwind 4 + shadcn 테마
  page.tsx             홈
  map/page.tsx         지도
  create/page.tsx      등록
  api/places/route.ts  bounds 기반 장소 조회
  error.tsx  loading.tsx  not-found.tsx
src/
  actions/     서버 액션 (createPlaceAction, createUploadSignature)
  schemas/     Zod 스키마 (폼·서버 액션 공용)
  lib/         prisma, places, auth, categories, cloudinary-loader, utils(cn)
  components/  Header, PlaceCard, MapView, PlaceForm, StarRating, CategoryPicker
  components/ui/  shadcn 생성물
  hooks/       useLocalState, useLastData
  auth/        Firebase 클라이언트 코드 (미구현 상태로 보존)
  assets/      Lottie 애니메이션 JSON
prisma/schema.prisma
```
````

5. **미완성 / 알려진 이슈** 절을 다음으로 교체한다.

````markdown
## 미완성 / 알려진 이슈

- **인증이 구현되어 있지 않습니다.** (아래 항목 참고)
- 홈 카드가 shadcn Card 기반으로 재구성되면서, 이전의 티켓 절취선 디자인은
  더 이상 재현하지 않습니다.
- 테스트는 Zod 스키마와 순수 함수에 대한 Vitest 단위 테스트만 있습니다.
  컴포넌트 테스트와 E2E 테스트는 없습니다.
- `place(id)` 단건 조회, 반경 10km `nearby` 조회, 장소 삭제 기능은 이전
  GraphQL 스키마에 정의되어 있었으나 호출하는 화면이 없어 이전 대상에서
  제외했습니다.
````

기존 절에 있던 다음 항목은 해결되었으므로 삭제한다: lottie SSR 버그(Task 5),
미사용 의존성(Task 1), `.npmrc` 관련 주의(Task 1), 로그인 하드코딩 항목은
아래 6번의 인증 항목으로 통합.

6. 인증 항목을 다음으로 교체한다.

```markdown
- **인증이 구현되어 있지 않습니다.** 모든 쓰기 경로는
  `src/lib/auth.ts`의 `getCurrentUserId()`를 통과하며, 이 함수는 고정값
  `"1"`을 반환합니다. 인증을 붙일 때 이 함수 하나만 실제 구현으로 바꾸면
  됩니다. 클라이언트 Firebase 코드(`src/auth/`)는 남아 있으나 로그인 폼과
  세션 검증이 없고, `tokenCookies.ts`가 요청하는 `/api/login`·`/api/logout`
  라우트는 존재하지 않습니다.
```

7. **시작하기** 절의 `npx prisma generate`·`npx prisma db push`·`npm run dev` 명령은 그대로 유지한다. `.npmrc`와 `legacy-peer-deps`를 설명하는 인용 문단은 삭제한다(Task 1에서 해소됨). 환경 변수 목록은 `src/types/env.d.ts`의 8개와 일치하는지 확인한다.

8. **그 외 스크립트** 절에서 `npm run codegen` 줄을 삭제하고 `npm test   # Vitest 단위 테스트` 줄을 추가한다.

- [ ] **Step 6: README가 실제와 맞는지 확인**

```bash
grep -n "yarn\|codegen\|graphql\|styled-components\|legacy-peer-deps" README.md || echo "낡은 언급 없음"
```

Expected: "낡은 언급 없음". 남아 있으면 수정한다.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
docs: Change/README 를 App Router · Tailwind · shadcn 구조로 갱신

- 기술 스택, 아키텍처, 디렉터리 구조를 현재 구현에 맞게 교체
- 해결된 알려진 이슈(lottie SSR, 미사용 의존성, .npmrc) 삭제
- 인증 미구현 지점을 getCurrentUserId 한 곳으로 안내
- tokenCookies.ts 에 끊긴 /api/login·logout 배선 상황 기록

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 최종 리뷰에서 추가된 수정

브랜치 전체 리뷰에서 Important 2건이 나와 반영했다.

1. `clampRating()`을 `src/lib/places.ts`에 두고 `PlaceCard`의 별점 렌더와 `aria-label`이 모두 이를 거치게 했다. `"★".repeat()`는 음수에서 `RangeError`를 던지는데, `PlaceCard`가 서버 컴포넌트라 잘못된 행 하나가 홈 전체를 오류 화면으로 바꿀 수 있었다. 마이그레이션 전 GraphQL 쓰기 경로에는 `rating` 상·하한이 없어 기존 데이터가 제약되지 않는다.
2. 등록 페이지의 확인용 지도를 복원했다. 계획이 이 기능을 근거 없이 누락했고 README는 여전히 있다고 적고 있었다.

## 완료 기준

설계 문서 10절의 항목과 대응한다.

| 기준 | 확인 태스크 |
| --- | --- |
| `npm run build` 통과 | Task 1 Step 14, Task 7 Step 3 |
| `/`, `/map`, `/create` 모두 200 | Task 7 Step 4 |
| 홈이 JS 없이 카드 렌더 | Task 3 Step 6 |
| 사진 업로드 → EXIF → 저장 → 홈·지도 반영 | Task 5 Step 9 |
| `npm install`이 `--legacy-peer-deps` 없이 성공 | Task 1 Step 3, Task 7 Step 3 |
| Zod 스키마 단위 테스트 | Task 2 Step 7~10 |
| `publicId` 추출 함수 단위 테스트 | Task 2 Step 2~6 |
