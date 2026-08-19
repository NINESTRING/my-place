# MapLibre 전환 · 이미지 Supabase Storage 통합 설계

- 작성일: 2026-08-19
- 대상: `my-place` (사진 EXIF 기반 장소 기록 웹앱)
- 상태: 승인됨

## 1. 목표

지도 제공자를 Mapbox에서 MapLibre GL + OpenFreeMap으로 바꾸고, 이미지 저장소를 Cloudinary에서 Supabase Storage로 옮긴다. 결과적으로 외부 벤더 4곳(Mapbox · Cloudinary · Firebase · Supabase)을 Supabase 1곳으로 줄이고, 애플리케이션 시크릿을 5개에서 1개로 줄인다.

### 비목표

- **인증 구현.** Supabase Auth를 인증 벤더로 확정하되 이번 작업에서 구현하지 않는다. `getCurrentUserId()`는 고정값 `"1"` 스텁을 유지한다. 단, 인증 부재 상태에서도 데이터가 노출되지 않도록 RLS는 이번에 처리한다(4절).
- 새 기능 추가.
- 이미지 최적화 품질 향상. Cloudinary 대비 동등하거나 약간 낮은 수준을 수용한다(3절, 8절).

## 2. 배경: 왜 지금 바꾸는가

두 서비스의 사용 표면이 매우 얇다. 지도는 `Map` / `Marker` / `Popup` / `getBounds()` 네 가지뿐이고 지오코딩·검색·경로·커스텀 스타일을 쓰지 않는다. 이미지는 URL 변환 파라미터 4개(`f_auto`, `c_limit`, `w`, `q_auto`)와 서명 직접 업로드뿐이다.

즉 두 벤더 모두 이 프로젝트에 과잉이며, 교체 동기는 비용 절감이 아니라 **락인 제거와 벤더 수 축소**다. 무료 한도는 어느 쪽이든 이 프로젝트 트래픽을 덮는다.

전환 시점이 지금인 이유는 두 가지다.

- **DB가 이미 Supabase에 있다.** `my-place` 프로젝트(ap-northeast-1)의 `public.places`에 데이터가 있다. 통합의 DB 부분은 이미 끝난 상태고 Storage만 남았다.
- **인증이 미구현이다.** Firebase Auth를 실제로 붙이고 나면 벤더 통합 비용이 크게 오른다. 인증 벤더를 Supabase로 확정하기에 가장 싼 시점이 지금이다.

## 3. 아키텍처

### 3.1 지도

`react-map-gl@8.1.2`가 `./mapbox`와 `./maplibre` 두 엔트리를 모두 export하며 컴포넌트 API가 동일하다(`@vis.gl/react-mapbox`, `@vis.gl/react-maplibre` 각 8.1.2). 따라서 전환은 import 경로와 스타일 URL 교체로 끝난다.

```diff
-import "mapbox-gl/dist/mapbox-gl.css"
-import Map, { Marker, Popup } from "react-map-gl/mapbox"
+import "maplibre-gl/dist/maplibre-gl.css"
+import Map, { Marker, Popup } from "react-map-gl/maplibre"

-  mapStyle="mapbox://styles/mapbox/streets-v12"
-  mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_TOKEN}
+  mapStyle="https://tiles.openfreemap.org/styles/liberty"
```

`Marker`의 `color` prop, `Popup`, `e.target.getBounds()`의 `getSouth()`/`getWest()`/`getNorth()`/`getEast()`는 MapLibre에서도 그대로 동작한다.

타일 제공자는 이 설계에서 **문자열 하나**다. OpenFreeMap이 만족스럽지 않으면 `mapStyle` URL만 바꿔 Protomaps 셀프호스팅이나 MapTiler로 옮길 수 있다.

### 3.2 이미지 업로드

현재 Cloudinary 흐름과 구조가 같다. 서버가 자격증명을 발급하고 브라우저가 저장소에 직접 올린다.

```text
서버 액션 (SUPABASE_SECRET_KEY)
  createSignedUploadUrl(path)  ──►  { signedUrl, token, path }
브라우저
  fetch(signedUrl, { method: "PUT", body: file })
서버 액션
  createPlaceAction({ image: path, ... })  ──►  Prisma  ──►  PostgreSQL
```

핵심 성질은 **브라우저에 Supabase API 키를 내보내지 않는다**는 것이다. 서명 URL은 토큰 자체가 인증 수단이라(유효기간 2시간) publishable 키가 필요 없고, `@supabase/supabase-js`를 클라이언트 번들에 넣지 않는다.

파일 경로는 서버가 `crypto.randomUUID()`로 정한다. 클라이언트가 경로를 지정하지 못하므로 다른 사용자의 객체를 덮어쓸 수 없다.

### 3.3 이미지 서빙

Supabase 조직 플랜이 Free이며 **Storage 이미지 변환(`/render/image`)은 Pro 이상에서만 동작한다.** 따라서 현재의 Cloudinary 로더를 Supabase 로더로 1:1 치환하는 경로는 존재하지 않는다. 최적화 주체를 Next.js 내장 Image Optimization으로 옮긴다. `sharp`는 이미 설치되어 있다.

- 버킷 `places`, public read
- `next.config.ts`: `loader: "custom"` / `loaderFile` 제거 → `images.remotePatterns` 추가
- `src/lib/cloudinary-loader.ts` 삭제

**DB `image` 컬럼에 전체 URL이 아니라 storage path를 저장한다.** public 버킷의 공개 URL은 결정적이므로(`${SUPABASE_URL}/storage/v1/object/public/places/${path}`) 렌더링 시 조립하면 된다. 프로젝트 ref가 데이터에 박히지 않아 이식성이 높고, 검증 규칙도 단순해진다.

이 결정으로 코드가 순수하게 줄어든다. Cloudinary secure_url의 마지막 세그먼트를 잘라내던 우회 장치 전체가 사라진다.

| 제거 | 대체 |
| --- | --- |
| `publicIdFromUrl()` | — |
| `PlaceWithPublicId` 타입 | `Place` (Prisma 생성 타입 그대로) |
| `withPublicId()` | — |
| — | `publicImageUrl(path)` (`src/lib/images.ts`) |

`SerializedPlace`도 `PlaceWithPublicId` 대신 `Place`를 기준으로 단순해진다.

## 4. 보안: RLS

인증이 미구현인 상태에서 Storage를 붙이면 데이터 노출 경로가 열릴 수 있다. `public.places`에 RLS를 활성화하되 **정책은 만들지 않는다.**

```sql
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
```

Prisma는 테이블 소유자 롤로 직접 접속하므로 RLS를 우회하고, `anon`/`authenticated` 롤은 접근이 완전히 차단된다. 인증이 없는 현재 상태에 정확히 맞는 설정이다.

이 설정은 이미 적용되었고 실측으로 검증되었다.

- 어드바이저: `rls_disabled` (CRITICAL) → `rls_enabled_no_policy` (INFO)
- RLS 활성 상태에서 Prisma `place.count()`가 4행을 정상 반환

나중에 Supabase Auth를 붙일 때 소유권 기반 정책(`auth.uid() = user_id`)을 이 위에 추가한다. 그 시점에 `places.userId`의 타입을 `String`에서 `uuid`로 정렬하는 것도 함께 검토한다.

Storage 측은 버킷 public read + 삽입은 서명 URL 경유이므로 `storage.objects` 정책을 따로 만들지 않는다.

## 5. 파일 변화

| 파일 | 변화 |
| --- | --- |
| `src/components/map-view.tsx` | MapLibre로 전환, `PlaceWithPublicId` → `Place`, `<Image src>`에 `publicImageUrl()` |
| `src/components/place-form.tsx` | MapLibre로 전환, `uploadToCloudinary()` → `uploadToStorage()`, `accept` 좁히기 |
| `src/actions/place.ts` | `createUploadSignature()` → `createUploadUrlAction()` |
| `src/lib/images.ts` | 신규. `publicImageUrl(path)` |
| `src/lib/supabase.ts` | 신규. 서버 전용 Supabase 클라이언트(`server-only`) |
| `src/lib/cloudinary-loader.ts` | 삭제 |
| `src/lib/places.ts` | `publicIdFromUrl`/`withPublicId`/`PlaceWithPublicId` 제거 |
| `src/schemas/place.ts` | `image` 검증을 URL prefix → path 형식으로 |
| `src/components/place-card.tsx` | `publicId` → `publicImageUrl(image)` |
| `next.config.ts` | custom loader → `remotePatterns` |
| `src/types/env.d.ts` | env 목록 갱신 |
| `src/auth/` (3개 파일) | 삭제 (6절) |

`app/page.tsx`, `app/map/page.tsx`, `app/api/places/route.ts`는 **수정이 필요 없다.** `getAllPlaces()` / `getPlacesInBounds()`의 반환 타입을 추론으로만 사용하므로 `PlaceWithPublicId` → `Place` 변화가 그대로 흘러간다.

## 6. 죽은 코드 제거

`src/auth/`는 현재 어디서도 import되지 않으며 동작하지 않는다.

- `useAuth.tsx`가 `next/router`(Pages Router)를 import하고, 로그인 함수에 이메일·비밀번호가 하드코딩되어 있다.
- `tokenCookies.ts`가 호출하는 `/api/login`, `/api/logout` Route Handler가 존재하지 않는다.

인증 벤더가 Supabase로 확정된 이상 되살릴 코드가 아니다. 3개 파일과 `firebase` 의존성, `NEXT_PUBLIC_FIREBASE_*` env 3개를 함께 제거한다. 남겨두면 다음 작업자에게 잘못된 신호를 준다.

## 7. 의존성 · 환경 변수

### 제거

`mapbox-gl`, `cloudinary`, `firebase`

### 추가

`maplibre-gl`, `@supabase/supabase-js`

`@supabase/supabase-js`는 서버 액션에서만 쓴다. 클라이언트 번들에 들어가지 않는 것을 확인한다.

### 환경 변수

| 제거 | 추가 |
| --- | --- |
| `NEXT_PUBLIC_MAPBOX_API_TOKEN` | `NEXT_PUBLIC_SUPABASE_URL` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `SUPABASE_SECRET_KEY` |
| `NEXT_PUBLIC_CLOUDINARY_KEY` | |
| `CLOUDINARY_SECRET` | |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | |

레거시 `service_role` 키가 아니라 신규 `sb_secret_...` 시크릿 키를 쓴다. 레거시 키는 JWT secret에 묶여 다운타임 없는 로테이션이 어렵고 2026년 말 지원이 종료된다. 신규 키는 개별 생성·명명·폐기가 가능하다.

publishable 키(`sb_publishable_...`)는 이 설계에서 필요하지 않다(3.2절).

## 8. 알려진 제약과 위험 요소

### HEIC

현재 `accept="image/*"`이므로 아이폰 HEIC이 들어올 수 있다. Cloudinary의 `f_auto`가 이를 흡수했으나 Next.js 내장 최적화는 HEIC 출력을 지원하지 않는다.

대응: `accept`를 `image/jpeg,image/png,image/webp`로 좁히고 서버 액션에서도 MIME 타입을 검증한다. HEIC 원본 지원은 이번 스코프에서 제외하며, 필요해지면 클라이언트 측 변환을 별도로 검토한다.

### 서명 URL 업로드 방식

`fetch(signedUrl, { method: "PUT", body: file })` 방식이 동작함을 **구현 첫 단계에서 실증한다.** 실패 시 폴백은 `@supabase/supabase-js`의 `uploadToSignedUrl()`이며, 이 경우 클라이언트에 publishable 키가 필요해지므로 7절의 환경 변수 표에 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 추가해야 한다. 이 분기는 다른 설계 요소에 영향을 주지 않는다.

### 한글 라벨

OpenFreeMap Liberty 스타일의 한국 지명 표기 품질을 실제 화면에서 확인한다. OSM 기반이므로 카카오·네이버보다 POI 밀도가 낮다. 이 앱은 지오코딩이나 장소 검색을 쓰지 않으므로 영향은 라벨 가독성에 국한되지만, "사진 찍은 곳을 알아본다"는 핵심 가치에 직결되므로 검증 항목으로 둔다.

만족스럽지 않을 때의 선택지는 순서대로 다음과 같다. 어느 쪽도 이 설계의 다른 부분을 건드리지 않는다.

1. 다른 OSM 기반 스타일/제공자로 `mapStyle` URL 교체 (MapTiler, Stadia)
2. Protomaps 셀프호스팅 후 `name:ko` 우선 라벨 레이어 커스터마이즈
3. 카카오맵 SDK — `react-map-gl` 추상화를 버려야 하므로 별도 작업으로 분리

### 이미지 최적화 위치 이동

최적화 비용이 CDN에서 애플리케이션 서버로 옮겨온다. 로컬 개발 단계에서는 무관하지만, Vercel 배포 시 이미지 최적화 쿼터를, 셀프호스팅 시 CPU를 소비한다. 배포 시점에 재검토한다.

## 9. 데이터 처리

`places` 4행을 삭제하고 Supabase Storage 기준으로 새로 시작한다. 기존 Cloudinary 이미지는 마이그레이션하지 않는다.

이 결정 덕에 `image` 컬럼의 의미를 URL에서 path로 바꾸면서 혼재 상태를 다루는 코드가 필요하지 않고, 검증 규칙도 하나로 유지된다.

`places` 버킷은 아직 존재하지 않으므로(`storage.buckets`가 비어 있음) 구현 단계에서 생성한다.

## 10. 테스트와 완료 기준

### 단위 테스트 (Vitest)

- `src/lib/places.test.ts` — `publicIdFromUrl` 케이스 제거, `publicImageUrl` 케이스 추가
- `src/schemas/place.test.ts` — `image` 검증 케이스를 Cloudinary URL에서 storage path로 교체
- `clampRating`, `revivePlace`, `boundsQuerySchema` 테스트는 영향 없음

### 실행 검증

1. `/map` — 지도가 렌더링되고 팬/줌 시 bounds 재조회가 동작한다. localStorage 뷰포트 복원이 유지된다.
2. `/create` — 사진 업로드 → EXIF 좌표 파싱 → 확인용 지도 표시 → 저장이 끝까지 동작한다.
3. `/` — 저장한 장소의 사진 카드가 렌더링된다.
4. `/map` 마커 팝업의 사진이 렌더링된다.
5. RLS 활성 상태에서 위 전부가 동작한다.
6. 빌드 산출물에 `SUPABASE_SECRET_KEY` 값이 포함되지 않는다.
7. `next build`가 통과한다.

### 완료 기준

- `mapbox-gl`, `cloudinary`, `firebase`가 `package.json`에 없다.
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DATABASE_URL` 외의 환경 변수를 앱이 읽지 않는다.
- `vitest run` 전체 통과.

## 11. 작업 순서

1. **서명 URL 업로드 실증** — 8절의 위험 요소를 먼저 해소한다. 실패하면 폴백 분기를 확정한 뒤 진행한다.
2. `places` 버킷 생성 (public read)
3. MapLibre 전환 — 지도와 이미지는 독립적이므로 먼저 끝내고 검증할 수 있다.
4. 이미지 저장소 전환 — 서버 클라이언트, 서버 액션, 업로드 경로, `publicImageUrl`, `next.config.ts`
5. `publicId` 개념 제거 — `places.ts`, 스키마, 컴포넌트, 페이지의 타입 정리
6. `places` 4행 삭제
7. 죽은 코드 · 의존성 · env 정리
8. 테스트 갱신 및 실행 검증
