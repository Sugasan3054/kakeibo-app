export interface Release {
  version: string;
  date: string; // YYYY-MM-DD (JST)
  title: string;
  items: string[];
}

export const RELEASES: Release[] = [
  {
    version: '1.1.0',
    date: '2026-10-02',
    title: '予算シミュレーションを削除し、通知機能を追加しました',
    items: [
      'ホームの予算シミュレーションを削除しました',
      'ホーム右上のベルのボタンから、アプリの更新内容を確認できるようになりました',
      '設定画面で、バージョンと更新日を確認できるようになりました',
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0];

/**
 * 日付（YYYY-MM-DD）を「YYYY/MM/DD」形式にフォーマットする
 */
export function formatReleaseDate(dateStr: string): string {
  return dateStr.replace(/-/g, '/');
}
