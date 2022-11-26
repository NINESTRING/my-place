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
