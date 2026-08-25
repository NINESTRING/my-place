# 사용법 안내 도움말 — 설계

2026-08-25

## 목적

처음 들어온 사람이 무엇을 하는 앱인지, 무엇부터 눌러야 하는지 알 수 있게
한다. 지금은 지도와 아이콘 버튼 세 개뿐이라 설명이 하나도 없다.

특히 **위치 정보(EXIF GPS)가 없는 사진은 등록이 거부된다**는 제약이
"왜 등록이 안 되지?"로 이어지는 유일한 실패 지점이라, 안내가 실제로 값을
하는 자리다.

## 결정 사항

| 결정 | 선택 |
| --- | --- |
| 노출 방식 | 첫 방문 시 1회 자동 + 물음표 버튼으로 언제든 다시 |
| 내용 형식 | 한 모달에 단계별 목록 (슬라이드 아님) |
| 버튼 위치 | 오른쪽 위 조작 버튼 스택 맨 아래 |
| 공유 화면 | 넣지 않는다 |
| "다시 보지 않기" | 없음 — 닫으면 어차피 안 뜬다 |

기각한 대안:

- **슬라이드(다음/이전)** — 단계 상태와 진행 표시가 붙어 구현이 늘고,
  급한 사람은 끝까지 보지 않는다. 단계가 4개뿐이라 한 화면에 다 들어간다.
- **코치마크(실제 버튼 하이라이트)** — 버튼 좌표를 재어 띄워야 하고,
  버튼 구성이 로그인 여부·공유 화면에 따라 달라져 깨지기 쉽다.
- **공유 화면 안내** — 공유 화면은 마커 보기와 목록뿐이라 안내할 사용법이
  거의 없고, 로그인도 등록도 없는 화면에 "사진을 올리세요"가 나오면 오히려
  혼란스럽다.

## 1. `HelpDialog` — 표시 전용 컴포넌트

새 파일 `src/components/help-dialog.tsx`.

```ts
export function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element
```

상태를 갖지 않는다. 열림 여부와 "봤다" 표시는 전부 호출부(`PlaceExplorer`)가
가진다 — 이 앱의 다른 모달(`LoginDialog`, `SignOutDialog`)과 같은 계약이다.

모달 뼈대는 `LoginDialog` 를 그대로 따른다: `showCloseButton={false}` 에
`DialogClose` 를 직접 배치, `sm:max-w-sm`, 헤더는 `border-b`.

단계 목록은 파일 안 상수 배열 하나로 두고 렌더는 `.map` 이다:

```ts
const STEPS = [
  { icon: LogInIcon,        title: "Google 계정으로 로그인", body: ... },
  { icon: MapPinPlusIcon,   title: "사진으로 장소 등록",     body: ... },
  { icon: ListIcon,         title: "지도와 목록으로 보기",   body: ... },
  { icon: Share2Icon,       title: "카테고리와 공유",        body: ... },
]
```

아이콘은 **화면의 실제 버튼과 같은 것**을 쓴다(`LogIn`, `MapPinPlus`,
`List`). 설명과 눌러야 할 버튼이 눈으로 연결된다.

### 문구

| 아이콘 | 제목 | 설명 |
| --- | --- | --- |
| `LogIn` | Google 계정으로 로그인 | 처음이면 자동으로 가입됩니다. 등록한 장소는 나에게만 보입니다. |
| `MapPinPlus` | 사진으로 장소 등록 | 사진을 올리면 촬영 위치와 날짜를 읽어 지도에 핀을 꽂습니다. 위치 정보가 없는 사진은 등록되지 않습니다. |
| `List` | 지도와 목록으로 보기 | 마커를 누르면 사진이 뜨고, 목록에서 고르면 그 장소로 지도가 이동합니다. 목록은 `전체` / `지도 영역` 으로 범위를 고를 수 있습니다. |
| `Share2` | 카테고리와 공유 | 등록 폼에서 카테고리를 직접 만들고, `관리` 에서 카테고리별 공유 링크를 켤 수 있습니다. |

2번의 마지막 문장은 강조(`font-medium`)한다.

## 2. `PlaceExplorer` 연결

### 버튼

오른쪽 위 스택의 `isShare` 가 아닌 분기 **맨 아래**에 넣는다. 기존 버튼과
같은 모양(`variant="outline"`, `size-11 rounded-full shadow-lg`)에
`CircleQuestionMarkIcon`, `aria-label="사용법 안내"`.

로그인/로그아웃 버튼 뒤에 두는 이유는, 스택이 "자주 쓰는 것 → 가끔 쓰는 것"
순서이고 도움말이 가장 덜 눌리는 버튼이기 때문이다.

### 첫 방문 1회 자동 노출

이미 있는 `useLocalState` 를 그대로 쓴다.

```ts
const [helpSeen, setHelpSeen, helpHydrated] = useLocalState(
  "help-seen",
  false,
  !isShare        // 공유 화면에서는 브라우저에 아무것도 남기지 않는다
)
const [helpOpen, setHelpOpen] = useState(false)
```

`helpHydrated && !helpSeen` 이 되는 순간 한 번만 연다. `hydrated` 를 기다리는
것은, localStorage 읽기 전에 열어 버리면 재방문자에게 모달이 깜빡 보였다
사라지기 때문이다.

**표시는 닫을 때가 아니라 뜨는 순간에 남긴다.** 자동 노출은 "처음 들어왔을
때 딱 한 번"이므로, 모달을 열어 둔 채 새로고침해도 다시 뜨면 안 된다. 이
표시가 곧 재노출을 막는 자물쇠라서 `askedLocation` 같은 별도 ref 가 필요
없다 — 다음 렌더부터 `helpSeen` 이 true 라 위 검사에 걸리고, 서버 액션 뒤
`revalidatePath` 재렌더에서도 마찬가지다.

### 전제: `useLocalState` 는 읽기 전에 쓰지 않는다

이 기능은 저장값이 실제로 복원된다는 전제에 기댄다. 그런데 `useLocalState`
의 쓰기 effect 가 읽기를 기다리지 않아, Strict Mode(app router 기본값)로
effect 가 두 번 도는 개발 모드에서 저장값이 통째로 날아가고 있었다:

| | 동작 | localStorage |
| --- | --- | --- |
| 1차 읽기 | `"true"` 읽음 → `setValue(true)` 예약 | `"true"` |
| 1차 쓰기 | 클로저의 `value` 는 아직 초기값 `false` | **`"false"`** |
| 2차 읽기 | `"false"` 읽음 → `setValue(false)` 예약 | `"false"` |

큐의 뒤엣것이 이겨 최종값이 초기값이 된다. 운영 빌드는 effect 가 한 번뿐이라
다음 렌더의 쓰기로 자가 복구되지만, 읽기 전에 쓰는 것 자체가 잘못이다.
쓰기 effect 에 `hydrated` 검사를 넣어 고친다. 같은 버그로 개발 모드에서
`viewport`·`bounds` 도 복원되지 않고 있었으므로 함께 낫는다.

공유 화면(`isShare`)에서는 버튼도 모달도 렌더하지 않고, 자동 노출 effect 도
이르게 반환한다.

## 3. 하지 않는 것

- 슬라이드 / 진행 표시 / 코치마크
- 공유 화면 안내
- "다시 보지 않기" 체크박스 — 닫으면 어차피 안 뜨고, 버튼으로 언제든 다시 볼
  수 있다
- 도움말 전용 라우트 — 이 앱은 화면이 하나다

## 4. 검증

내용이 정적이고 상태가 불리언 하나라 새 유닛 테스트는 두지 않는다.
`npm run dev` 로 확인한다:

1. 처음 방문(localStorage 비움) → 모달이 자동으로 뜬다
2. 닫고 새로고침 → 뜨지 않는다
3. **열어 둔 채로** 새로고침 → 뜨지 않는다
4. 물음표 버튼 → 다시 열린다
5. `/share/<토큰>` → 물음표 버튼도 모달도 없다
6. 등록 저장 후 `revalidatePath` 재렌더 → 모달이 다시 열리지 않는다

기존 `npm run test` 는 그대로 통과해야 한다.
