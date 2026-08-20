import { describe, expect, it } from "vitest"
import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const require_ = createRequire(import.meta.url)

/**
 * 의존성 버전 가드.
 *
 * 여기 있는 제약은 브라우저에서만 드러나는 실패를 막는다. 단위 테스트도
 * 타입 체크도 빌드도 통과하는데 화면만 비는 종류라, 사람이 브라우저를 열기
 * 전까지 아무도 모른다.
 *
 * maplibre-gl 6 은 워커를 별도 청크로 내보내고 그 URL 을 자기 모듈의
 * import.meta.url 에서 유도한다. Turbopack 이 번들한 청크에서는 그 값이
 * http URL 이 아니라 워커 URL 이 "" 가 되고, 문서 경로로 해석된 워커는
 * 아무 일도 하지 못한다. 타일 fetch 와 파싱이 전부 워커에서 일어나므로
 * 예외 하나 없이 지도만 빈 화면이 된다.
 *
 * 그래서 워커 청크를 public/maplibre 로 복사해(scripts/
 * copy-maplibre-worker.mjs) setWorkerUrl 로 직접 지정한다. 이 테스트는 그
 * 배선이 끊기는 두 경우를 잡는다 — 복사본이 없거나, maplibre 를 올리고
 * 복사를 안 해서 낡은 워커가 남는 경우.
 */
describe("maplibre-gl 워커 청크 배선", () => {
  const dist = join(
    require_.resolve("maplibre-gl/dist/maplibre-gl.mjs"),
    ".."
  )
  const copied = join(process.cwd(), "public", "maplibre")
  const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]

  it.each(files)(
    "public/maplibre/%s 가 설치된 dist 와 같아야 한다",
    (file) => {
      const message = [
        `public/maplibre/${file} 가 없거나 node_modules 의 dist 와 다릅니다.`,
        "",
        "node scripts/copy-maplibre-worker.mjs 를 실행하세요",
        "(predev·prebuild·postinstall 이 대신 실행합니다).",
        "",
        "워커 청크가 낡으면 maplibre 가 조용히 실패한다 — 스타일과 스프라이트는",
        "200 으로 오지만 벡터 타일 요청이 0건이 되어 지도만 빈 화면이 된다.",
      ].join("\n")

      let actual: Buffer | null = null
      try {
        actual = readFileSync(join(copied, file))
      } catch {
        actual = null
      }

      expect(actual, message).not.toBeNull()
      expect(actual?.equals(readFileSync(join(dist, file))), message).toBe(true)
    }
  )

  it("place-explorer 가 setWorkerUrl 로 그 경로를 지정해야 한다", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "components", "place-explorer.tsx"),
      "utf8"
    )

    expect(
      source.includes('setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")'),
      [
        "place-explorer 에서 setWorkerUrl 호출이 사라졌습니다.",
        "이 호출이 없으면 워커 URL 이 문서 경로로 잡히고 타일이 아예",
        "요청되지 않는다 — 예외도 나지 않으므로 빌드와 테스트는 통과한다.",
      ].join("\n")
    ).toBe(true)
  })
})
