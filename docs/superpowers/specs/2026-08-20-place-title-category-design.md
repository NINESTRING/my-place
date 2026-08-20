# 장소 등록 필드 재정리 설계 — 제목·설명·카테고리·별점

- 작성일: 2026-08-20
- 대상: `my-place` (사진 EXIF 기반 장소 기록 웹앱)
- 상태: 승인됨

## 1. 목표

장소 등록 폼이 받는 값을 재정리한다.

- **제목을 받는다.** 필수 값이며, 카드·팝업에서 장소를 대표하는 한 줄이 된다.
- **설명은 선택으로 내린다.** 쓰고 싶은 사람만 쓴다.
- **별점을 제거한다.** 컴포넌트와 컬럼을 모두 지운다.
- **카테고리를 정수 코드에서 문자열 enum으로 바꾸고 선택 값으로 만든다.** 항목에 `풍경`을 추가한다.

### 비목표

- **카테고리별 마커 색·아이콘 구분.** enum 전환으로 길만 열어 두고, 이번에는 하지 않는다.
- **카테고리·제목 기반 검색·필터.** 마찬가지로 다음 단계다.
- **장소 수정·삭제.** 등록 경로만 다룬다.
- **자유 태그.** 고정 목록을 유지한다(2절).

## 2. 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 제목 | 필수, 최대 60자 | 카드·팝업·이미지 `alt`가 모두 이 값을 쓴다. 비어 있으면 대체할 것이 없다 |
| 설명 | 선택, 최대 500자 (기존 상한 유지) | 사진과 제목만으로 기록은 완결된다 |
| 별점 | 제거 (컬럼·컴포넌트·헬퍼 전부) | 기본값 3점이 조용히 들어가 값이 신뢰되지 않았고, 표시 외에 쓰이는 곳이 없었다 |
| 카테고리 표현 | `Int` → Prisma enum `PlaceCategory` | DB에서 값이 읽히고 enum이 제약을 건다. 항목이 늘어도 zod의 숫자 상한을 따라 고칠 곳이 없다 |
| 카테고리 필수 여부 | 선택 (`null` 허용, 기본값 없음) | 기존 `defaultValues: { category: 1 }`은 신경 쓰지 않은 장소를 전부 "카페"로 저장했다. 별점을 빼는 이유와 같은 문제다 |
| "기타" 항목 | 두지 않음 — 미선택은 `null` | nullable 컬럼에 `ETC`까지 두면 "기타"와 "미선택"이 같은 말을 두 번 한다 |
| 카테고리 항목 | 카페 / 식당 / 숙소 / 명소 / 풍경 | `명소`는 가서 보는 대상, `풍경`은 그 자리에서 보이는 경치. EXIF 좌표로 기록하는 앱 성격상 실제로 갈리는 축이다 |
| 마이그레이션 | `prisma db push` 만 | `places`가 0행이다(확인함). 백필도 데이터 손실도 없다 |

### 카테고리를 남기고 별점은 지우는 이유

둘 다 "표시만 하는 미검증 필드"였지만 앞으로의 쓸모가 다르다. 별점은 마커나 목록에서 할 일이 없다 — 점수로 지도를 읽지는 않는다. 카테고리는 마커 아이콘·색 구분과 목록 필터라는 분명한 다음 단계가 있고, 그것이 장소를 모으는 앱에서 지도를 한눈에 읽게 만드는 수단이다. 그 단계로 갈 때 정수 코드는 걸림돌이므로 지금 enum으로 바꿔 둔다.

## 3. 데이터 모델

```prisma
enum PlaceCategory {
  CAFE
  RESTAURANT
  STAY
  ATTRACTION
  SCENERY
}

model Place {
  id                Int            @id @default(autoincrement())
  userId            String         @map(name: "user_id")
  image             String
  imageCreationTime DateTime
  latitude          Float
  longitude         Float
  title             String
  description       String?
  category          PlaceCategory?
  createdAt         DateTime       @default(now()) @map(name: "created_at")
  updatedAt         DateTime       @default(now()) @map(name: "updated_at")

  @@index([userId], name: "places.userId")
  @@map(name: "places")
}
```

`rating Int`가 사라지고 `title String`이 들어오며, `description`과 `category`가 nullable이 된다.

`supabase/migrations/`에는 파일을 추가하지 않는다. 그 디렉터리는 Prisma가 소유하지 않는 것(Storage 버킷 생성, RLS 활성화, 일회성 데이터 정리)만 담는 기존 패턴이며, 컬럼 변경은 `npx prisma db push`가 담당한다. 테이블이 비어 있어 `--accept-data-loss` 없이도 안전하다.

## 4. 스키마 (`src/schemas/place.ts`)

현재 `placeInputSchema`와 `placeFormSchema`가 `description`·`rating`·`category`를 각각 따로 정의한다. 필드가 세 곳(두 스키마 + 폼 `defaultValues`)에서 어긋날 수 있는 상태다. 공통 필드를 한 번만 쓰고 양쪽이 확장하게 한다.

```ts
/** 폼과 서버 입력이 공유하는 사용자 작성 필드. */
const placeFields = {
  title: z.string().min(1, "제목을 입력해 주세요").max(60),
  // 손대지 않은 Textarea 는 ""를 보낸다. DB 에 ""와 null 이 섞이면
  // "설명이 있는지" 판정이 두 갈래가 되므로 여기서 접는다.
  description: z
    .string()
    .max(500)
    .transform((v) => v.trim() || undefined)
    .optional(),
  category: z.enum(PlaceCategory).nullable(),
}

export const placeFormSchema = z.object(placeFields)

export const placeInputSchema = z.object({
  ...placeFields,
  image: imagePath,
  imageCreationTime: z.coerce.date(),
  latitude,
  longitude,
})
```

`category`는 `PlaceCategory` enum을 Prisma 생성 클라이언트에서 가져와 zod가 그대로 쓴다. 항목을 추가할 때 고칠 곳이 `schema.prisma`와 라벨 맵 둘뿐이 된다.

## 5. 카테고리 라벨 (`src/lib/categories.ts`)

```ts
export const CATEGORIES = [
  { value: "CAFE", label: "카페" },
  { value: "RESTAURANT", label: "식당" },
  { value: "STAY", label: "숙소" },
  { value: "ATTRACTION", label: "명소" },
  { value: "SCENERY", label: "풍경" },
] as const satisfies readonly { value: PlaceCategory; label: string }[]

export function categoryLabel(value: PlaceCategory | null): string | null
```

`satisfies`는 enum에 없는 값을 적는 실수를 잡는다. 그 반대 방향 — enum에 항목을 추가하고 라벨을 빠뜨리는 것 — 은 `satisfies`가 잡지 못하므로 누락 시 컴파일이 깨지는 타입 단정을 함께 둔다(`Exclude<PlaceCategory, ...>`가 `never`인지 검사).

`categoryLabel`은 `?? "기타"` 폴백을 버리고 미선택이면 `null`을 돌려준다 — 호출자가 라벨 자리를 비울 수 있어야 한다.

## 6. 폼 (`src/components/place-form.tsx`)

필드 순서: **제목 → 설명 → 카테고리**. 사진 드롭 존과 촬영 위치 지도는 그대로 위에 남는다.

| 필드 | 컴포넌트 | 비고 |
|---|---|---|
| 제목 | `Input` (`ui/input.tsx`) | `placeholder`는 장소 이름 예시. 필수 |
| 설명 | `Textarea`, `rows={3}` | 라벨에 선택 사항임을 표시 |
| 카테고리 | `CategoryPicker` | 미선택 상태로 시작 |

`defaultValues`는 `{ title: "", description: "", category: null }`. 별점 `Field` 블록과 `StarRating` import를 제거하고 `src/components/star-rating.tsx`를 삭제한다.

`onSubmit`이 `createPlaceAction`에 넘기는 객체에서 `rating`을 빼고 `title`을 넣는다.

### CategoryPicker

값이 문자열이 되어 `Number()` 변환이 사라진다. 두 가지를 바꾼다.

1. **해제 가능** — 이미 선택된 항목을 다시 누르면 `null`로 돌아간다. 되돌릴 방법이 없으면 잘못 누른 순간부터 선택 사항이 아니게 된다. `ToggleGroup`의 `onValueChange`가 빈 배열을 주는 경우를 무시하지 않고 `null`로 흘린다.
2. **`flex-wrap`** — 항목이 5개가 되어 좁은 화면에서 한 줄에 들어가지 않는다. 모달 폭은 `sm:max-w-lg`(32rem)이라 데스크톱은 한 줄이고, 모바일에서는 두 줄로 접힌다.

## 7. 표시

| 위치 | 변경 |
|---|---|
| `place-card.tsx` | 굵은 줄 = `title`. 그 아래 `description`이 있을 때만 muted 한 줄(2줄 clamp). 별 5개 제거. `alt` = `title`. 카테고리 라벨은 `null`이면 자리를 비운다 |
| `place-explorer.tsx` 팝업 | 제목 = `title`, `alt` = `title`. 설명은 넣지 않는다 — 팝업 폭이 260px이고, 전문은 카드에서 읽는다 |
| `src/lib/places.ts` | `clampRating` 삭제 |

카드의 첫 줄이 `description`에서 `title`로 바뀌는 것이 핵심이다. 지금까지 `description`이 제목 역할을 겸하고 있었고(카드의 굵은 줄, 팝업 제목, 두 곳의 이미지 `alt`), 이 작업은 필드 추가라기보다 그 역할 분리다.

## 8. 테스트

| 파일 | 변경 |
|---|---|
| `src/schemas/place.test.ts` | `rating` 케이스 삭제. `title` 필수(빈 문자열 거부, 61자 거부), `description` 생략 허용·빈 문자열이 `undefined`로 접히는지, `category`가 `null` 허용·정의되지 않은 enum 값 거부 |
| `src/lib/places.test.ts` | `clampRating` 테스트 삭제. `revivePlace` 픽스처를 새 필드로 교체 |

## 9. 문서

`README.md` 세 곳이 낡는다.

- 14~17행 기능 표 — "설명/별점/카테고리 입력"
- 26행 — "별점 / 카테고리 선택" 항목
- 93행 — `places` 테이블 컬럼 목록

## 10. 영향 파일

| 파일 | 작업 |
|---|---|
| `prisma/schema.prisma` | enum 추가, `title` 추가, `description`·`category` nullable, `rating` 제거 |
| `src/schemas/place.ts` | 공통 필드 추출, `rating` 제거, `category` enum화 |
| `src/lib/categories.ts` | 문자열 값, `풍경` 추가, `categoryLabel` 반환형 |
| `src/components/category-picker.tsx` | 문자열 값, 해제 가능, `flex-wrap` |
| `src/components/place-form.tsx` | 제목 필드 추가, 설명 선택, 별점 블록 제거 |
| `src/components/place-card.tsx` | 제목·설명 분리, 별 제거, `alt` 교체 |
| `src/components/place-explorer.tsx` | 팝업 제목·`alt` 교체 |
| `src/components/star-rating.tsx` | 삭제 |
| `src/lib/places.ts` | `clampRating` 삭제 |
| `src/schemas/place.test.ts` | 갱신 |
| `src/lib/places.test.ts` | 갱신 |
| `README.md` | 3개 지점 갱신 |
