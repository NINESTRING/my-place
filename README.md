# my-place

사진 한 장으로 "내가 다녀온 장소"를 기록하고 지도 위에 모아 보는 개인 장소 기록 웹앱입니다.

업로드한 사진의 **EXIF 메타데이터에서 촬영 위치(GPS)와 촬영 시각을 자동으로 추출**해 지도에 핀을 꽂아 주기 때문에, 사용자가 직접 주소를 입력할 필요가 없는 것이 핵심 아이디어입니다.

> 개인 사이드 프로젝트이며 현재 개발 진행 중입니다. 인증 등 일부 기능이 미완성 상태입니다([미완성 / 알려진 이슈](#미완성--알려진-이슈) 참고).

## 주요 기능

| 페이지 | 경로 | 설명 |
| --- | --- | --- |
| 홈 | `/` | 등록된 모든 장소를 사진 카드 형태(티켓 모양 디자인)로 나열 |
| 등록 | `/create` | 사진 업로드 → EXIF 파싱 → 지도 자동 이동 → 설명/별점/카테고리 입력 후 저장 |
| 지도 | `/map` | Mapbox 지도. 화면에 보이는 영역(bounds) 안의 장소만 조회해 마커로 표시, 마커 클릭 시 사진 팝업 |

- **EXIF 기반 자동 위치 인식** — `exifr`로 사진에서 위경도·촬영일시를 읽고, 정보가 없는 사진은 등록을 거부합니다.
- **뷰포트 기반 조회** — 지도를 움직이면 현재 bounds를 1초 디바운스 후 GraphQL로 질의합니다. 지도 위치/영역은 localStorage에 저장되어 새로고침해도 유지됩니다.
- **주변 장소 조회** — `Place.nearby` 필드에서 `geolib`로 반경 10km 범위를 계산해 인접 장소를 반환합니다.
- **이미지 CDN 업로드** — 서버에서 Cloudinary 업로드 서명을 발급받아 브라우저가 직접 Cloudinary로 업로드합니다(시크릿 노출 없음).
- **별점 / 카테고리 선택** — 커스텀 SVG 컴포넌트(별 5단계, 카테고리 4종)로 입력합니다.
- **페이지 전환 애니메이션 · Lottie** — `react-transition-group` 기반 전환 효과와 업로드 영역의 Lottie 애니메이션.

## 기술 스택

- **프레임워크**: Next.js 12 (Pages Router), React 18, TypeScript
- **스타일**: styled-components (SSR 컴파일러 옵션 활성화), 전역 스타일 + 테마
- **API**: GraphQL — `apollo-server-micro` + `type-graphql` (코드 퍼스트, 데코레이터 기반)를 `/api/graphql` 단일 라우트에서 서빙
- **클라이언트 데이터**: Apollo Client (`cache-and-network`)
- **DB / ORM**: PostgreSQL + Prisma
- **지도**: Mapbox GL (`react-map-gl`)
- **이미지**: Cloudinary (`next.config.js`의 image loader로 지정)
- **인증**: Firebase Auth (클라이언트) + httpOnly 쿠키 (`/api/login`, `/api/logout`)
- **기타**: react-hook-form, exifr, geolib, lottie-web, use-debounce

## 아키텍처

```
브라우저
 ├─ Apollo Client ──► /api/graphql (apollo-server-micro)
 │                      └─ type-graphql 스키마 ──► Prisma ──► PostgreSQL
 ├─ Firebase Auth ──► /api/login  (ID 토큰을 httpOnly 쿠키로 저장)
 └─ 직접 업로드 ────► Cloudinary  (서버가 발급한 서명 사용)
```

GraphQL 스키마는 `type-graphql`이 개발 모드에서 자동 생성하며(`schema.gql`), Apollo CLI(`npm run codegen`)로 클라이언트 타입을 `src/generated`에 생성할 수 있습니다. **`schema.gql`은 생성 파일이므로 직접 수정하지 마세요.**

### GraphQL API

```graphql
type Query {
  hello: String!
  place(id: String!): Place
  places(bounds: BoundsInput!): [Place!]!   # 지도 영역 내 조회 (최대 50건)
  allPlaces: [Place!]!                       # 전체 조회 (최대 50건)
}

type Mutation {
  createImageSignature: ImageSignature!      # Cloudinary 업로드 서명 (인증 필요)
  createPlace(input: PlaceInput!): Place     # 인증 필요
  updatePlace(id: String!, input: PlaceInput!): Place  # 인증 + 소유자 확인
  deletePlace(id: String!): Boolean!         # 인증 + 소유자 확인
}
```

`Place.publicId`는 Cloudinary URL의 마지막 세그먼트를 잘라 반환하는 계산 필드로, `next/image`의 Cloudinary 로더에 그대로 넘겨 사용합니다.

### 데이터 모델

`places` 테이블 (Prisma `Place`) — `userId`(인덱스), `image`, `imageCreationTime`, `latitude`, `longitude`, `description`, `rating`, `category`, `createdAt`, `updatedAt`.

## 디렉터리 구조

```
pages/
  index.tsx        홈 (전체 장소 목록)
  create.tsx       장소 등록 (사진 업로드 · EXIF · 지도 · 폼)
  map.tsx          지도 탐색
  api/
    graphql.ts     Apollo Server 엔드포인트
    login.ts       토큰을 httpOnly 쿠키로 설정
    logout.ts      쿠키 제거
src/
  schema/          type-graphql 리졸버(place, image), 스키마 빌드, 인증 체커, 컨텍스트
                   schema.ts 는 클라이언트용 gql 쿼리/뮤테이션 모음
  auth/            Firebase 초기화, useAuth 컨텍스트, 토큰 쿠키 헬퍼
  components/      header, category, starRating, spiner, pageTransitions
  utils/           useLocalState(localStorage 동기화), useLastData(직전 데이터 유지)
  styles/          globalstyles, sharedstyles
  assets/          Lottie 애니메이션 JSON
  apollo.ts        Apollo Client 생성
  prisma.ts        PrismaClient 인스턴스
prisma/schema.prisma
schema.gql         (자동 생성)
```

## 시작하기

### 요구 사항

- Node.js 16+
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

> 이 프로젝트는 **npm**을 사용합니다(`package-lock.json`). CI 등 재현 가능한 설치가 필요하면 `npm ci`를 쓰세요.
>
> `@reach/combobox@0.18.0`이 React 16/17만 peer로 허용해 React 18과 충돌하기 때문에, 루트의 `.npmrc`에 `legacy-peer-deps=true`를 설정해 두었습니다. 해당 패키지는 현재 코드에서 사용되지 않으므로, 제거하면 `.npmrc`도 함께 지울 수 있습니다.

### 그 외 스크립트

```bash
npm run build     # 프로덕션 빌드
npm start         # 프로덕션 서버 실행
npm run codegen   # schema.gql 기준으로 클라이언트 타입 생성 → src/generated
```

## 미완성 / 알려진 이슈

현재 코드 기준으로 마무리가 필요한 부분입니다.

- **서버 인증이 비활성화되어 있습니다.** `pages/api/graphql.ts`에서 Firebase Admin으로 ID 토큰을 검증하는 부분이 주석 처리되어 있고 `uid`가 `"1"`로 하드코딩되어 있습니다. 참조하던 `src/auth/firebaseAdmin` 파일도 저장소에 없습니다. 즉 모든 요청이 동일 사용자로 인증된 것처럼 처리되므로, 배포 전 반드시 복구해야 합니다.
- **로그인이 하드코딩되어 있습니다.** `src/auth/useAuth.tsx`의 `login()`이 고정된 이메일/비밀번호로 로그인합니다. 로그인 폼과 회원가입 플로우가 필요합니다.
- **로그인 성공 시 `/api/login`을 호출해 토큰 쿠키를 심는 연결**이 아직 없습니다(`tokenCookies` 헬퍼는 준비되어 있음).
- 홈 카드의 티켓 절취선용 `<li>` 반복 마크업 등 정리할 마크업이 남아 있습니다.
- `use-places-autocomplete`, `react-google-autocomplete`, `@reach/combobox` 등 주소 검색 관련 의존성이 설치되어 있으나 아직 사용되지 않습니다.
- **`/create` 페이지가 서버에서 렌더링되지 않습니다.** `lottie-web`이 import 시점에 `document`에 접근하는데 `pages/create.tsx`에서 최상위 정적 import를 하고 있어, dev에서는 500, `npm run build`는 "Failed to collect page data for /create"로 실패합니다. `next/dynamic`의 `ssr: false`로 불러오거나 `useEffect` 안에서 동적 import 하면 해결됩니다.
- 테스트 코드가 없습니다.
