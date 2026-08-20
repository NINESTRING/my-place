"use client"

import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

/**
 * 반환값은 `[값, setter, hydrated, restored]` 다.
 *
 * 네 번째 `restored`는 localStorage 에 값이 실제로 들어 있어서 그것으로
 * 덮어썼는지, 즉 "전에 와 본 사용자인지"를 뜻한다. 첫 진입에만 하고 싶은
 * 일(예: 위치 권한 묻기)을 가려내는 쪽이 쓴다. 저장값이 마침 기본값과
 * 같을 수도 있으므로 값 비교로는 대신할 수 없다.
 *
 * 세 번째 반환값 `hydrated`는 localStorage 읽기 effect가 실행됐는지를
 * 나타낸다. `initialViewState`처럼 마운트 시점에 한 번만 소비되는 값을
 * 다루는 호출부는, 이 값이 아직 기본값인 채로 자식이 먼저 마운트되는
 * 것을 막기 위해 hydrated가 true가 될 때까지 렌더링을 미뤄야 한다
 * (자식의 마운트 effect가 부모인 이 훅의 effect보다 먼저 실행되므로).
 */
export function useLocalState<S>(
  key: string,
  initial: S
): [S, Dispatch<SetStateAction<S>>, boolean, boolean] {
  const [value, setValue] = useState<S>(initial)
  const [hydrated, setHydrated] = useState(false)
  const [restored, setRestored] = useState(false)

  // 서버 렌더 결과와 어긋나지 않도록 마운트 이후에 읽는다.
  useEffect(() => {
    const saved = window.localStorage.getItem(key)
    if (saved !== null) {
      try {
        setValue(JSON.parse(saved) as S)
        setRestored(true)
      } catch {
        window.localStorage.removeItem(key)
      }
    }
    setHydrated(true)
  }, [key])

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue, hydrated, restored]
}
