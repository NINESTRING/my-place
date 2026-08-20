import "dotenv/config"
import { defineConfig } from "prisma/config"

/**
 * Prisma 7 은 .env 를 자동으로 읽지 않고, 접속 URL 도 schema.prisma 의
 * datasource 블록이 아니라 여기서 받는다. 그래서 dotenv/config 를 직접
 * import 한다 — 빼면 CLI 가 DATABASE_URL 을 찾지 못한다.
 *
 * env("DATABASE_URL") 헬퍼는 변수가 없으면 설정 로드 자체를 실패시킨다.
 * prisma generate 는 URL 이 필요 없는데도 함께 죽어서, .env 를 만들기 전
 * npm install(postinstall) 이 통째로 실패한다. 그래서 여기서는 비워 두고,
 * URL 이 실제로 필요한 db push·migrate 쪽에서 드러나게 둔다.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
})
