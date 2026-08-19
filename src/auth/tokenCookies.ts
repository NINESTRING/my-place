/**
 * 주의: 이 파일의 setTokenCookie/removeTokenCookie 는 /api/login,
 * /api/logout 으로 요청하지만 해당 라우트는 존재하지 않는다.
 * App Router 이전 시 pages/api 와 함께 삭제되었고, 인증 구현은
 * 이번 마이그레이션 스코프에서 제외되었다.
 * 인증을 붙일 때 Route Handler 로 다시 만들고 src/lib/auth.ts 의
 * getCurrentUserId 를 실제 구현으로 바꾼다.
 */
import cookies from "js-cookie";

export const getTokenCookie = () => cookies.get("token");

export const setTokenCookie = (token: string) => {
  fetch("/api/login", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
};

export const removeTokenCookie = () => {
  fetch("/api/logout", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
};
