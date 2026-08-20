// maplibre-gl 6 은 워커를 별도 청크로 내보내고, 워커 URL 을 자기 모듈의
// import.meta.url 에서 유도한다. 그 값이 http(s) URL 이 아니면 빈 문자열을
//돌려주는데(dist/maplibre-gl.mjs 의 워커 URL 헬퍼), Turbopack 이 번들한
// 청크에서는 http URL 이 아니라 워커가 생성되지 않는다. 타일 fetch·파싱이
// 전부 워커에서 일어나므로 지도가 조용히 빈 화면이 된다.
//
// 그래서 워커 청크를 public/ 으로 복사해 http URL 로 서빙하고,
// place-explorer 가 setWorkerUrl 로 그 경로를 직접 지정한다. 워커 청크가
// ./maplibre-gl-shared.mjs 를 상대 경로로 import 하므로 shared 도 같은
// 디렉터리에 함께 둬야 한다.
import { copyFile, mkdir } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const require_ = createRequire(import.meta.url)
const dist = dirname(require_.resolve("maplibre-gl/dist/maplibre-gl.mjs"))
const target = join(process.cwd(), "public", "maplibre")

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]

await mkdir(target, { recursive: true })
for (const file of files) {
  await copyFile(join(dist, file), join(target, file))
}

console.log(`maplibre 워커 청크를 public/maplibre 로 복사했다: ${files.join(", ")}`)
