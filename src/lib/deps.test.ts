import { describe, expect, it } from "vitest"
import { createRequire } from "node:module"

const require_ = createRequire(import.meta.url)

/**
 * 의존성 버전 가드.
 *
 * 여기 있는 제약은 브라우저에서만 드러나는 실패를 막는다. 단위 테스트도
 * 타입 체크도 빌드도 통과하는데 화면만 비는 종류라, 사람이 브라우저를 열기
 * 전까지 아무도 모른다. 그래서 버전 자체를 단정한다.
 */
describe("maplibre-gl 메이저 버전", () => {
  it("5.x 여야 한다", () => {
    const { version } = require_("maplibre-gl/package.json") as {
      version: string
    }
    const major = Number(version.split(".")[0])

    expect(
      major,
      [
        `설치된 maplibre-gl 이 ${version} 입니다. 5.x 로 되돌려 주세요.`,
        "",
        "6.x 는 워커 URL 을 import.meta.url 에서 유도하고, 그 값이 http(s)",
        "URL 이 아니면 빈 문자열을 반환한다. Turbopack 이 번들한 청크에서는",
        "http URL 이 아니므로 워커 URL 이 \"\" 가 되어 현재 문서 경로로",
        "해석되고, dev 서버가 HTML 을 돌려주어 워커가 죽는다. 타일 fetch 와",
        "파싱은 전부 워커에서 일어나므로 스타일·스프라이트만 로드된 채 지도가",
        "빈 화면이 된다. 예외가 나지 않아 조용히 실패한다.",
        "",
        "5.x 는 워커를 인라인 Blob 으로 만들어 번들러에 무관하게 동작한다.",
        "6.x 로 올리려면 setWorkerUrl(react-map-gl 의 workerUrl prop)로 워커를",
        "직접 지정해야 하며, 올린 뒤 반드시 브라우저에서 타일이 실제로 그려지는지",
        "확인해야 한다 — 이 테스트와 빌드만으로는 잡히지 않는다.",
      ].join("\n")
    ).toBe(5)
  })
})
