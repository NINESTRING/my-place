# 사용자 정의 카테고리 + 다중 지정 — 설계

2026-08-24

## 목표

- 고정 5지선다(Prisma enum `PlaceCategory`)를 버리고, 사용자가 직접 이름을
  정해 만드는 카테고리로 바꾼다.
- 한 장소(사진)에 카테고리를 여러 개 지정할 수 있게 한다.

## 데이터 모델

enum 컬럼 하나를 사용자 스코프 테이블 + 다대다 조인으로 바꾼다.

```prisma
model Category {
  id        Int             @id @default(autoincrement())
  userId    String          @map("user_id")
  name      String
  createdAt DateTime        @default(now()) @map("created_at")
  places    PlaceCategory[]

  @@unique([userId, name])   // 같은 사용자 안에서 이름 중복 금지
  @@map("categories")
}

model PlaceCategory {        // 조인 테이블 (옛 enum 이름을 물려받음)
  placeId    Int      @map("place_id")
  categoryId Int      @map("category_id")
  place      Place    @relation(fields: [placeId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([placeId, categoryId])
  @@map("place_categories")
}
```

`Place.category`(enum, nullable) 컬럼과 enum 타입은 제거한다.

**명시적 조인 모델을 쓰는 이유** — Prisma 암시적 m-n 은 테이블·컬럼 이름을
바꿀 수 없어(`_CategoryToPlace`, `A`/`B`) 손으로 쓰는 데이터 이행 SQL 과 RLS
구문이 그 관례에 묶인다. 명시적 모델이면 이름 전부를 우리가 정한다.

**카테고리 삭제·이름 변경은 1차 범위 밖**이었고, 아래 [2차](#2차--카테고리-삭제이름-변경-같은-날-이어서)에서 이어서 다룬다.

## 데이터 이행

`supabase/migrations/20260824000000_user_categories.sql` 하나로 처리한다.

1. `categories` / `place_categories` 생성 (Prisma 가 `db push` 로 만들 DDL 과
   동일하게 — `prisma migrate diff` 산출물 기반)
2. 백필: `places.category` 가 있는 행에서 (user_id, 한국어 라벨) 쌍을
   `categories` 로, 각 행을 `place_categories` 로 복사.
   라벨 매핑은 기존 UI 그대로 — CAFE→카페, RESTAURANT→식당, STAY→숙소,
   ATTRACTION→명소, SCENERY→풍경.
3. `places.category` 컬럼과 `"PlaceCategory"` enum 타입 제거.
4. 두 새 테이블에 RLS 활성화 (기존 `places` 와 같은 정책-없음 구성).

백필과 컬럼 제거는 컬럼 존재 여부를 확인하는 DO 블록으로 감싸 재실행에
안전하게 만든다. **이 SQL 을 먼저 적용한 뒤** `prisma db push` 를 돌려야
한다 — 순서를 바꾸면 push 가 enum 컬럼을 백필 전에 지워 데이터가 사라진다.

## 검증 (Zod)

- `placeFields.category` → `categoryIds: number[]` (양의 정수, 최대 10개,
  중복은 transform 에서 제거). 빈 배열 = 미지정.
- 새 `categoryNameSchema`: trim 후 1–20자.

## 서버

- `lib/categories.server.ts` — `getCategories(userId)` (이름순),
  `ownsAllCategories(ids, userId)` (count 대조).
- `actions/category.ts` — `createCategoryAction(name)`: upsert 로 같은 이름을
  다시 만들면 기존 행을 돌려준다(멱등). `revalidatePath("/")`.
- `actions/place.ts` — 생성·수정 모두 제출된 categoryIds 의 소유를 확인.
  수정은 `prisma.place.update({ where: { id, userId }, data: { …,
  categories: { deleteMany: {}, create: … } } })` 로 기존 한 문장 인가
  패턴을 유지한다 (P2025 → NOT_FOUND).
- `places.server.ts` 조회는 조인을 include 하고
  `Place & { categories: { id, name }[] }` 로 평탄화해 돌려준다.

## 클라이언트

- `CategoryPicker` — `ToggleGroup multiple` (base-ui 가 지원) + 아래에
  "새 카테고리" 인라인 입력과 추가 버튼. Enter 는 폼 제출 대신 카테고리
  추가로 가로챈다. 추가 성공 시 목록에 넣고 곧바로 선택 상태로 만든다.
- 카테고리 목록은 `page.tsx` 가 `getCategories` 로 읽어
  `PlaceExplorer` prop 으로 내리고, Explorer 가 state 로 들고 추가 콜백으로
  append 한다 (이 클라이언트에서만 목록이 바뀌므로 재조회 불필요).
- `PlaceCard` 는 카테고리 이름들을 `·` 로 이어 기존 자리(날짜 오른쪽)에
  보여 준다.
- `Place` 를 받던 컴포넌트 타입은 `PlaceWithCategories` 로 바뀐다.
  `SerializedPlace`/`revivePlace` 는 categories 를 그대로 통과시킨다.

## 테스트

- `lib/categories.test.ts` 재작성 — `toCategoryIds`(ToggleGroup 문자열 →
  숫자 id), `sortCategories`, `categoryNames`.
- `schemas/category.test.ts` 신설 — 이름 trim·길이 규칙.
- `schemas/place.test.ts` — category → categoryIds 케이스 교체
  (빈 배열 허용, 중복 제거, 10개 초과·비정수 거부).

## 2차 — 카테고리 삭제·이름 변경 (같은 날 이어서)

### 서버 (2차)

- `updateCategoryAction({ id, name })` — `prisma.category.update({ where:
  { id, userId }, data: { name } })`. P2025 → "카테고리를 찾을 수 없습니다",
  P2002(사용자 안 이름 중복) → "이미 같은 이름의 카테고리가 있습니다".
  병합(중복 이름으로 바꾸면 두 카테고리를 합치기)은 하지 않는다 — 조인 이동과
  중복 정리가 따라오는 조용한 대량 변경이라, 거부하고 사용자가 고르게 한다.
- `deleteCategoryAction(id)` — `prisma.category.delete({ where: { id,
  userId } })`. 조인은 FK Cascade 가 지운다. 장소 행은 남는다.
- 스키마: `categoryIdSchema`(양의 정수), `categoryUpdateSchema`(id + 이름 규칙
  재사용).

### 클라이언트 (2차)

- `CategoryPicker` 에 "관리" 토글을 더한다(카테고리가 있을 때만). 켜면 선택
  칩 대신 관리 목록(`CategoryManager`)이 뜬다 — 행마다 이름·연필·휴지통.
  연필은 인라인 입력으로 바뀌고(Enter 저장 / Esc 취소, Enter 는 장소 폼 제출을
  가로챈다), 휴지통은 중첩 Dialog 로 한 번 확인한 뒤 지운다(장소에서도 함께
  사라진다는 안내 포함).
- 부모로 올라가는 콜백은 `onCategoriesChange(next)` 하나로 합친다. 생성·변경·
  삭제 각각의 콜백을 4단계로 내리꽂는 대신, 목록 변환은 순수 헬퍼
  (`withCategory`/`withRenamedCategory`/`withoutCategory`)로 picker 가 계산한다.
- 삭제 시 picker 는 폼 값(`categoryIds`)에서도 그 id 를 빼야 한다 — 남겨 두면
  제출이 ownsAllCategories 대조에서 실패한다.
- `PlaceExplorer` 의 `onCategoriesChange` 는 state 갱신과 함께 reloadToken 을
  올린다. 이름 변경·삭제는 카드에 찍힌 이름과 연결에도 반영되어야 하는데, 이
  화면의 장소 목록은 /api/places 로 오므로 재조회가 필요하다.

### 테스트 (2차)

- 목록 변환 헬퍼 3종, `categoryUpdateSchema`/`categoryIdSchema` 규칙.

## 3차 — 목록 카테고리 필터 (같은 날 이어서)

- `PlaceListPanel` 의 범위 토글 아래에 카테고리 칩(다중 선택)을 둔다.
  하나도 고르지 않으면 전체이고, 여러 개를 고르면 **그중 하나라도** 가진
  장소가 남는다(OR). 교집합(AND)은 다중 카테고리 장소가 드문 개인 기록에서
  대부분 빈 목록만 만든다.
- 필터는 서버가 아니라 클라이언트에서 건다 — 목록이 이미
  `PlaceWithCategories[]` 를 들고 있고, 개인 기록 규모(수백 건)에서 재조회로
  얻는 것이 없다. 지도 마커에는 적용하지 않는다("리스트에서" 보는 기능이다).
- 필터 선택 상태는 패널 로컬 state 로 둔다. 삭제된 카테고리 id 가 선택에
  남는 문제는 동기화 effect 대신, 렌더 시점에 현재 카테고리 목록과 교집합만
  쓰는 것으로 푼다 — 칩이 사라진 id 는 자동으로 무시된다.
- 순수 헬퍼 `filterByCategories(places, ids)` (빈 ids = 통과) + 테스트.
- 헤더의 "N곳" 은 필터를 거친 수를 보여 준다. 필터 때문에 빈 목록이 되면
  범위별 빈 문구 대신 "고른 카테고리의 장소가 없습니다" 를 띄운다.
