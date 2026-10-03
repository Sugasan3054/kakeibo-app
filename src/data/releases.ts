export interface Release {
  version: string;
  date: string; // YYYY-MM-DD (JST)
  title: string;
  items: string[];
}

export const RELEASES: Release[] = [
  {
    version: '1.1.1',
    date: '2026-10-04',
    title: '残高がマイナスのときの表示とホーム画面の表示崩れを修正しました',
    items: [
      '口座画面で残高がマイナスのときに、正しい金額（−¥）と警告色で表示されるように修正しました',
      '残高がマイナスの口座カードに、確認を促す案内メッセージを表示するようにしました',
      'ホーム画面の総資産で、マイナス記号が正しく表示されるように表記を統一しました',
      'ホーム画面の円グラフ中央の文字が途中で折り返されないよう調整しました',
      '画面を一番下までスクロールしたときに、下部のメニューバーで内容が隠れないよう余白を調整しました',
    ],
  },
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
