"use client"

import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

/**
 * 세 번째 반환값 `hydrated`는 localStorage 읽기 effect가 실행됐는지를
 * 나타낸다. `initialViewState`처럼 마운트 시점에 한 번만 소비되는 값을
 * 다루는 호출부는, 이 값이 아직 기본값인 채로 자식이 먼저 마운트되는
 * 것을 막기 위해 hydrated가 true가 될 때까지 렌더링을 미뤄야 한다
 * (자식의 마운트 effect가 부모인 이 훅의 effect보다 먼저 실행되므로).
 */
export function useLocalState<S>(
  key: string,
  initial: S
): [S, Dispatch<SetStateAction<S>>, boolean] {
  const [value, setValue] = useState<S>(initial)
  const [hydrated, setHydrated] = useState(false)

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
    setHydrated(true)
  }, [key])

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue, hydrated]
}
