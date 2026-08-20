"use client"

// maplibre-gl 6 은 워커를 별도 청크로 내보내고 그 URL 을 자기 모듈의
// import.meta.url 에서 유도한다. 그 값이 http(s) URL 이 아니면 빈 문자열을
// 돌려주는데(dist/maplibre-gl.mjs 의 워커 URL 헬퍼 참고), Turbopack 이 번들한
// 청크에서는 http URL 이 아니라 워커가 아예 생성되지 않는다. 타일 fetch 와
// 파싱은 전부 워커에서 일어나므로, 예외 하나 없이 지도만 빈 화면이 된다.
//
// 그래서 워커 청크를 public/maplibre 로 복사해 두고(scripts/
// copy-maplibre-worker.mjs, predev·prebuild 에서 실행) 그 http 경로를
// setWorkerUrl 로 직접 지정한다. Map 이 마운트되기 전에 정해져야 하므로
// 모듈 최상단에서 부른다. src/lib/deps.test.ts 가 복사본이 빠지거나
// 낡는 것을 막는다.
import "maplibre-gl/dist/maplibre-gl.css"
import { setWorkerUrl } from "maplibre-gl"

import type { Place } from "@/generated/prisma/client"
import { ListIcon, LogInIcon, LogOutIcon, MapPinPlusIcon } from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Map, {
  Marker,
  Popup,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre"
import { toast } from "sonner"
import { useDebounce } from "use-debounce"
import { signOutAction } from "@/actions/auth"
import { deletePlaceAction } from "@/actions/place"
import { CreatePlaceDialog } from "@/components/create-place-dialog"
import { DeletePlaceDialog } from "@/components/delete-place-dialog"
import { EditPlaceDialog } from "@/components/edit-place-dialog"
import { LoginDialog, type LoginReason } from "@/components/login-dialog"
import {
  PlaceListPanel,
  type PlaceListScope,
} from "@/components/place-list-panel"
import { SignOutDialog } from "@/components/sign-out-dialog"
import { Button } from "@/components/ui/button"
import { useLastData } from "@/hooks/use-last-data"
import { useLocalState } from "@/hooks/use-local-state"
import { publicImageUrl } from "@/lib/images"
import { revivePlace, type SerializedPlace } from "@/lib/places"
import type { Bounds, PlaceFormValues } from "@/schemas/place"

if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")
}

type Viewport = { latitude: number; longitude: number; zoom: number }

const DEFAULT_VIEWPORT: Viewport = {
  latitude: 37.65874,
  longitude: 126.97759,
  zoom: 10,
}

// 앱 전체가 이 한 화면이므로 지도가 뷰포트를 그대로 채운다. 목록 패널과 조작
// 버튼은 이 컨테이너를 기준으로 절대 배치되므로 relative 가 필요하다.
const SHELL_CLASS = "relative h-dvh w-full overflow-hidden"

// 목록에서 장소를 고를 때 최소한 이 정도까지는 확대한다.
const FOCUS_ZOOM = 14

function toQuery(bounds: Bounds): string {
  return new URLSearchParams({
    swLat: String(bounds.sw.latitude),
    swLng: String(bounds.sw.longitude),
    neLat: String(bounds.ne.latitude),
    neLng: String(bounds.ne.longitude),
  }).toString()
}

/**
 * /api/places 한 번 호출. 지도 영역 조회와 전체 조회가 실패 처리를 그대로
 * 공유하므로 여기 모아 둔다. 중단이나 오류면 null 을 돌려주고, 호출부는
 * 가지고 있던 목록을 그대로 둔다.
 */
async function fetchPlaces(
  query: string,
  signal: AbortSignal
): Promise<Place[] | null> {
  try {
    const res = await fetch(`/api/places?${query}`, { signal })
    if (!res.ok) return null
    const json = (await res.json()) as { places: SerializedPlace[] }
    return json.places.map(revivePlace)
  } catch {
    // 중단되었거나 네트워크 오류.
    return null
  }
}

export function PlaceExplorer({
  initialPlaces,
  initialBounds,
  isAuthenticated,
}: {
  initialPlaces: Place[]
  initialBounds: Bounds
  isAuthenticated: boolean
}) {
  const mapRef = useRef<MapRef>(null)
  const panelRef = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState<Place | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [listScope, setListScope] = useState<PlaceListScope>("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [loginReason, setLoginReason] = useState<LoginReason>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, startSignOut] = useTransition()
  const [deleting, setDeleting] = useState<Place | null>(null)
  const [deletePending, startDelete] = useTransition()
  const [editing, setEditing] = useState<Place | null>(null)
  const [viewport, setViewport, viewportHydrated] = useLocalState<Viewport>(
    "viewport",
    DEFAULT_VIEWPORT
  )
  const [bounds, setBounds] = useLocalState<Bounds>("bounds", initialBounds)

  // 옛 버전은 bounds 를 "[[lng,lat],[lng,lat]]" 문자열로 저장했다.
  // 형식이 맞지 않으면 초기값으로 되돌린다.
  useEffect(() => {
    const malformed =
      typeof bounds?.sw?.latitude !== "number" ||
      typeof bounds?.ne?.latitude !== "number"
    if (malformed) {
      setBounds(initialBounds)
    }
  }, [bounds, initialBounds, setBounds])

  const [debouncedBounds] = useDebounce(bounds, 1000)
  const [places, setPlaces] = useState<Place[] | null>(initialPlaces)
  const shownPlaces = useLastData(places) ?? []

  // 목록 패널의 기본 범위인 "내가 등록한 모든 장소". 마커용 bounds 조회와
  // 달리 지도를 움직여도 다시 부르지 않으므로 따로 들고 있는다. null 은 아직
  // 못 불러왔다는 뜻이고, 패널이 그 상태를 "장소 없음"과 갈라 보여 준다.
  const [allPlaces, setAllPlaces] = useState<Place[] | null>(null)
  const everyPlace = useLastData(allPlaces)

  // 저장 직후처럼 bounds 는 그대로인데 서버 데이터만 바뀐 경우를 위한 값이다.
  // 이 화면의 장소 목록은 RSC 가 아니라 /api/places 로 가져오므로
  // router.refresh() 로는 갱신되지 않는다.
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    void fetchPlaces(toQuery(debouncedBounds), controller.signal).then(
      (next) => {
        if (next) setPlaces(next)
      }
    )

    return () => controller.abort()
  }, [debouncedBounds, reloadToken])

  useEffect(() => {
    // 미인증이면 서버가 어차피 빈 목록을 준다. 요청을 아끼는 동시에,
    // 로그아웃 직후 남아 있던 남의 목록을 이 자리에서 비운다.
    if (!isAuthenticated) {
      setAllPlaces([])
      return
    }

    const controller = new AbortController()

    void fetchPlaces("scope=all", controller.signal).then((next) => {
      if (next) setAllPlaces(next)
    })

    return () => controller.abort()
  }, [isAuthenticated, reloadToken])

  const onMoveEnd = (e: ViewStateChangeEvent) => {
    const b = e.target.getBounds()
    if (b) {
      setBounds({
        sw: { latitude: b.getSouth(), longitude: b.getWest() },
        ne: { latitude: b.getNorth(), longitude: b.getEast() },
      })
    }
    setViewport({
      latitude: e.viewState.latitude,
      longitude: e.viewState.longitude,
      zoom: e.viewState.zoom,
    })
  }

  const flyTo = useCallback(
    (target: { latitude: number; longitude: number }) => {
      const map = mapRef.current
      if (!map) return

      // 목록 패널이 열려 있으면 지도의 왼쪽 일부가 가려진다. 목표 지점을 패널
      // 너비의 절반만큼 오른쪽으로 밀어서 "보이는 영역"의 가운데에 오게 한다.
      // padding 옵션과 달리 offset 은 이 애니메이션에만 적용되므로 이후
      // getBounds() 계산에 잔여 효과가 남지 않는다.
      const hidden = listOpen ? (panelRef.current?.offsetWidth ?? 0) : 0

      map.flyTo({
        center: [target.longitude, target.latitude],
        zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
        offset: [hidden / 2, 0],
        duration: 800,
      })
    },
    [listOpen]
  )

  const onSelectFromList = (place: Place) => {
    setSelected(place)
    flyTo(place)
  }

  const onCreated = (place: { latitude: number; longitude: number }) => {
    setCreateOpen(false)
    // 새 장소가 지금 보이는 영역 밖일 수도 있고, 안이라면 bounds 가 바뀌지 않아
    // 재조회가 걸리지 않는다. 두 경우 모두 커버하려고 토큰을 올린다.
    setReloadToken((n) => n + 1)
    flyTo(place)
  }

  /**
   * 로그인이 필요한 동작을 감싼다. 미인증이면 왜 막혔는지를 담아 로그인
   * 모달을 연다.
   *
   * 등록·목록 버튼을 disabled 로 두지 않는 것이 의도적이다. 비활성 버튼은
   * 눌리지 않으므로 왜 쓸 수 없는지 설명할 기회가 없다.
   */
  const gated = (reason: Exclude<LoginReason, null>, run: () => void) => {
    if (isAuthenticated) {
      run()
      return
    }
    setLoginReason(reason)
    setLoginOpen(true)
  }

  const onUpdated = (id: number, values: PlaceFormValues) => {
    setEditing(null)
    // 재조회는 디바운스와 네트워크를 거친다. 그동안 팝업이 옛 제목을 들고
    // 있으면 방금 고친 값이 그대로인 것처럼 보인다. 선택된 장소만 먼저
    // 겹쳐 쓴다. description 은 폼이 undefined 로 접어 오므로 DB 표현인
    // null 로 되돌린다.
    setSelected((prev) =>
      prev?.id === id
        ? { ...prev, ...values, description: values.description ?? null }
        : prev
    )
    setReloadToken((n) => n + 1)
  }

  const onDeleteConfirmed = () => {
    const target = deleting
    if (!target) return

    startDelete(async () => {
      try {
        const result = await deletePlaceAction(target.id)
        if (!result.ok) {
          toast.error(result.error)
          return
        }

        setDeleting(null)
        // 지운 장소의 팝업이 떠 있으면 참조가 사라진 카드가 지도에 남는다.
        setSelected((prev) => (prev?.id === target.id ? null : prev))
        // 이 화면의 목록은 RSC 가 아니라 /api/places 로 가져오므로
        // revalidatePath 로는 갱신되지 않는다. 토큰을 올려 다시 부른다.
        setReloadToken((n) => n + 1)
        toast.success("장소를 삭제했습니다.")
      } catch {
        // useTransition 은 reject 해도 isPending 을 풀어 주므로 모달이
        // 잠기지는 않는다. 하지만 감싸지 않으면 사용자는 아무 안내도 없이
        // 그냥 실패를 겪는다.
        toast.error("삭제 중 문제가 발생했습니다.")
      }
    })
  }

  const onSignOutConfirmed = () => {
    startSignOut(async () => {
      await signOutAction()
      // 서버 액션이 revalidatePath 로 RSC 를 무효화하지만, 이 컴포넌트의
      // places 는 useState 초기값이라 prop 이 바뀌어도 갱신되지 않는다.
      // /api/places 를 다시 부르게 해서 빈 목록을 받아 온다.
      setSelected(null)
      setListOpen(false)
      setReloadToken((n) => n + 1)
      setSignOutOpen(false)
    })
  }

  return (
    <div className={SHELL_CLASS}>
      {/* Map의 initialViewState는 마운트 시점에 한 번만 적용되고 이후로는
          다시 읽지 않는다(react-map-gl v8, node_modules/@vis.gl/react-maplibre
          내부 _initialize/_updateViewState 참고). 자식(Map)의 마운트 effect는
          부모인 이 컴포넌트의 effect(=localStorage 읽기)보다 먼저 실행되므로,
          hydrated 이전에 Map을 마운트하면 항상 DEFAULT_VIEWPORT로 굳어져
          저장된 위치로 복원되지 않는다. hydrated가 될 때까지 같은 크기의
          빈 자리만 렌더링해 Map 마운트를 미룬다. 서버와 첫 클라이언트 렌더는
          항상 이 분기를 타므로 하이드레이션 불일치도 생기지 않는다. */}
      {viewportHydrated ? (
        <Map
          ref={mapRef}
          initialViewState={viewport}
          onMoveEnd={onMoveEnd}
          // 지도의 빈 곳을 누르면 팝업의 x 를 누른 것과 같이 닫는다. 마커
          // 클릭은 아래에서 전파를 끊으므로 여기까지 오지 않는다.
          onClick={() => setSelected(null)}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          style={{ width: "100%", height: "100%" }}
        >
          {shownPlaces.map((place) => (
            <Marker
              key={place.id}
              latitude={place.latitude}
              longitude={place.longitude}
              color="#ef4444"
              onClick={(e) => {
                // 마커 엘리먼트는 지도의 캔버스 컨테이너 안에 붙고(maplibre
                // Marker.addTo 참고) 지도의 click 리스너도 같은 컨테이너에
                // 걸린다. 전파를 끊지 않으면 마커를 고른 직후 Map 의
                // onClick 이 곧바로 선택을 지운다.
                e.originalEvent.stopPropagation()
                setSelected(place)
              }}
            />
          ))}

          {selected && (
            <Popup
              latitude={selected.latitude}
              longitude={selected.longitude}
              onClose={() => setSelected(null)}
              closeOnClick={false}
              maxWidth="260px"
            >
              {/* maplibre 는 팝업 컨테이너에 max-width 만 걸고 폭은
                  shrink-to-fit 으로 둔다. 폭을 정하는 것이 사실상 제목
                  한 줄뿐이라 그냥 두면 장소마다 팝업 크기가 달라진다.
                  내용 폭을 고정해서 항상 같은 크기로 뜨게 한다.
                  (240px + 좌우 패딩 10px = 위 maxWidth 260px) */}
              <div className="w-60 space-y-2">
                {/* 닫기 버튼이 오른쪽 위 모서리를 차지하므로 그만큼 자리를
                    비워 두고, 넘치는 제목은 두 줄로 흐르는 대신 말줄임한다. */}
                <p className="truncate pr-7 font-medium">{selected.title}</p>
                <div className="relative aspect-square w-full overflow-hidden rounded">
                  <Image
                    src={publicImageUrl(selected.image)}
                    alt={selected.title}
                    fill
                    sizes="240px"
                    className="object-cover"
                  />
                </div>
              </div>
            </Popup>
          )}
        </Map>
      ) : (
        <div className="bg-muted h-full w-full" />
      )}

      {/* 조작 버튼은 오른쪽 위 모서리에 둔다. 목록 패널은 왼쪽에서 나오므로
          열려 있어도 버튼을 가리지 않고, 지도 저작권 표시(오른쪽 아래)와도
          겹치지 않는다. */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
        <Button
          onClick={() => gated("create", () => setCreateOpen(true))}
          aria-label="장소 등록"
          className="size-11 rounded-full shadow-lg"
        >
          <MapPinPlusIcon className="size-5" />
        </Button>
        <Button
          variant="outline"
          onClick={() => gated("list", () => setListOpen((open) => !open))}
          aria-label="장소 목록"
          aria-pressed={listOpen}
          className="size-11 rounded-full shadow-lg"
        >
          <ListIcon className="size-5" />
        </Button>

        {isAuthenticated ? (
          <Button
            variant="outline"
            onClick={() => setSignOutOpen(true)}
            aria-label="로그아웃"
            className="size-11 rounded-full shadow-lg"
          >
            <LogOutIcon className="size-5" />
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setLoginReason(null)
              setLoginOpen(true)
            }}
            aria-label="로그인"
            className="size-11 rounded-full shadow-lg"
          >
            <LogInIcon className="size-5" />
          </Button>
        )}
      </div>

      <PlaceListPanel
        ref={panelRef}
        open={listOpen}
        places={listScope === "map" ? shownPlaces : everyPlace}
        scope={listScope}
        onScopeChange={setListScope}
        selectedId={selected?.id ?? null}
        onSelect={onSelectFromList}
        onEdit={setEditing}
        onDelete={setDeleting}
        onClose={() => setListOpen(false)}
      />

      <CreatePlaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onCreated}
      />

      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        reason={loginReason}
      />

      <SignOutDialog
        open={signOutOpen}
        // 로그아웃 진행 중에는 바깥 클릭·Esc 로 닫히지 않게 한다. 닫혀도
        // 액션은 계속 진행되므로 "취소한 것처럼 보이는데 로그아웃되는" 상태가
        // 생긴다.
        onOpenChange={(next) => {
          if (!signingOut) setSignOutOpen(next)
        }}
        onConfirm={onSignOutConfirmed}
        pending={signingOut}
      />

      <EditPlaceDialog
        place={editing}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
        onUpdated={onUpdated}
      />

      <DeletePlaceDialog
        open={deleting !== null}
        title={deleting?.title ?? ""}
        // 삭제가 진행 중일 때는 바깥 클릭·Esc 로 닫히지 않게 한다. 닫혀도
        // 액션은 계속 진행되므로 "취소한 것처럼 보이는데 지워지는" 상태가
        // 생긴다. 로그아웃 모달과 같은 처리다.
        onOpenChange={(next) => {
          if (!deletePending && !next) setDeleting(null)
        }}
        onConfirm={onDeleteConfirmed}
        pending={deletePending}
      />
    </div>
  )
}
