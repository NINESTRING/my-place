# 장소 수정·삭제 설계 — 목록 카드의 케밥 메뉴

- 작성일: 2026-08-20
- 대상: `my-place` (사진 EXIF 기반 장소 기록 웹앱)
- 상태: 승인됨

## 1. 목표

등록한 장소를 고치고 지울 수 있게 한다. 지금은 쓰기 경로가 `createPlaceAction` 하나뿐이라, 제목을 잘못 적으면 되돌릴 방법이 없다.

- **수정** — 제목·설명·카테고리를 고친다. 목록 카드의 ⋮ 메뉴 → 전용 모달.
- **삭제** — 확인 모달을 거쳐 DB 행과 Storage 사진을 함께 지운다.

### 비목표

- **사진 교체.** 사진을 바꾸면 좌표와 촬영 시각도 새 EXIF로 따라 바뀐다. 그것은 수정이 아니라 사실상 다른 장소이므로, 지우고 다시 등록하는 경로로 둔다.
- **좌표 미세조정.** 위와 같은 이유로 EXIF가 준 값을 사실 데이터로 유지한다.
- **실행취소(undo).** 3절 참고.
- **지도 팝업에서의 수정·삭제.** 팝업은 260px 미리보기로 남긴다. 편집 진입점은 목록 한 곳뿐이다.
- **soft delete·휴지통.** 지우면 완전히 지운다.

## 2. 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 수정 범위 | 제목·설명·카테고리 | 사용자가 직접 쓴 값만 고친다. 사진·좌표·촬영시각은 EXIF에서 온 사실 데이터다 |
| 진입점 | 목록 카드 사진 위 오른쪽 상단의 ⋮ 오버레이 | 카드 클릭(=선택·flyTo)과 편집을 섞지 않는다. 카드 하단 텍스트 줄에 두면 제목이 버튼 폭만큼 짧아진다 |
| ⋮ 표시 | 항상 보임 (hover 시에만 나타나지 않음) | 모바일에는 hover가 없다. 이 앱은 사진을 찍은 자리에서 폰으로 보는 쪽이 주 사용처다 |
| 수정 UI | 전용 `EditPlaceDialog` + 공유 `PlaceFields` | 4절 |
| 삭제 확인 | 확인 모달 (`SignOutDialog`와 같은 패턴) | 사진까지 지우는 되돌릴 수 없는 동작이다. 앱의 다른 확인 흐름이 모두 모달이다 |
| 실행취소 | 두지 않음 | 유예 동안 행을 남기려면 soft delete 컬럼과 정리 작업이 따라온다. 확인 모달로 같은 사고를 막을 수 있다 |
| 소유권 검증 | `where: { id, userId }` | 5절 |
| Storage 정리 | DB 행 삭제 후 best-effort | 5절 |
| 메뉴 컴포넌트 | shadcn `dropdown-menu` (base-nova) | 7절 |

### 수정 폼을 등록 폼과 나누는 이유

`place-form.tsx`는 이미 400줄이 넘고, 그 대부분이 사진 한 장을 다루는 일이다 — 드래그앤드롭, EXIF 파싱, lottie 애니메이션, 미리보기 지도, 서명 URL 업로드. 수정에는 그중 아무것도 필요 없다. `mode: "create" | "edit"` 분기를 넣으면 그 400줄 전부가 조건 뒤로 들어가고, 어느 쪽 경로가 무엇을 하는지 읽어 내기 어려워진다.

대신 두 폼이 공유하는 것 — 제목·설명·카테고리 세 필드 — 만 컴포넌트로 뽑는다. `src/schemas/place.ts`가 이미 같은 판단을 한 곳이 있다(`placeFields`를 한 번 정의하고 두 스키마가 확장). 검증 규칙이 한 벌인데 그것을 그리는 마크업이 두 벌이면 결국 어긋난다.

## 3. 사용자 흐름

**수정**

1. 목록 패널의 카드에서 ⋮ → "수정"
2. 모달: 제목(현재 값), 설명(현재 값), 카테고리(현재 값), [취소] [저장]
3. 저장 → 토스트 "장소를 수정했습니다" → 모달 닫힘 → 목록·마커 갱신
4. 그 장소의 팝업이 지도에 떠 있었다면 제목이 즉시 바뀐다

**삭제**

1. 카드에서 ⋮ → "삭제"
2. 확인 모달: "'{제목}'을(를) 삭제할까요? 사진도 함께 지워지며 되돌릴 수 없습니다." [취소] [삭제]
3. 삭제 → 토스트 "장소를 삭제했습니다" → 목록에서 사라짐
4. 그 장소가 선택 중이었다면 팝업도 닫힌다

## 4. 컴포넌트

| 파일 | 역할 |
|---|---|
| `src/components/place-fields.tsx` (신규) | 제목·설명·카테고리 `Controller` 3개. `control`과 `errors`만 받는 표현 컴포넌트 |
| `src/components/place-card-menu.tsx` (신규) | ⋮ 트리거 + "수정"·"삭제" 항목. `onEdit`·`onDelete` 콜백만 받는다 |
| `src/components/edit-place-dialog.tsx` (신규) | 수정 모달. `useForm(placeFormSchema)` + `PlaceFields` + 저장 |
| `src/components/delete-place-dialog.tsx` (신규) | 삭제 확인 모달 |
| `src/components/place-form.tsx` | 세 필드 블록을 `PlaceFields`로 교체 |
| `src/components/place-list-panel.tsx` | 카드 위에 메뉴를 얹고, 편집 콜백을 위로 넘긴다 |
| `src/components/place-explorer.tsx` | `editing`·`deleting` 상태와 성공 처리 |

### PlaceFields

```tsx
export function PlaceFields({ control, errors }: {
  control: Control<PlaceFormValues>
  errors: FieldErrors<PlaceFormValues>
}) // 제목 Input / 설명 Textarea / CategoryPicker
```

등록 폼과 수정 폼 모두 `placeFormSchema`를 resolver로 쓰므로 타입이 그대로 맞는다. `id`는 폼 값이 아니라 액션 인자로 따로 넘긴다 — 사용자가 편집하는 값이 아니다.

### 목록 카드의 DOM 구조

지금은 카드 전체가 `<button>`이다. 그 안에 ⋮ 버튼을 넣으면 버튼 중첩이 되어 HTML상 무효이고, 브라우저에 따라 클릭이 바깥 버튼으로 새어 나가 메뉴를 여는 순간 지도가 날아간다. 선택 버튼과 메뉴를 **형제**로 둔다.

```tsx
<li className="relative">
  <button onClick={() => onSelect(place)} …>
    <PlaceCard place={place} />
  </button>
  <div className="absolute top-2 right-2">
    <PlaceCardMenu … />
  </div>
</li>
```

`PlaceCard` 자체는 건드리지 않는다. 메뉴는 카드 바깥에서 위치만 겹친다.

### 시각

⋮ 버튼은 사진 위에 올라가므로 사진 밝기에 상관없이 읽혀야 한다. 반투명 배경(`bg-background/70` + `backdrop-blur-sm`)의 원형 아이콘 버튼으로 두고 `size-8`, `aria-label="장소 메뉴"`를 준다. 삭제 항목은 `variant="destructive"`로 색을 달리한다.

## 5. 서버 액션 (`src/actions/place.ts`)

기존 파일 상단의 인가 주석이 설명하는 두 겹(세션 + 경로 소유권)은 그대로 유효하다. 수정·삭제에는 **행 소유권**이라는 축이 하나 더 붙는다.

### updatePlaceAction

```ts
export async function updatePlaceAction(input: unknown): Promise<ActionResult<object>>
```

1. `getCurrentUserId()` — null이면 `UNAUTHENTICATED`
2. `placeUpdateSchema.safeParse(input)`
3. `prisma.place.updateMany({ where: { id, userId }, data: { title, description, category, updatedAt: new Date() } })`
4. `count === 0` → "장소를 찾을 수 없습니다"
5. `revalidatePath("/")`

`findFirst`로 조회해 `userId`를 비교한 뒤 `update`하지 않고 `updateMany`의 `where`에 `userId`를 넣는다. 조회와 갱신 사이의 경합이 없고, 소유자가 아닌 경우와 존재하지 않는 경우가 같은 결과(`count === 0`)로 합쳐져 남의 장소가 있는지 없는지도 새어 나가지 않는다.

`updatedAt`을 명시하는 이유: `schema.prisma`의 `updatedAt`은 `@default(now())`뿐이고 `@updatedAt`이 없다. 쓰지 않으면 생성 시각에 영원히 머문다.

### deletePlaceAction

```ts
export async function deletePlaceAction(id: unknown): Promise<ActionResult<object>>
```

1. `getCurrentUserId()` — null이면 `UNAUTHENTICATED`
2. `placeIdSchema.safeParse(id)`
3. `prisma.place.findFirst({ where: { id, userId }, select: { image: true } })` — 없으면 "장소를 찾을 수 없습니다"
4. `prisma.place.deleteMany({ where: { id, userId } })`
5. `isOwnedImagePath(image, userId)`일 때만 `supabaseAdmin.storage.from(PLACES_BUCKET).remove([image])`
6. `revalidatePath("/")`

**순서가 DB 먼저인 이유.** 두 저장소에 걸친 삭제라 어느 쪽이든 중간에 실패할 수 있다. Storage를 먼저 지우면 실패 지점에서 "행은 있는데 사진이 404인 카드"가 남는다 — 사용자에게 보이고, 고칠 방법도 없다. DB를 먼저 지우면 최악이 아무도 참조하지 않는 파일 하나가 버킷에 남는 것이고, 이건 보이지 않으며 나중에 일괄 정리할 수 있다. 그래서 Storage 삭제는 best-effort로 두고 실패는 `console.error`만 남긴다 — 사용자 눈에는 삭제가 성공한 것이 맞다.

**경로를 한 번 더 확인하는 이유.** `supabaseAdmin`은 service role이라 RLS를 우회한다. 여기 넘어가는 `image`는 DB에서 읽은 값이라 3번에서 이미 소유권이 걸러졌지만, 등록 시점의 검증을 빠져나온 낡은 행이 있다면 admin 클라이언트가 그 경로를 그대로 지운다. `isOwnedImagePath`는 이미 있는 함수이고 한 줄이다.

## 6. 스키마 (`src/schemas/place.ts`)

```ts
const placeId = z.number().int().positive()

export const placeIdSchema = placeId

export const placeUpdateSchema = z.object({
  id: placeId,
  ...placeFields,
})

export type PlaceUpdateInput = z.infer<typeof placeUpdateSchema>
```

`placeFields`를 그대로 확장하므로 등록과 수정의 검증 규칙이 갈라질 수 없다. `id`는 `Place.id`가 `Int @default(autoincrement())`이므로 양의 정수다.

## 7. UI 의존성

`npx shadcn add dropdown-menu`로 `src/components/ui/dropdown-menu.tsx`를 받는다. base-nova 스타일이며 내부는 `@base-ui/react/menu`다 — 이 저장소의 다른 UI 프리미티브와 같은 계열이고 새 런타임 의존성이 늘지 않는다.

받은 파일에 레지스트리 내부 경로 import가 하나 섞여 있다(`@/app/(create)/components/icon-placeholder`). 이 저장소에는 없는 경로이므로 `lucide-react` 아이콘으로 바꿔야 컴파일된다.

## 8. 상태 갱신 (`place-explorer.tsx`)

이 화면의 장소 목록은 RSC가 아니라 `/api/places`로 가져오므로 `revalidatePath`만으로는 갱신되지 않는다. 기존 등록 흐름이 쓰는 `reloadToken` 증가를 그대로 재사용한다.

| 사건 | 처리 |
|---|---|
| 수정 성공 | 모달 닫기 → `setReloadToken(n => n + 1)` → 선택된 장소가 그 장소면 `setSelected(prev => ({ ...prev, ...values }))` |
| 삭제 성공 | 모달 닫기 → `setReloadToken(n => n + 1)` → 선택된 장소가 그 장소면 `setSelected(null)` |

수정 시 `selected`를 직접 겹쳐 쓰는 이유는 재조회가 디바운스·네트워크를 거치는 동안 지도 팝업이 옛 제목을 들고 있기 때문이다. 방금 고친 값이 눈앞에서 그대로인 것은 저장이 실패한 것처럼 보인다.

## 9. 에러·대기 상태

- 액션 결과는 기존 `ActionResult`를 그대로 쓰고, 실패는 sonner 토스트로 문구를 그대로 보여 준다.
- 저장·삭제 중에는 버튼을 `disabled`로 두고, 모달은 바깥 클릭·Esc로 닫히지 않게 한다(`SignOutDialog`의 `pending` 패턴). 닫혀도 액션은 계속 진행되므로 "취소한 것처럼 보이는데 삭제되는" 상태를 막는다.
- 미인증(`UNAUTHENTICATED`)은 실제로는 세션 만료뿐이다 — 목록 패널 자체가 로그인 상태에서만 열린다.

## 10. 테스트

| 파일 | 추가 |
|---|---|
| `src/schemas/place.test.ts` | `placeUpdateSchema`: `id` 0·음수·소수·문자열 거부, 공백뿐인 제목 거부, 61자 제목 거부, 설명 생략 허용, `category: null` 허용 |

서버 액션과 컴포넌트를 위한 테스트 인프라(DB 픽스처, DOM 환경)는 이 저장소에 없다. 이번 작업을 위해 새로 들이지 않는다 — 기존 테스트는 모두 순수 함수와 스키마를 다룬다.

## 11. 영향 파일

| 파일 | 작업 |
|---|---|
| `src/schemas/place.ts` | `placeIdSchema`, `placeUpdateSchema` 추가 |
| `src/actions/place.ts` | `updatePlaceAction`, `deletePlaceAction` 추가 |
| `src/components/ui/dropdown-menu.tsx` | shadcn으로 추가 (import 한 줄 수정) |
| `src/components/place-fields.tsx` | 신규 |
| `src/components/place-card-menu.tsx` | 신규 |
| `src/components/edit-place-dialog.tsx` | 신규 |
| `src/components/delete-place-dialog.tsx` | 신규 |
| `src/components/place-form.tsx` | 세 필드를 `PlaceFields`로 교체 |
| `src/components/place-list-panel.tsx` | 메뉴 배치, 콜백 전달 |
| `src/components/place-explorer.tsx` | 수정·삭제 모달 상태와 성공 처리 |
| `src/schemas/place.test.ts` | 수정 스키마 테스트 추가 |
| `README.md` | 기능 목록에 수정·삭제 추가 |
