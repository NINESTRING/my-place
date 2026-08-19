"use client"

import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

export function useLocalState<S>(
  key: string,
  initial: S
): [S, Dispatch<SetStateAction<S>>] {
  const [value, setValue] = useState<S>(initial)

  // 서버 렌더 결과와 어긋나지 않도록 마운트 이후에 읽는다.
  useEffect(() => {
    const saved = window.localStorage.getItem(key)
    if (saved !== null) {
      try {
        setValue(JSON.parse(saved) as S)
      } catch {
        window.localStorage.removeItem(key)
      }
    }
  }, [key])

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}
