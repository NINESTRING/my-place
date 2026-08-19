export const CATEGORIES = [
  { value: 1, label: "카페" },
  { value: 2, label: "식당" },
  { value: 3, label: "숙소" },
  { value: 4, label: "명소" },
] as const

export function categoryLabel(value: number): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? "기타"
}
