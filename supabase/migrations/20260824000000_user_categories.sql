-- 고정 enum 카테고리를 사용자 정의 카테고리(다대다)로 바꾼다.
--
-- 반드시 `prisma db push` 보다 먼저 적용해야 한다. push 를 먼저 돌리면
-- 새 스키마에 없는 places.category 컬럼을 백필 전에 지워 버려, 어떤
-- 카테고리를 골랐었는지가 사라진다. 이 SQL 을 적용하고 나면 스키마가 이미
-- prisma/schema.prisma 와 같아서 push 는 할 일이 없다.
--
-- DDL 은 `prisma migrate diff --script` 산출물 그대로이고(테이블·인덱스·FK
-- 이름이 Prisma 관례와 일치해야 이후 push 가 차이를 보지 않는다), 그 사이에
-- 백필만 끼워 넣었다. 백필과 컬럼 제거는 컬럼 존재 검사로 감싸 재실행에
-- 안전하다.

-- CreateTable
CREATE TABLE IF NOT EXISTS "categories" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "place_categories" (
    "place_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "place_categories_pkey" PRIMARY KEY ("place_id","category_id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "categories_user_id_name_key" ON "categories"("user_id", "name");

-- AddForeignKey (IF NOT EXISTS 가 없는 구문이라 DO 블록으로 감싼다)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'place_categories_place_id_fkey'
  ) THEN
    ALTER TABLE "place_categories" ADD CONSTRAINT "place_categories_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'place_categories_category_id_fkey'
  ) THEN
    ALTER TABLE "place_categories" ADD CONSTRAINT "place_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 백필 + 옛 컬럼 제거. enum 값의 한국어 라벨은 지금까지 UI 가 보여 주던
-- 것(src/lib/categories.ts)과 같다 — 사용자 눈에는 아무것도 바뀌지 않는다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'places' AND column_name = 'category'
  ) THEN
    INSERT INTO "categories" ("user_id", "name")
    SELECT DISTINCT p."user_id",
           CASE p."category"::text
             WHEN 'CAFE' THEN '카페'
             WHEN 'RESTAURANT' THEN '식당'
             WHEN 'STAY' THEN '숙소'
             WHEN 'ATTRACTION' THEN '명소'
             WHEN 'SCENERY' THEN '풍경'
           END
    FROM "places" p
    WHERE p."category" IS NOT NULL
    ON CONFLICT ("user_id", "name") DO NOTHING;

    INSERT INTO "place_categories" ("place_id", "category_id")
    SELECT p."id", c."id"
    FROM "places" p
    JOIN "categories" c
      ON c."user_id" = p."user_id"
     AND c."name" = CASE p."category"::text
                      WHEN 'CAFE' THEN '카페'
                      WHEN 'RESTAURANT' THEN '식당'
                      WHEN 'STAY' THEN '숙소'
                      WHEN 'ATTRACTION' THEN '명소'
                      WHEN 'SCENERY' THEN '풍경'
                    END
    WHERE p."category" IS NOT NULL
    ON CONFLICT DO NOTHING;

    ALTER TABLE "places" DROP COLUMN "category";
  END IF;
END $$;

-- DropEnum
DROP TYPE IF EXISTS "PlaceCategory";

-- places 와 같은 구성: RLS 는 켜되 정책은 만들지 않는다. Prisma 는 테이블
-- 소유자 롤로 접속해 우회하고, anon/authenticated 롤은 Data API 로 이
-- 테이블에 접근할 수 없다.
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "place_categories" ENABLE ROW LEVEL SECURITY;
