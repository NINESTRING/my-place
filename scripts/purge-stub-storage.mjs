/**
 * 인증 이전 스텁 사용자가 올린 Storage 객체를 지운다. 1회성 스크립트다.
 *
 * 마이그레이션(20260820000000_drop_stub_user_places.sql)에서 하지 않는 이유는
 * storage.objects 를 SQL 로 지우면 메타데이터만 사라지고 실제 파일이 백엔드에
 * 남기 때문이다. 파일까지 지우려면 Storage API 를 써야 한다.
 *
 * 지우는 대상은 버킷 루트의 객체다. 인증이 붙은 뒤의 경로는 모두
 * `<userId>/<uuid>.<ext>` 이므로, 루트에 바로 놓인 객체는 정의상 스텁 시절의
 * 것이다. 따라서 이 스크립트는 인증 이후에 실행해도 새 사용자의 사진을
 * 건드리지 않는다.
 *
 *   node --env-file=.env scripts/purge-stub-storage.mjs
 */

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !secretKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 필요합니다. " +
      "node --env-file=.env scripts/purge-stub-storage.mjs 로 실행하세요."
  )
  process.exit(1)
}

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const bucket = supabase.storage.from("places")

const { data: entries, error: listError } = await bucket.list("", {
  limit: 1000,
})

if (listError) {
  console.error("목록 조회 실패:", listError.message)
  process.exit(1)
}

// list() 는 하위 폴더를 id 가 null 인 항목으로 돌려준다. 그것이 사용자별
// 폴더이므로 제외하고, 루트에 직접 놓인 파일만 고른다.
const stubFiles = entries.filter((entry) => entry.id !== null)

if (stubFiles.length === 0) {
  console.log("지울 스텁 객체가 없습니다.")
  process.exit(0)
}

const paths = stubFiles.map((file) => file.name)
console.log(`스텁 객체 ${paths.length}개를 지웁니다:`, paths)

const { error: removeError } = await bucket.remove(paths)

if (removeError) {
  console.error("삭제 실패:", removeError.message)
  process.exit(1)
}

console.log("완료.")
