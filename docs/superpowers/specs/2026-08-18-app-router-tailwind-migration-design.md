# App Router · Tailwind · shadcn/ui 마이그레이션 설계

- 작성일: 2026-08-18
- 대상: `my-place` (사진 EXIF 기반 장소 기록 웹앱)
- 상태: 승인됨

## 1. 목표

Next.js 12 Pages Router 기반 앱을 Next.js 16 App Router로 옮기고, styled-components를 제거해 Tailwind CSS 4 + shadcn/ui로 대체한다. 그 과정에서 GraphQL 데이터 계층을 서버 컴포넌트와 서버 액션으로 교체한다.

### 비목표

- 인증 구현. 현재 인증은 동작하지 않는 상태이며(아래 4절), 이번 작업은 그 상태를 **더 정리된 형태로 보존**할 뿐 고치지 않는다.
- 새 기능 추가.
- Prisma 7로의 상향. 6까지만 올린다(6절).

## 2. 배경: 왜 데이터 계층까지 건드리는가

요청은 App Router와 Tailwind였으나 의존성 사슬이 GraphQL 스택을 스코프로 끌어들인다.

- `apollo-server-micro`(Apollo Server 3, 지원 종료)는 App Router Route Handler에서 동작하지 않는다. 대체재는 `@apollo/server` 5 + `@as-integrations/next` 4다.
- `@apollo/server` 5는 `graphql ^16.11`을 요구한다.
- 현재 사용 중인 `type-graphql` 안정 버전 1.1.1은 `graphql ^15`에 묶여 있다. graphql 16을 지원하는 것은 `2.0.0-rc.3`으로, 안정 릴리스가 없는 RC다.

즉 GraphQL 스택을 그대로 둔 채 App Router로 옮기는 경로는 존재하지 않는다.

동시에, 현재 앱에서 GraphQL은 값을 하지 못하고 있다. 스키마에는 쿼리 4개와 뮤테이션 4개가 있으나 클라이언트가 실제로 호출하는 것은 읽기 2개와 쓰기 2개뿐이다.

| 오퍼레이션 | 클라이언트 사용 |
| --- | --- |
| `allPlaces` | 사용 (홈) |
| `places(bounds)` | 사용 (지도) |
| `createImageSignature`, `createPlace` | 사용 (등록) |
| `updatePlace` | `pages/create.tsx:68`에서 구조분해만 하고 호출하지 않음 |
| `place(id)`, `deletePlace`, `nearby`, `hello` | 호출하는 코드 없음 |

테이블 하나(`places`)에 대한 CRUD를 단일 웹 클라이언트가 쓰는 구조로, GraphQL의 이점(다중 클라이언트, 오버페칭 제어, 스키마 협상)이 하나도 해당되지 않는다. `apollo client:codegen` 스크립트는 존재하나 `src/generated`가 없어 실행된 적이 없고, 그 결과 `pages/index.tsx:11-17`처럼 쿼리 결과 타입을 손으로 적고 있다.

결정적으로, Apollo Client는 리액트 컨텍스트와 훅이라 `"use client"`를 요구한다. `ApolloProvider`를 루트에 두면 데이터를 쓰는 페이지가 전부 클라이언트 컴포넌트가 되어 App Router로 옮기는 주된 이유가 사라진다.

따라서 GraphQL을 제거하고 서버 컴포넌트 + 서버 액션으로 간다.

## 3. 아키텍처

```text
app/page.tsx          (서버 컴포넌트)   ──► lib/places.ts ──► Prisma ──► Postgres
app/map/page.tsx      (서버: 초기 데이터) ──► MapView("use client")
                                              └─ 팬/줌 ──► GET /api/places?sw=&ne=
app/create/page.tsx   ("use client" 폼)  ──► createPlaceAction     (서버 액션)
                                          └─ createUploadSignature (서버 액션) ──► Cloudinary 직접 업로드
```

호출 방식을 셋으로 나눈 근거:

- **홈은 순수 서버 컴포넌트.** 현재는 빈 화면 → JS 로드 → `/api/graphql` 왕복 후에야 카드가 보인다. 첫 HTML에 카드가 담겨 나가도록 한다. 이것이 App Router 이전의 실질적 이득이다.
- **지도의 bounds 재조회는 Route Handler(GET).** 서버 액션은 POST 전용이며 순차 실행되므로 팬/줌마다 호출하기에 부적합하다. 읽기는 GET이 적절하고 캐시도 가능하다. 기존 1초 디바운스와 `useLastData`(재조회 중 이전 데이터 유지) 동작은 유지한다.
- **쓰기는 서버 액션.** Cloudinary 서명 발급도 서버 액션으로 옮겨 `CLOUDINARY_SECRET`이 서버에만 머무는 현재 구조를 유지한다.

`nearby`(반경 10km 조회)와 `deletePlace`는 호출하는 코드가 없으므로 이번 이전 대상에서 제외한다. 필요해지면 서버 액션 하나로 되살리는 편이 GraphQL 필드로 유지하는 것보다 비용이 낮다.

## 4. 인증 취급

현재 인증은 다음 상태다.

- `pages/api/graphql.ts:16`에서 Firebase Admin 토큰 검증이 주석 처리되고 `uid`가 `"1"`로 하드코딩되어 있다.
- 참조하던 `src/auth/firebaseAdmin` 파일이 저장소에 없고, `firebase-admin` 패키지도 설치되어 있지 않다.
- `src/auth/useAuth.tsx`의 `login()`이 고정된 이메일/비밀번호로 로그인한다.
- 로그인 성공 시 `/api/login`으로 토큰 쿠키를 심는 연결이 끊겨 있다.

이번 작업에서 인증을 구현하지 않는다. 프레임워크·라우터·스타일링·데이터 계층 네 가지가 동시에 바뀌는 상황에 인증까지 얹으면 회귀 원인 판별이 어려워진다.

대신 `src/lib/auth.ts`에 서버 전용 `getCurrentUserId()` 하나를 두고 모든 쓰기 경로가 이를 통과하게 한다. 구현은 현재와 동일하게 고정값을 반환하되, 함수 주석과 README에 미구현임을 명시한다. 지금은 하드코딩이 리졸버 컨텍스트에 묻혀 있으므로 이 정리 자체가 개선이다.

클라이언트 Firebase 코드(`src/auth/useAuth.tsx`, `initFirebase.ts`, `tokenCookies.ts`)와 `firebase` 의존성은 그대로 둔다. 나중에 붙일 때 재작성하지 않기 위해서다.

## 5. 파일 구조

```text
app/
  layout.tsx           루트 레이아웃 (Header, ViewTransition, globals.css)
  globals.css          Tailwind 4 @import + shadcn CSS 변수
  page.tsx             홈
  map/page.tsx         지도
  create/page.tsx      등록
  api/places/route.ts  bounds 조회
  error.tsx  loading.tsx  not-found.tsx
src/
  components/ui/       shadcn 생성물
  components/          Header, MapView, PlaceForm, StarRating, CategoryPicker, PlaceCard
  lib/                 prisma.ts, places.ts, cloudinary.ts, auth.ts, utils.ts(cn)
  actions/             place.ts (createPlaceAction, createUploadSignature)
  schemas/             place.ts (Zod)
  hooks/               useLocalState, useLastData (기존 src/utils/ 에서 이전)
  auth/                (기존 Firebase 클라이언트 코드 유지)
```

`tsconfig.json`에 `@/*` → `./src/*` 별칭을 추가한다(shadcn 요구사항).

삭제 대상: `pages/`, `src/schema/`, `src/apollo.ts`, `src/styles/`, `src/components/pageTransitions.tsx`, `src/components/spiner.tsx`, `schema.gql`, `styled.d.ts`, `package.json`의 `codegen` 스크립트.

`env.d.ts`는 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 하나만 선언하고 있으나 이 변수를 읽는 코드가 없다(Google Places 관련 의존성 3개와 함께 미사용). 실제로 쓰이는 환경 변수 전체를 선언하도록 다시 쓴다.

## 6. 의존성 변화

### 제거 (17개)

| 패키지 | 사유 |
| --- | --- |
| `@apollo/client`, `apollo-server-micro`, `type-graphql`, `graphql`, `micro`, `micro-cors` | GraphQL 스택 제거 |
| `class-validator`, `reflect-metadata` | Zod로 대체 |
| `styled-components` | Tailwind로 대체 |
| `react-transition-group` | View Transitions로 대체 |
| `@reach/combobox`, `use-places-autocomplete`, `react-google-autocomplete`, `next-cloudinary` | 코드에서 사용되지 않음 |
| `geolib` | `nearby` 리졸버 전용. `nearby`가 이전 대상이 아니므로 미사용이 된다 |
| `cookie`, `@types/cookie` | `pages/api/login.ts`·`logout.ts` 전용. App Router에서는 `next/headers`의 `cookies()`를 쓴다 |

총 17개가 제거된다. 이 중 4개(`@reach/combobox`, `use-places-autocomplete`, `react-google-autocomplete`, `next-cloudinary`)는 애초에 쓰이지 않던 것이고, 3개(`geolib`, `cookie`, `@types/cookie`)는 이번에 삭제되는 코드에서만 쓰였다. `js-cookie`는 유지되는 `src/auth/tokenCookies.ts`가 쓰므로 남긴다.

### 추가

`zod`, `@hookform/resolvers`, `tailwindcss@4`, `@tailwindcss/postcss`, shadcn 관련(`@base-ui/react`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `sonner`, `tw-animate-css`, `next-themes`).

shadcn의 현재 기본 스타일은 `base-nova`이고 그 프리미티브는 Radix가 아니라 `@base-ui/react`다. 또한 shadcn은 react-hook-form 전용 `Form` 컴포넌트를 폐기하고 `Field`로 대체했으므로, 폼은 `Field` + react-hook-form `Controller`로 배선한다.

### 상향

| 패키지 | 현재 | 목표 |
| --- | --- | --- |
| `next` | 12.3 | 16.3 |
| `react` / `react-dom` | 18.2 | 19.2 |
| `react-map-gl` | 7.0 | 8.1 |
| `mapbox-gl` | 2.11 | 3.28 |
| `use-debounce` | 8.0 | 10.x |
| `firebase` | 9.13 | 12.x |
| `prisma` / `@prisma/client` | 4.5 | 6.19 |

`mapbox-gl` 상향은 선택이 아니다. `react-map-gl` 8이 `mapbox-gl >= 3.5.0`을 peer로 요구한다. `use-debounce`도 React 19 지원을 위해 10.x로 올린다.

Prisma를 7이 아닌 6으로 잡은 것은 의도적이다. 7은 제너레이터가 `prisma-client`로 바뀌고 ESM 출력에 `output` 명시가 강제되는 큰 변경으로, 네 가지가 동시에 바뀌는 이번 작업에 얹을 위험이 아니다. 6도 4 대비 충분한 현대화다.

### 부수 효과

미사용 4개를 제거하면 `@reach/combobox`가 사라지므로, npm 전환 시 추가한 `.npmrc`의 `legacy-peer-deps` 설정도 제거 가능해진다. 구현 중 `npm install`이 플래그 없이 성공하는지 확인하고, 성공하면 `.npmrc`를 삭제한다.

## 7. 스타일링

### 제거되는 죽은 코드

- `src/styles/sharedstyles.tsx`의 styled 컴포넌트 5개 — 어디서도 import되지 않는다.
- `src/styles/globalstyles.tsx:12-19`의 CSS 변수 6개 — `var()` 참조가 0건이며, 값이 `#{hsl(223,10%,90%)}` 형태의 SCSS 보간 문법이라 유효한 CSS 선언도 아니다.
- `ThemeProvider` — 실질적으로 `color: theme.colors.primary` 한 줄을 위해 존재한다.

살아 있는 styled 정의는 21개다.

### shadcn 매핑

| 현재 | 이후 |
| --- | --- |
| `styled.button` 제출 버튼 | shadcn Button |
| `styled.input` 설명 입력 | shadcn Input / Textarea |
| react-hook-form 수동 배선 | shadcn Field + react-hook-form `Controller` + zodResolver |
| 홈 티켓 카드 | shadcn Card 기반 재구성 |
| `alert("사진에 정보가 없습니다")` | Sonner 토스트 |
| `src/components/spiner.tsx` | Skeleton / Button disabled 상태 |
| `src/components/category.tsx` (SVG 4종) | ToggleGroup + 기존 SVG 아이콘 유지 |
| `src/components/starRating.tsx` | shadcn에 해당 컴포넌트가 없어 커스텀 유지, Tailwind로 재작성 |

shadcn 채택은 시각적 결과가 현재와 달라짐을 의미한다(중립 팔레트, 일관된 라운딩과 포커스 링). 이는 승인된 결정이다.

### 페이지 전환

`pages/_app.tsx:22`의 `router.events`는 App Router에 존재하지 않는 API다. 이에 의존하는 `pageTransitions.tsx`의 와이프 연출(스크롤 오프셋만큼 이전 페이지를 밀어 올리며 회색 막이 1초간 덮음)은 그대로 옮길 수 없다. App Router의 `template.tsx`는 언마운트 시점을 제어할 수 없어 exit 애니메이션 자체가 불가능하다.

React의 `<ViewTransition>`(App Router에 네이티브 통합)으로 은은한 크로스페이드를 구성한다. 의존성이 추가되지 않으며, 미지원 브라우저에서는 애니메이션 없이 정상 동작한다. 기존의 회색 와이프는 재현하지 않는다.

## 8. 이미지 처리

`next.config.js`의 `images.loader: "cloudinary"`는 Next 13에서 제거된 설정이다. `loader: "custom"` + `loaderFile`로 Cloudinary URL을 구성하는 커스텀 로더를 작성한다. `next-cloudinary`는 사용되지 않으므로 도입하지 않고 제거한다.

`next/image`의 `layout`, `objectFit` prop은 Next 13에서 제거되었으므로 `pages/create.tsx`와 `pages/map.tsx`의 해당 사용처를 className 기반으로 바꾼다.

`Place.publicId`(Cloudinary URL의 마지막 세그먼트)를 계산하던 GraphQL 필드는 `src/lib/places.ts`의 순수 함수로 옮긴다.

## 9. 검증과 오류 처리

- 서버 액션은 예외를 던지지 않고 `{ ok: false, error }`를 반환해 폼에서 필드 단위로 표시한다.
- `src/schemas/place.ts`의 Zod 스키마 하나를 클라이언트 폼 검증과 서버 액션 검증이 공유한다. 현재는 `class-validator` 데코레이터가 서버에만 있고 클라이언트 검증이 없다.
- 좌표 범위 제약(위도 -90~90, 경도 -180~180)은 기존 `class-validator`의 `@Min`/`@Max`와 동일하게 유지한다.
- EXIF에 GPS가 없는 사진은 현재처럼 거부하되 `alert` 대신 토스트로 안내한다.
- `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx`를 둔다.

### 함께 해결되는 기존 버그

`lottie-web`이 import 시점에 `document`에 접근하는데 `pages/create.tsx:3`이 최상위 정적 import를 하고 있어, 현재 `/create`는 dev에서 500이고 `npm run build`는 "Failed to collect page data for /create"로 실패한다. 등록 폼이 `"use client"`가 되고 lottie를 `useEffect` 안에서 동적 import 하면 서버에서 `document` 접근이 일어나지 않아 해소된다.

## 10. 테스트와 완료 기준

테스트 코드가 전무한 프로젝트이므로 이번에 테스트 체계를 세우는 것은 스코프 밖이다. 다음 범위로 한정한다.

### 단위 테스트 (Vitest)

- `src/schemas/place.ts`의 Zod 스키마: 좌표 경계값, 필수 필드 누락, 타입 강제
- `src/lib/places.ts`의 `publicId` 추출 함수

### 실행 검증

1. `npm run build` 통과 — 현재는 lottie 문제로 실패하므로 그 자체가 회귀 지표다
2. `/`, `/map`, `/create` 모두 200 응답
3. 홈이 JS 비활성 상태에서도 카드를 렌더(서버 컴포넌트 확인)
4. 사진 업로드 → EXIF 위치 인식 → 저장 → 홈과 지도에 반영까지 수동 1회
5. `npm install`이 `--legacy-peer-deps` 없이 성공

## 11. 작업 순서

브랜치 `feat/app-router-tailwind`에서 단계별 커밋으로 진행한다.

1. 의존성 정리 (제거·추가·상향)
2. App Router 스캐폴딩 (`app/layout.tsx`, `globals.css`, Tailwind 4, shadcn init)
3. 데이터 계층 (`lib/prisma.ts`, `lib/places.ts`, `schemas/`, `actions/`, `lib/auth.ts`)
4. 라우트 이전: 홈 → 지도 → 등록
5. 공용 컴포넌트 (Header, StarRating, CategoryPicker)
6. View Transitions
7. 삭제 정리 (`pages/`, `src/schema/`, `src/styles/`, `schema.gql`)
8. README 갱신

## 12. 위험 요소

| 위험 | 대응 |
| --- | --- |
| Cloudinary 로더 재구성으로 기존 이미지 URL이 깨질 수 있음 | 커스텀 로더 작성 후 홈·지도에서 실제 이미지 렌더 확인 |
| `react-map-gl` v8의 import 경로 변경(`react-map-gl/mapbox`), `mapbox-gl` v2→v3 상향, 중심·줌을 `e.viewState`에서 읽도록 하는 API 변경 | 지도 팬/줌·마커·팝업을 수동 검증 |
| Prisma 4→6 상향 시 생성 클라이언트 타입 변화 | `prisma generate` 후 타입 체크 통과 확인 |
| React 19 + Firebase 클라이언트 코드 호환 | `"use client"` 경계 확인, 로그인 미구현이라 표면 좁음 |
| shadcn 도입으로 시각적 결과가 달라짐 | 승인된 결정. 티켓 카드 등 특징적 요소는 형태를 유지하도록 재구성 |
| 인증이 여전히 스텁 | `getCurrentUserId()` 한 곳에 격리, README에 명시 |
