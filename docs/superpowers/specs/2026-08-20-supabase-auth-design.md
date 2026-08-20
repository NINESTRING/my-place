# Supabase Auth · Google 소셜 로그인 설계

- 작성일: 2026-08-20
- 대상: `my-place` (사진 EXIF 기반 장소 기록 웹앱)
- 상태: 승인됨

## 1. 목표

인증을 구현한다. 이전 작업([MapLibre · Storage 전환 설계](2026-08-19-maplibre-supabase-storage-design.md))이 명시적 비목표로 남겨 둔 항목이며, 그 설계가 예고한 대로 `getCurrentUserId()` 스텁을 실제 구현으로 교체하는 것이 핵심이다.

동작 요구사항은 세 문장이다.

- 미인증 사용자에게는 지도만 보여준다. 팬·줌은 전부 동작하고 마커만 없다.
- 등록·목록 버튼을 누르면 "로그인하고 사용하세요" 안내가 뜬다.
- 등록·목록 버튼 옆에 로그인 버튼이 있다.

### 비목표

- **이메일/비밀번호 로그인.** Google 소셜 로그인만 구현한다.
- **장소 공유.** 사용자는 자기가 등록한 장소만 본다. 공개 토글이나 팔로우 같은 개념을 도입하지 않는다.
- **사용자 프로필.** `auth.users` 외에 별도 `User` 테이블을 만들지 않는다. `Place.userId`가 유일한 사용자 참조다.
- **사진 비공개화.** Storage `places` 버킷은 public read를 유지한다(6절).

## 2. 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 인증 벤더 | Supabase Auth | DB·Storage가 이미 Supabase다. 이전 설계가 확정한 방향 |
| 프로바이더 | Google only | 비밀번호 관리·이메일 발송이 사라진다. Free 플랜의 기본 SMTP 제약(2026-06-03 변경)도 회피 |
| 흐름 | PKCE (Authorization Code) | 서버 사이드 렌더링에서 세션을 쿠키로 다루는 유일한 올바른 방식 |
| 로그인 UI 위치 | 모달 | 앱 전체가 한 화면이다(`dcc18b3`). 리다이렉트가 없어 지도 뷰포트가 보존된다 |
| 버튼 개수 | 1개 ("로그인") | Google OAuth에서 회원가입과 로그인은 같은 동작이다. 버튼 2개는 라벨만 다르고 하는 일이 같아 사용자를 오해시킨다 |
| 장소 공개 범위 | 내 장소만 | 앱 이름이 `my-place`다. 사진·위치라는 데이터 성격상 기본 비공개가 안전하다 |
| 기존 `userId="1"` 데이터 | 삭제 | 개발 중 테스트 데이터다. 스코핑을 켜면 어차피 아무에게도 안 보인다 |

## 3. 인증 흐름

```text
브라우저 (로그인 모달)
  supabase.auth.signInWithOAuth({ provider: "google",
                                  redirectTo: `${origin}/auth/callback?next=/` })
    │
    └─► accounts.google.com  ─►  xhttvfbzqhprmentinxm.supabase.co/auth/v1/callback
                                    │
    ┌───────────────────────────────┘
    ▼
app/auth/callback/route.ts
  supabase.auth.exchangeCodeForSession(code)   → 세션 쿠키 발급
  redirect(next)
    │
    ▼
proxy.ts (모든 요청)
  supabase.auth.getClaims()   → 만료된 액세스 토큰을 갱신하고 쿠키를 다시 씀
```

`signInWithOAuth`를 브라우저에서 호출하는 것이 요점이다. `window.location.origin`이 필요하고, 브라우저가 직접 Google로 이동해야 한다.

## 4. 아키텍처

### 4.1 Supabase 클라이언트 3종

현재 `src/lib/supabase.ts` 하나가 시크릿 키 클라이언트만 담고 있다. 인증이 붙으면 성격이 다른 클라이언트가 셋이 되므로 디렉터리로 가른다. 현재 이 모듈을 임포트하는 곳은 `src/actions/place.ts` 한 곳뿐이라 이동 비용이 없다.

| 파일 | 키 | 용도 | 경계 |
|---|---|---|---|
| `src/lib/supabase/admin.ts` | `SUPABASE_SECRET_KEY` | Storage 서명 URL 발급 | `server-only` |
| `src/lib/supabase/browser.ts` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `signInWithOAuth` | 클라이언트 컴포넌트 |
| `src/lib/supabase/server.ts` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 세션 읽기, 코드 교환, 로그아웃 | `server-only` |

`admin.ts`는 기존 파일을 그대로 옮긴 것이다. `server-only` 임포트가 시크릿 키의 클라이언트 번들 유출을 컴파일 시점에 막는 성질을 유지한다.

`server.ts`가 시크릿 키가 아니라 publishable 키를 쓰는 것이 중요하다. 세션 검증은 사용자의 JWT로 해야 한다. 시크릿 키 클라이언트는 RLS를 우회하므로 인증 판단에 쓸 수 없다.

### 4.2 `proxy.ts` — 토큰 갱신 전용

Next.js 16에서 `middleware.ts`는 **`proxy.ts`로 이름이 바뀌었다**(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`가 deprecated로 명시). 프로젝트 루트에 `app/`과 같은 레벨로 둔다.

Supabase 공식 예제의 proxy는 미인증 사용자를 `/login`으로 리다이렉트한다. **그 부분을 걷어낸다.** 리다이렉트가 남으면 "미인증이면 지도만 보여준다"가 성립하지 않는다.

Next.js 인증 가이드도 같은 방향을 지시한다 — proxy는 낙관적 검사용이며 인가의 유일한 방어선이 되어서는 안 된다. 실제 인가는 데이터 소스에 가까운 곳(4.3절)에서 한다.

주의점 두 가지:

- `createServerClient`와 `getClaims()` 사이에 다른 코드를 넣지 않는다. 사용자가 무작위로 로그아웃되는 디버깅 지옥의 원인이다.
- `supabaseResponse`를 **그대로** 반환한다. 새 `NextResponse`를 만들면 쿠키가 유실돼 브라우저와 서버 세션이 어긋난다.

### 4.3 인가 seam — `src/lib/auth.ts`

이 파일이 원래 의도대로 인증의 유일한 지점이 된다. 내보내는 것은 함수 하나다.

```ts
getCurrentUserId(): Promise<string | null>   // React cache() 로 요청당 1회
```

반환형이 `Promise<string>`에서 `Promise<string | null>`로 바뀌는 것은 **의도된 파괴적 변경**이다. 타입 체커가 모든 호출부에서 "로그인 안 된 경우"를 처리하도록 강제한다.

> **구현 중 변경.** 초안에는 쓰기 경로용으로 세션이 없으면 throw 하는 `requireUserId()`가 함께 있었다. 실제로 써 보니 두 쓰기 액션이 모두 `ActionResult`로 실패를 표현하므로, 던진 예외를 그 자리에서 잡아 다시 `ActionResult`로 바꾸는 try/catch 가 액션마다 붙었다. 실패 표현이 두 개(예외와 반환값)가 되면서 코드만 늘고 얻는 것이 없었다. `getCurrentUserId()`의 반환형에 이미 `null`이 있어 타입 체커가 검사를 강제하므로 안전성도 동일하다. `requireUserId()`와 `UnauthenticatedError`를 없애고 호출부에서 `null` 검사만 한다.

`getClaims()`의 `sub` 클레임이 사용자 id이며 Supabase auth의 UUID다. `Place.userId`가 이미 `String`이므로 스키마 변경이 없다.

`app_metadata` / `user_metadata`는 인가에 쓰지 않는다. `user_metadata`는 사용자가 직접 수정할 수 있어 신뢰할 수 없다. 이 앱은 역할 개념이 없으므로 `sub` 하나로 충분하다.

### 4.4 데이터 스코핑

```ts
getPlacesInBounds(bounds: Bounds, userId: string): Promise<Place[]>
```

`userId`를 **필수 인자**로 만든다. 옵셔널이면 필터를 빼먹는 실수가 조용히 통과한다. 미인증이면 아예 호출하지 않고 `[]`를 쓴다.

호출부 두 곳:

- `app/page.tsx` — 최초 렌더
- `app/api/places/route.ts` — 지도 이동 시 재조회

`Place` 모델에 `@@index([userId])`가 이미 있어 인덱스 추가가 필요 없다. 다만 이 쿼리는 `userId` + 좌표 범위 복합 조건이므로, 데이터가 커지면 복합 인덱스를 고려한다(현 규모에서는 불필요).

## 5. 보안: 쓰기 경로 소유권

`src/actions/place.ts`의 주석이 이미 이 문제를 예고해 두었다.

> 서명 URL 의 path 와 createPlaceAction 에 제출되는 path 는 서로 바인딩되지 않는다 (...) `getCurrentUserId()` 를 실제 구현으로 바꾸는 순간 이것은 인가 버그가 된다(사용자 A 가 사용자 B 의 이미지를 자기 행에 붙일 수 있음).

인증을 붙이는 이번 작업에서 함께 닫는다. 방법은 **경로에 소유자를 박는 것**이다.

```diff
-createSignedUploadUrl(`${crypto.randomUUID()}.${ext}`)
+createSignedUploadUrl(`${userId}/${crypto.randomUUID()}.${ext}`)
```

그러면 제출된 `image` 값이 `${userId}/`로 시작하는지 검사하는 것만으로 소유권이 증명된다. 별도 테이블이나 토큰 바인딩이 필요 없다.

변경 지점:

- `src/schemas/place.ts`의 `imagePath` 정규식을 `<uuid>/<uuid>.(jpg|png|webp)`로 확장. 경로 이탈(`../`)을 막는 기존 성질은 정규식이 그대로 유지한다
- `createUploadUrlAction`, `createPlaceAction` 모두 맨 앞에서 `requireUserId()`
- `createPlaceAction`이 `isOwnedImagePath(input.image, userId)`를 검증

`next.config.ts`의 `remotePatterns` pathname이 `/storage/v1/object/public/places/**`라 하위 폴더가 이미 매칭된다. 수정 불필요.

## 6. 보안: 사진 버킷은 public 유지

`places` 버킷의 public read를 유지한다. 근거와 한계를 명확히 기록해 둔다.

- 객체 경로가 UUID 두 개로 추정 불가능하다. URL을 알아야만 접근할 수 있다
- `next/image` 최적화가 그대로 동작한다. private 전환은 목록·마커·팝업의 이미지 렌더링 경로 전체와 서명 URL 만료 처리를 다시 설계해야 한다

**이것은 "보안"이 아니라 "노출 가능성이 낮음"이다.** URL이 새면 그 사진은 누구나 볼 수 있다. 사진의 기밀성이 요구사항이 되는 시점에 private + 서명 다운로드 URL로 전환해야 하며, 그때 이 절이 근거 기록이 된다.

## 7. 보안: RLS

**새 정책을 추가하지 않는다.**

`supabase/migrations/20260819000000_places_storage_and_rls.sql`이 "Supabase Auth 를 붙일 때 소유권 기반 정책을 이 위에 추가한다"고 적어 두었지만, 그 전제가 성립하지 않는다. 현재 상태는:

- Prisma는 테이블 소유자 롤로 접속해 RLS를 우회한다
- `anon` / `authenticated` 롤은 `public.places`에 접근이 완전히 차단돼 있다 (`GRANT`가 없음)
- 브라우저의 Supabase 클라이언트는 Auth 엔드포인트만 쓴다. Data API로 `places`를 읽지 않는다

즉 DB에 직접 닿는 경로가 존재하지 않으므로, 지금 소유권 정책을 추가하면 **아무도 평가하지 않는 죽은 설정**이 된다. 스코핑은 4.4절의 애플리케이션 계층에서 한다.

RLS `enable`은 그대로 둔다 — 나중에 Data API를 열 때의 안전망이다. `places`를 Data API로 노출하기로 결정하는 시점에 `GRANT`와 소유권 정책을 함께 추가한다.

## 8. UI

### 8.1 버튼 스택

`src/components/place-explorer.tsx`의 우상단 버튼 스택에 세 번째 버튼이 붙는다.

```text
미인증                              인증됨
┌──────┐                           ┌──────┐
│  +   │ ──► 로그인 모달            │  +   │ ──► 등록 모달
├──────┤                           ├──────┤
│  ☰   │ ──► 로그인 모달            │  ☰   │ ──► 목록 패널
├──────┤                           ├──────┤
│ 로그인 │ ──► 로그인 모달            │ 로그아웃 │
└──────┘                           └──────┘
```

등록·목록 버튼을 미인증 상태에서 **비활성화하지 않는다.** 눌리되 로그인 모달이 열린다. 비활성 버튼은 왜 못 쓰는지 알려주지 못한다.

### 8.2 로그인 모달

새 파일 `src/components/login-dialog.tsx`. `create-place-dialog.tsx`와 같은 구조(`Dialog` + 커스텀 닫기 버튼)를 따른다.

`reason` prop으로 왜 열렸는지에 따라 문구가 바뀐다.

| `reason` | 문구 |
|---|---|
| `"create"` | 장소를 등록하려면 로그인이 필요합니다 |
| `"list"` | 내 장소 목록을 보려면 로그인이 필요합니다 |
| `null` | 로그인하면 다녀온 장소를 기록할 수 있습니다 |

본문에는 "Google 계정으로 계속하기" 버튼 하나와 "처음이시면 자동으로 가입됩니다" 안내를 둔다. 회원가입과 로그인이 같은 동작임을 숨기지 않고 설명한다.

### 8.3 콜백 실패

`exchangeCodeForSession`이 실패하면 `/?auth_error=1`로 돌려보내고 `sonner` 토스트를 띄운 뒤 `history.replaceState`로 쿼리를 정리한다. 전용 에러 페이지를 만들지 않는 이유는 이 앱이 한 화면 구조이며 이미 `Toaster`가 레이아웃에 있기 때문이다.

## 9. 파일 변화

### 추가

| 파일 | 내용 |
|---|---|
| `proxy.ts` | 세션 토큰 갱신 |
| `app/auth/callback/route.ts` | PKCE 코드 교환 |
| `src/lib/supabase/browser.ts` | 브라우저 클라이언트 |
| `src/lib/supabase/server.ts` | 쿠키 바인딩 서버 클라이언트 |
| `src/components/login-dialog.tsx` | 로그인 모달 |
| `src/components/auth-error-toast.tsx` | 콜백 실패 토스트 + 주소창 정리 |
| `src/actions/auth.ts` | `signOutAction` |
| `supabase/migrations/20260820000000_drop_stub_user_places.sql` | 스텁 행 삭제 |
| `scripts/purge-stub-storage.mjs` | 스텁 Storage 객체 삭제 (1회성) |

### 이동

- `src/lib/supabase.ts` → `src/lib/supabase/admin.ts`

### 수정

| 파일 | 변경 |
|---|---|
| `src/lib/auth.ts` | 스텁 → `getCurrentUserId` / `requireUserId` |
| `src/lib/places.server.ts` | `userId` 필수 인자 |
| `src/lib/images.ts` | `userScopedImagePath` / `isOwnedImagePath` 추가 |
| `src/schemas/place.ts` | `imagePath` 정규식에 소유자 폴더 반영 |
| `src/actions/place.ts` | `requireUserId` + 소유권 검증 |
| `app/page.tsx` | 세션 확인, `isAuthenticated` 전달 |
| `app/api/places/route.ts` | 미인증이면 `[]` |
| `src/components/place-explorer.tsx` | 로그인 버튼, 게이팅, 모달 |
| `src/types/env.d.ts` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 선언 |
| `src/lib/images.test.ts`, `src/schemas/place.test.ts` | 새 경로 형식 반영 |

`src/components/place-form.tsx`는 수정하지 않는다. 액션의 `ActionResult.error`를 이미 토스트로 띄우고 있어, 모달을 열어 둔 채 세션이 만료된 경우에도 "로그인이 필요합니다"가 그대로 표시된다.

## 10. 의존성 · 환경 변수

### 추가

- `@supabase/ssr` — 쿠키 기반 세션 관리. `getAll`/`setAll` 쿠키 API를 쓴다(v0.4+ 방식. 구 `get`/`set`/`remove`는 v1.0.0에서 제거 예정)

### 환경 변수

```diff
+NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

publishable 키를 쓴다. legacy `anon` 키는 호환용이며 신규 코드에 쓰지 않는다. `NEXT_PUBLIC_` 접두사가 붙으므로 브라우저 번들에 포함되는데, publishable 키는 그것이 정상 용도다.

### 대시보드 설정 (코드 밖, 완료됨)

1. Google Cloud Console — OAuth 클라이언트, 리디렉션 URI `https://xhttvfbzqhprmentinxm.supabase.co/auth/v1/callback`
2. Supabase — Authentication → Providers → Google 활성화 + client id/secret
3. Supabase — Authentication → URL Configuration → Redirect URLs에 `http://localhost:3000/**`

## 11. 데이터 처리

`userId = '1'` 행과 그 Storage 객체를 삭제한다. 되돌릴 수 없다.

**DB 행은 마이그레이션으로, Storage 파일은 Storage API 로 지운다.** 초안은 둘 다 SQL 한 파일에 넣으려 했지만 `storage.objects`를 SQL 로 지우면 메타데이터 행만 사라지고 실제 파일은 백엔드에 남아 접근 불가 상태로 방치된다. 그래서 갈랐다.

```sql
-- supabase/migrations/20260820000000_drop_stub_user_places.sql
delete from public.places where user_id = '1';
```

```bash
node --env-file=.env scripts/purge-stub-storage.mjs
```

스크립트는 버킷 **루트**의 객체만 지운다. 인증 이후의 경로는 모두 `<userId>/<uuid>.<ext>`이므로 루트에 직접 놓인 객체는 정의상 스텁 시절의 것이다. 따라서 나중에 다시 실행해도 실제 사용자의 사진을 건드리지 않는다.

실행 결과: `places` 3행, Storage 객체 3개 삭제. 삭제 시점의 `auth.users`는 0행이었으므로 실제 사용자 데이터는 존재하지 않았다.

## 12. 테스트와 완료 기준

### 단위 테스트 (Vitest)

기존 테스트들처럼 목 없이 순수 함수만 검증한다.

- `userScopedImagePath(userId, ext)` — 형식이 `<userId>/<uuid>.<ext>`
- `isOwnedImagePath(path, userId)` — 남의 폴더 거부, 접두사만 같은 경우(`abc` vs `abcd`) 거부, 경로 이탈 거부
- `imagePath` 스키마 — 소유자 폴더 있는 경로 통과, 옛 형식(폴더 없음) 거부

`getCurrentUserId`는 `next/headers`에 의존하므로 단위 테스트하지 않는다. 실행 검증으로 덮는다.

### 실행 검증

1. 로그아웃 상태로 `/` — 지도가 보이고 마커가 없다. 팬·줌 동작
2. 등록 버튼 → 로그인 모달, 문구가 "장소를 등록하려면"
3. 목록 버튼 → 로그인 모달, 문구가 "내 장소 목록을"
4. 로그인 버튼 → Google 로그인 → `/`로 복귀, 로그인 상태
5. 사진 등록 → Storage 경로가 `<uuid>/<uuid>.jpg`, 마커 생성
6. 로그아웃 → 마커가 사라지고 지도만 남음
7. 새 시크릿 창에서 다른 계정 로그인 → 첫 계정의 장소가 안 보임

### 완료 기준

- `npm test` 통과 — 59 tests
- `npx tsc --noEmit` 통과
- `npm run build` 통과 (`ƒ Proxy (Middleware)` 로 `proxy.ts` 인식 확인)
- 실행 검증 1–7 통과

### 자동 검증한 범위

dev 서버에 직접 요청해 확인한 것:

- `GET /api/places?...` (세션 없음) → `{"places":[]}`
- `GET /auth/callback` (code 없음) → 307 `/?auth_error=1`
- `GET /auth/callback?code=bogus` → 307 `/?auth_error=1`
- `GET /` (세션 없음) → 마커 0개, `isAuthenticated: false`, `aria-label="로그인"` 존재, 등록·목록 버튼은 `disabled` 아님
- 서버 로그에 `proxy.ts` 실행 기록, 에러 없음

**세션이 있는 경로는 자동 검증하지 못했다.** Google 로그인을 통과해야 하므로 브라우저에서 사람이 확인해야 한다. 위 실행 검증 목록의 4–7번이 그에 해당한다.

## 13. 작업 순서

1. `@supabase/ssr` 설치, 환경 변수 추가
2. `src/lib/supabase/` 3분할
3. `src/lib/auth.ts` 실제 구현
4. `proxy.ts`, `app/auth/callback/route.ts`
5. `src/lib/images.ts` 경로 헬퍼 + 스키마 정규식 + 테스트
6. `src/actions/place.ts` 소유권 검증, `src/actions/auth.ts`
7. 데이터 스코핑 (`places.server.ts`, `page.tsx`, `api/places/route.ts`)
8. `login-dialog.tsx`, `place-explorer.tsx`
9. 마이그레이션
10. 검증
