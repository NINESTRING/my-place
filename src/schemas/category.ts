import { z } from "zod"

/**
 * 카테고리 이름. trim 을 min 앞에 두는 이유는 제목과 같다 — 공백만 있는
 * 입력이 min(1)을 통과해 보이지 않는 카테고리가 생기는 것을 막는다.
 *
 * 상한 20자는 카드·팝업에서 라벨 여러 개가 한 줄에 놓이는 것을 감안한
 * 값이다. 문장이 아니라 이름을 받는 자리다.
 */
export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "카테고리 이름을 입력해 주세요")
  .max(20, "카테고리 이름은 20자까지 쓸 수 있습니다")

/**
 * 행 식별자. placeIdSchema 와 같은 이유로 z.coerce 를 쓰지 않는다 — 액션
 * 인자는 클라이언트가 보낸 값이고, 강제 변환은 null·""·[] 을 0 으로 접는다.
 */
export const categoryIdSchema = z.number().int().positive()

/** 이름 변경 액션의 입력. 이름 규칙은 생성과 같은 스키마를 그대로 쓴다. */
export const categoryUpdateSchema = z.object({
  id: categoryIdSchema,
  name: categoryNameSchema,
})
