# my-place

사진 한 장으로 "내가 다녀온 장소"를 기록하고 지도 위에 모아 보는 개인 장소 기록 웹앱입니다.

업로드한 사진의 **EXIF 메타데이터에서 촬영 위치(GPS)와 촬영 시각을 자동으로 추출**해 지도에 핀을 꽂아 주기 때문에, 사용자가 직접 주소를 입력할 필요가 없는 것이 핵심 아이디어입니다.

> 개인 사이드 프로젝트이며 현재 개발 진행 중입니다. 인증 등 일부 기능이 미완성 상태입니다([미완성 / 알려진 이슈](#미완성--알려진-이슈) 참고).

## 주요 기능

| 페이지 | 경로 | 설명 |
| --- | --- | --- |
| 홈 | `/` | 등록된 모든 장소를 shadcn `Card` 기반 사진 카드로 나열 |
| 등록 | `/create` | 사진 업로드 → EXIF 파싱 → 지도 자동 이동 → 설명/별점/카테고리 입력 후 저장 |
| 지도 | `/map` | Mapbox 지도. 화면에 보이는 영역(bounds) 안의 장소만 조회해 마커로 표시, 마커 클릭 시 사진 팝업 |

- **EXIF 기반 자동 위치 인식** — `exifr`로 사진에서 위경도·촬영일시를 읽고, 정보가 없는 사진은 등록을 거부합니다.
- **뷰포트 기반 조회** — 지도를 움직이면 현재 bounds를 디바운스(`use-debounce`) 후 `GET /api/places`로 재조회합니다. 지도 위치/영역은 localStorage에 저장되어 새로고침해도 유지됩니다.
- **이미지 CDN 업로드** — 서버 액션(`createUploadSignature`)이 Cloudinary 업로드 서명을 발급하고, 브라우저가 그 서명으로 Cloudinary에 직접 업로드합니다(시크릿 노출 없음).
- **별점 / 카테고리 선택** — 커스텀 별점 컴포넌트와 shadcn `ToggleGroup` 기반 카테고리 선택.
- **업로드 영역 Lottie 애니메이션** — 페이지 전환 애니메이션은 없습니다(아래 기술 스택의 안내 참고).

## 기술 스택

- **프레임워크**: Next.js 16 (App Router), React 19, TypeScript
- **스타일**: Tailwind CSS 4 + shadcn/ui (`shadcn`은 devDependency이며,
  `app/globals.css`가 `shadcn/tailwind.css`를 import해 생성된 컴포넌트가
  쓰는 커스텀 variant를 공급받는다)
- **데이터**: 서버 컴포넌트가 Prisma를 직접 호출. 쓰기는 서버 액션,
  지도 bounds 재조회는 Route Handler(GET)
- **검증**: Zod (클라이언트 폼과 서버 액션이 스키마 공유)
- **DB / ORM**: PostgreSQL + Prisma 6
- **지도**: Mapbox GL 3 (`react-map-gl` 8)
- **이미지**: Cloudinary (next/image 커스텀 로더)
- **인증**: Firebase Auth 클라이언트 코드만 존재 — 미구현 (아래 참고)
- **테스트**: Vitest
- **기타**: react-hook-form, exifr, lottie-web, use-debounce

> **페이지 전환 애니메이션은 없습니다.** 초기 계획은 View Transitions 기반
> 크로스페이드였지만 구현 시점 기준 `react@19.2.8`는 `ViewTransition`을
> export하지 않고, `next@16.3.1`에도 그 실험적 React 기능에 접근할
> `experimental.viewTransition` 설정이 없어 채택할 수 없었습니다. CSS만으로
> `::view-transition-*`를 정의해도 App Router의 동일 문서 내 네비게이션은 애초에
> 전환을 시작시키지 않으므로 아무 효과가 없는 죽은 코드가 됩니다. 따라서
> 전환 없이 출시하기로 결정했습니다.

> shadcn 스타일은 `base-nova`이며 primitives가 Radix가 아니라 `@base-ui/react`
> 입니다. 그 결과 `Button`은 `asChild` 대신 `render` prop을 쓰고,
> `ToggleGroup`은 배열 값을 받으며 `type` prop이 없습니다.

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

### 데이터 모델

`places` 테이블 (Prisma `Place`) — `userId`(인덱스), `image`, `imageCreationTime`, `latitude`, `longitude`, `description`, `rating`, `category`, `createdAt`, `updatedAt`.

## 디렉터리 구조

```text
app/
  layout.tsx           루트 레이아웃 (Header)
  globals.css          Tailwind 4 + shadcn 테마 (--header-height 단일 출처 포함)
  page.tsx             홈 (force-dynamic)
  map/page.tsx         지도 (force-dynamic)
  create/page.tsx      등록
  api/places/route.ts  bounds 기반 장소 조회
  error.tsx  loading.tsx  not-found.tsx
src/
  actions/     서버 액션 (createPlaceAction, createUploadSignature)
  schemas/     Zod 스키마 (폼·서버 액션 공용)
  lib/         prisma, places, auth, categories, cloudinary-loader, utils(cn)
  components/  Header, PlaceCard, MapView, PlaceForm, StarRating, CategoryPicker
  components/ui/  shadcn 생성물 (Field 기반 폼 프리미티브 포함, form.tsx 없음)
  hooks/       useLocalState, useLastData
  auth/        Firebase 클라이언트 코드 (미구현 상태로 보존)
  assets/      Lottie 애니메이션 JSON
prisma/schema.prisma
```

## 시작하기

### 요구 사항

- Node.js 20+
- PostgreSQL 데이터베이스
- Mapbox / Cloudinary / Firebase 계정

### 환경 변수

프로젝트 루트에 `.env` 파일을 만듭니다.

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/myplace"

NEXT_PUBLIC_MAPBOX_API_TOKEN=

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_KEY=
CLOUDINARY_SECRET=

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
```

### 설치 및 실행

```bash
npm install

npx prisma generate    # Prisma Client 생성
npx prisma db push     # 스키마를 DB에 반영

npm run dev            # http://localhost:3000
```

### 그 외 스크립트

```bash
npm run build     # 프로덕션 빌드
npm start         # 프로덕션 서버 실행
npm test          # Vitest 단위 테스트
```

## 미완성 / 알려진 이슈

- **인증이 구현되어 있지 않습니다.** 모든 쓰기 경로는
  `src/lib/auth.ts`의 `getCurrentUserId()`를 통과하며, 이 함수는 고정값
  `"1"`을 반환합니다. 인증을 붙일 때 이 함수 하나만 실제 구현으로 바꾸면
  됩니다. 클라이언트 Firebase 코드(`src/auth/`)는 남아 있으나 로그인 폼과
  세션 검증이 없고, `tokenCookies.ts`가 요청하는 `/api/login`·`/api/logout`
  라우트는 존재하지 않습니다.
- 홈 카드가 shadcn Card 기반으로 재구성되면서, 이전의 티켓 절취선 디자인은
  더 이상 재현하지 않습니다.
- 테스트는 Zod 스키마와 순수 함수에 대한 Vitest 단위 테스트만 있습니다.
  컴포넌트 테스트와 E2E 테스트는 없습니다.
- `place(id)` 단건 조회, 반경 10km `nearby` 조회, 장소 삭제 기능은 이전
  GraphQL 스키마에 정의되어 있었으나 호출하는 화면이 없어 이전 대상에서
  제외했습니다.
