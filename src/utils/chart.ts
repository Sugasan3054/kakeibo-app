export interface ChartCategoryItem {
  id: string;
  name: string;
  value: number;
  color: string;
  order?: number;
}

/**
 * 円グラフおよび内訳一覧用のデータ並び替え関数
 * 1. 金額が0円以下の分類は除外
 * 2. 金額の大きい順（降順）に並べ替え
 * 3. 金額が同じ分類は、分類の表示順（orderの昇順）で並べ替え
 */
export function sortByAmountDesc<T extends { value: number; order?: number }>(items: T[]): T[] {
  return items
    .filter((item) => item.value > 0)
    .sort((a, b) => {
      if (b.value !== a.value) {
        return b.value - a.value;
      }
      return (a.order ?? 0) - (b.order ?? 0);
    });
}
