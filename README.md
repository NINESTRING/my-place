# my-place

사진 한 장으로 "내가 다녀온 장소"를 기록하고 지도 위에 모아 보는 개인 장소 기록 웹앱입니다.

업로드한 사진의 **EXIF 메타데이터에서 촬영 위치(GPS)와 촬영 시각을 자동으로 추출**해 지도에 핀을 꽂아 주기 때문에, 사용자가 직접 주소를 입력할 필요가 없는 것이 핵심 아이디어입니다.

> 개인 사이드 프로젝트이며 현재 개발 진행 중입니다. 인증 등 일부 기능이 미완성 상태입니다([미완성 / 알려진 이슈](#미완성--알려진-이슈) 참고).

## 주요 기능

화면은 `/` 한 페이지뿐입니다. MapLibre 지도가 뷰포트를 가득 채우고, 지도를
떠나지 않은 채로 등록과 목록을 오버레이로 처리합니다.

| 요소 | 조작 | 설명 |
| --- | --- | --- |
| 지도 | — | 화면에 보이는 영역(bounds) 안의 장소만 조회해 마커로 표시, 마커 클릭 시 사진 팝업 |
| 등록 | 오른쪽 위 `MapPinPlus` 아이콘 | 모달로 등록 폼을 띄운다. 사진 업로드 → EXIF 파싱 → 폼 안 지도에 촬영 위치 표시 → 제목·설명(선택)·카테고리(선택) 입력 후 저장. 저장하면 모달이 닫히고 지도가 그 좌표로 날아간다 |
| 목록 | 오른쪽 위 `List` 아이콘 | 왼쪽에서 패널이 밀려 들어온다. **지도를 다 덮지 않으며**(`w-[min(22rem,82vw)]`) 열려 있는 동안에도 지도를 그대로 조작할 수 있다. 카드를 누르면 그 장소로 이동한다. 카드 사진 오른쪽 위 `⋮` 로 수정·삭제할 수 있다 |

- **지도와 목록이 같은 조회를 공유** — 목록에 나오는 것은 "지금 지도에 보이는
  장소"이며, 마커와 같은 `getPlacesInBounds` 결과입니다. 지도를 옮기면 목록도
  따라 바뀝니다.
- **EXIF 기반 자동 위치 인식** — `exifr`로 사진에서 위경도·촬영일시를 읽고, 정보가 없는 사진은 등록을 거부합니다.
- **뷰포트 기반 조회** — 지도를 움직이면 현재 bounds를 디바운스(`use-debounce`) 후 `GET /api/places`로 재조회합니다. 지도 위치/영역은 localStorage에 저장되어 새로고침해도 유지됩니다.
- **이미지 업로드** — 서버 액션(`createUploadUrlAction`)이 Supabase Storage 서명 업로드 URL을 발급하고, 브라우저가 그 URL로 직접 올립니다. 브라우저에 Supabase 키가 나가지 않습니다.
- **카테고리 선택** — `ToggleGroup` 기반 5지선다(카페·식당·숙소·명소·풍경)이며 선택 사항입니다. 같은 항목을 다시 누르면 해제됩니다. 값은 Prisma enum `PlaceCategory` 이고 미선택은 `null` 입니다.
- **수정·삭제** — 목록 카드의 `⋮` 메뉴에서 제목·설명·카테고리를 고치거나 장소를 지웁니다. 사진과 촬영 위치는 EXIF에서 온 값이라 수정 대상이 아니며, 삭제하면 Storage의 사진도 함께 지워집니다.
- **업로드 영역 Lottie 애니메이션** — 페이지 전환 애니메이션은 없습니다(아래 기술 스택의 안내 참고).

## 기술 스택

- **프레임워크**: Next.js 16 (App Router), React 19, TypeScript
- **스타일**: Tailwind CSS 4 + shadcn/ui (`shadcn`은 devDependency이며,
  `app/globals.css`가 `shadcn/tailwind.css`를 import해 생성된 컴포넌트가
  쓰는 커스텀 variant를 공급받는다)
- **데이터**: 서버 컴포넌트가 Prisma를 직접 호출. 쓰기는 서버 액션,
  지도 bounds 재조회는 Route Handler(GET)
- **검증**: Zod (클라이언트 폼과 서버 액션이 스키마 공유)
- **DB / ORM**: PostgreSQL (Supabase) + Prisma 7 (`prisma-client` 제너레이터 +
  `@prisma/adapter-pg` 드라이버 어댑터. 클라이언트는 `node_modules`가 아니라
  `src/generated/prisma`로 생성되며 git에는 올라가지 않습니다)
- **지도**: MapLibre GL 6 (`react-map-gl` 8) + OpenFreeMap 타일
  (워커 청크를 `public/maplibre`로 복사해 `setWorkerUrl`로 지정합니다 —
  아래 알려진 이슈 참고)
- **이미지**: Supabase Storage (public 버킷) + next/image 내장 최적화
- **인증**: 미구현. 벤더는 Supabase Auth로 확정했습니다. `src/lib/auth.ts`의 `getCurrentUserId()`가 고정값 `"1"`을 반환하는 스텁입니다.
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
브라우저 — / 한 페이지
 ├─ 서버 컴포넌트   초기 bounds 장소 ──► Prisma ──► PostgreSQL
 ├─ PlaceExplorer   지도 + 조작 버튼 + 목록 패널 + 등록 모달 (클라이언트)
 │   ├─ 팬/줌 ──► GET /api/places?swLat&swLng&neLat&neLng
 │   ├─ 목록 패널   같은 조회 결과를 카드로 (클릭 ──► flyTo)
 │   └─ 등록 모달   폼 ──► 서버 액션 createPlaceAction ──► Prisma
 │                       └─ createUploadUrlAction ──► Supabase Storage 직접 업로드
 └─ 이미지          next/image + Supabase Storage
```

한 페이지로 합치면서 저장 후 이동할 페이지가 없어졌다. `PlaceForm`은
`router.push` 대신 `onCreated(좌표)` 콜백을 부르고, `PlaceExplorer`가 모달을
닫고 그 좌표로 `flyTo` 한다. 이때 장소 목록은 RSC가 아니라 `/api/places`로
가져오므로 `router.refresh()`로는 갱신되지 않는다 — bounds가 그대로일 때도
재조회가 걸리도록 `reloadToken`을 올린다.

옛 `/map`·`/create` 경로는 `next.config.ts`의 `redirects()`가 `/`로 308
리다이렉트한다.

읽기는 서버 컴포넌트가 Prisma를 직접 호출한다. 지도의 bounds 재조회만
Route Handler(GET)를 쓰는데, 서버 액션은 POST 전용이고 순차 실행되어
팬/줌마다 호출하기에 맞지 않기 때문이다. 쓰기는 서버 액션이 담당하며
`SUPABASE_SECRET_KEY`는 서버에만 머문다.

`src/schemas/place.ts`의 Zod 스키마 하나를 클라이언트 폼 검증과 서버 액션
검증이 공유한다.

### 데이터 모델

`places` 테이블 (Prisma `Place`) — `userId`(인덱스), `image`, `imageCreationTime`, `latitude`, `longitude`, `title`, `description`(nullable), `category`(`PlaceCategory` enum, nullable), `createdAt`, `updatedAt`.

## 디렉터리 구조

```text
app/
  layout.tsx           루트 레이아웃 (전역 헤더 없음 — 지도가 화면을 채운다)
  globals.css          Tailwind 4 + shadcn 테마
  page.tsx             유일한 화면 (force-dynamic)
  api/places/route.ts  bounds 기반 장소 조회
  error.tsx  loading.tsx  not-found.tsx
src/
  actions/     서버 액션 (createPlaceAction, createUploadUrlAction)
  schemas/     Zod 스키마 (폼·서버 액션 공용)
  lib/         prisma, places(순수 헬퍼), places.server(DB 조회), images,
               supabase, auth, categories, utils(cn)
  components/  PlaceExplorer(화면 전체), PlaceListPanel, CreatePlaceDialog,
               PlaceCard, PlaceForm, CategoryPicker
  components/ui/  shadcn 생성물 (Field 기반 폼 프리미티브 포함, form.tsx 없음)
  hooks/       useLocalState, useLastData
  assets/      Lottie 애니메이션 JSON
  generated/   Prisma Client 생성물 (gitignore)
prisma/schema.prisma
prisma.config.ts       Prisma 7 CLI 설정 (스키마 경로·DATABASE_URL)
scripts/               maplibre 워커 청크 복사, dev-doctor
public/maplibre/       maplibre 워커 청크 복사본 (gitignore)
```

## 시작하기

### 요구 사항

- Node.js 20.19+ (Prisma 7 요구 사항)
- PostgreSQL 데이터베이스
- Supabase 프로젝트 (Storage 버킷 `places` 포함)

### 환경 변수

프로젝트 루트에 `.env` 파일을 만듭니다.

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/myplace"

NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

Supabase 프로젝트에는 `supabase/migrations/`의 SQL도 적용해야 합니다. Storage
버킷 `places` 생성과 `public.places`의 RLS 활성화를 담고 있습니다.

### 설치 및 실행

```bash
npm install            # postinstall이 prisma generate와 maplibre 워커 복사를 실행

npx prisma db push     # 스키마를 DB에 반영

npm run dev            # http://localhost:3000
```

제목·카테고리 개편(별점 컬럼 삭제, `title` NOT NULL 추가, `category`를
정수에서 enum으로 변경) 당시 `places`는 빈 테이블이어서 데이터 마이그레이션이
없습니다. 이미 행이 있는 DB에 적용하려면 이 세 컬럼은 손으로 마이그레이션을
작성해야 합니다.

`src/generated/prisma`(Prisma Client)와 `public/maplibre`(maplibre 워커 청크)는
둘 다 생성물이라 git에 없습니다. `npm install`의 postinstall이 만들고,
`predev`·`prebuild`가 워커 복사본을 다시 맞춥니다. 스키마를 고친 뒤에는
`npx prisma generate`를 직접 실행하세요.

### 그 외 스크립트

```bash
npm run build       # 프로덕션 빌드
npm start           # 프로덕션 서버 실행
npm test            # Vitest 단위 테스트
npm run test:watch  # Vitest 단위 테스트(watch 모드)
```

## 미완성 / 알려진 이슈

- **인증이 구현되어 있지 않습니다.** 모든 쓰기 경로는
  `src/lib/auth.ts`의 `getCurrentUserId()`를 통과하며, 이 함수는 고정값
  `"1"`을 반환합니다. 인증 벤더는 Supabase Auth로 확정했습니다.
  **다만 이 함수 하나만 바꾸면 끝나는 것은 아닙니다** — 발급된 서명 업로드
  URL의 경로와 `createPlaceAction`에 제출된 경로가 바인딩되지 않아, 인증이
  붙는 순간 다른 사용자의 이미지를 자기 행에 붙일 수 있게 됩니다. 자세한
  내용은 `src/actions/place.ts` 상단 주석에 있습니다.
- 장소 카드가 shadcn Card 기반으로 재구성되면서, 이전의 티켓 절취선 디자인은
  더 이상 재현하지 않습니다.
- 목록 패널은 지도를 가리지 않는 것이 목적이라 백드롭도 포커스 트랩도 없는
  일반 `<aside>`입니다. 닫힘 상태에서는 화면 밖으로 밀려나 있을 뿐 DOM에
  남으므로 `inert`로 탭 순서에서 제외합니다. 스와이프로 닫는 제스처는 없습니다.
- 테스트는 Zod 스키마와 순수 함수에 대한 Vitest 단위 테스트만 있습니다.
  컴포넌트 테스트와 E2E 테스트는 없습니다.
- `place(id)` 단건 조회, 반경 10km `nearby` 조회, 장소 삭제 기능은 이전
  GraphQL 스키마에 정의되어 있었으나 호출하는 화면이 없어 이전 대상에서
  제외했습니다.
- **HEIC 미지원** — 파일 선택이 JPEG·PNG·WebP로 제한됩니다. Next.js 내장 이미지 최적화가 HEIC 출력을 지원하지 않기 때문입니다.
- **OpenFreeMap 타일은 SLA가 없습니다.** 기부로 운영되는 무료 서비스입니다. 안정성이 필요해지면 `mapStyle` URL만 다른 제공자로 바꾸면 됩니다.
- **`maplibre-gl` 6의 워커는 URL을 직접 지정해 줘야 합니다.** 6.x는 워커를
  별도 청크로 내보내고 그 URL을 자기 모듈의 `import.meta.url`에서 유도하는데,
  그 값이 `http(s)` URL이 아니면 빈 문자열을 반환합니다. Turbopack이 번들한
  청크에서는 `http` URL이 아니므로 워커 URL이 `""`가 되어 현재 문서 경로로
  해석되고, 워커는 만들어지되 아무 일도 하지 못합니다. 타일 fetch와 파싱이
  전부 워커에서 일어나기 때문에 스타일·스프라이트·글리프만 로드된 채 지도가
  비어 보이며, **예외가 발생하지 않아 단위 테스트·타입 체크·빌드가 모두
  통과합니다.**

  그래서 `scripts/copy-maplibre-worker.mjs`가 `maplibre-gl-worker.mjs`와 그것이
  상대 경로로 import하는 `maplibre-gl-shared.mjs`를 `public/maplibre`로
  복사하고, `src/components/place-explorer.tsx`가 모듈 최상단에서
  `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")`로 그 경로를 지정합니다.
  `src/lib/deps.test.ts`가 복사본이 없거나 낡은 경우를 잡습니다. 워커가
  살아 있는지는 **브라우저에서 벡터 타일 요청이 실제로 나가는지**로만 확인할
  수 있습니다 — 워커 안에서 나가는 요청이라 DevTools에서는 워커 컨텍스트를
  봐야 보입니다.
- 워커에 넘기는 `maplibre-gl-shared.mjs`는 메인 번들에 들어간 것과 같은 코드를
  한 번 더 받습니다(약 470KB). 워커 URL을 문자열로만 지정할 수 있는 6.x의
  제약이라 지금은 감수하고 있습니다.
