"use client"

import { useRef } from "react"

/** 재조회 중 이전 데이터를 유지해 지도가 비지 않게 한다. */
export function useLastData<S>(data: S): S {
  const ref = useRef(data)
  if (data !== null && data !== undefined) {
    ref.current = data
  }
  return ref.current
}
