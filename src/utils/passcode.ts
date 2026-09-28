import type { KakeiboDB } from '../db/database';
import { verifyPasscode, decryptData } from './crypto';

export const MAX_LOCK_WAIT_SECONDS = 15 * 60; // 上限15分（900秒）
export const LOCK_TRIGGER_ATTEMPTS = 5; // 5回連続誤入力でロック開始
export const INITIAL_LOCK_WAIT_SECONDS = 30; // 初回ロック待ち時間30秒

/**
 * 連続誤入力回数からロック待ち時間（秒）を計算する
 * 5回目で30秒、以降誤入力ごとに倍増し、上限15分(900秒)とする
 */
export function calculateLockWaitSeconds(failedAttempts: number): number {
  if (failedAttempts < LOCK_TRIGGER_ATTEMPTS) {
    return 0;
  }
  const multiplier = Math.pow(2, failedAttempts - LOCK_TRIGGER_ATTEMPTS);
  const waitSeconds = INITIAL_LOCK_WAIT_SECONDS * multiplier;
  return Math.min(waitSeconds, MAX_LOCK_WAIT_SECONDS);
}

/**
 * ロック解除予定日時から残りの待ち秒数を計算する
 */
export function getRemainingLockSeconds(
  lockedUntil: string | null | undefined,
  nowMs: number = Date.now()
): number {
  if (!lockedUntil) return 0;
  const lockTime = new Date(lockedUntil).getTime();
  if (isNaN(lockTime) || lockTime <= nowMs) {
    return 0;
  }
  return Math.ceil((lockTime - nowMs) / 1000);
}

/**
 * 文字列が暗号化データかどうか判定する
 * 'enc:...' プレフィックス、または 'IV_BASE64:CIPHER_BASE64' 形式を検知
 */
export function isEncryptedData(data: string): boolean {
  if (!data || typeof data !== 'string') return false;
  if (data.startsWith('enc:')) return true;
  // AES-GCM IV (12バイト/16文字Base64) + ':' + 暗号文Base64 (16文字以上)
  const parts = data.split(':');
  if (parts.length === 2 && parts[0].length >= 16 && parts[1].length >= 16) {
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    return base64Regex.test(parts[0]) && base64Regex.test(parts[1]);
  }
  return false;
}

/**
 * 暗号化文字列から暗号文ペイロードを取り出す
 */
export function extractEncryptedPayload(data: string): string {
  if (data.startsWith('enc:')) {
    return data.slice(4);
  }
  return data;
}

/**
 * パスコードの照合処理
 * 平文での比較を行わず、導出された暗号鍵での復号可否によって照合する
 */
export async function verifyPasscodeMatch(
  inputPasscode: string,
  storedHash: string | null | undefined,
  storedSalt: string | null | undefined
): Promise<boolean> {
  if (!storedHash || !storedSalt || !inputPasscode) {
    return false;
  }
  return await verifyPasscode(inputPasscode, storedHash, storedSalt);
}

/**
 * パスコード入力の試行と誤入力対策処理
 * - ロック中であれば残時間を返す
 * - 誤入力時は回数インクリメントと必要に応じたロック日時の保存
 * - 正解時は誤入力回数をリセット
 */
export async function processPasscodeAttempt(
  dbInstance: KakeiboDB,
  inputPasscode: string
): Promise<{ success: boolean; remainingSeconds: number; error?: string }> {
  const settings = await dbInstance.settings.get('app-settings');
  if (!settings || !settings.passcodeHash || !settings.passcodeSalt) {
    return { success: false, remainingSeconds: 0, error: 'パスコードが設定されていません' };
  }

  // 1. ロック中判定
  const remaining = getRemainingLockSeconds(settings.passcodeLockedUntil);
  if (remaining > 0) {
    return {
      success: false,
      remainingSeconds: remaining,
      error: `連続で誤入力したためロックされています。あと${remaining}秒お待ちください`,
    };
  }

  // 2. パスコード照合
  const isValid = await verifyPasscodeMatch(
    inputPasscode,
    settings.passcodeHash,
    settings.passcodeSalt
  );

  if (isValid) {
    // 成功: 誤入力回数とロック情報をリセット
    await dbInstance.settings.update('app-settings', {
      passcodeFailedAttempts: 0,
      passcodeLockedUntil: null,
    });
    return { success: true, remainingSeconds: 0 };
  } else {
    // 失敗: 誤入力回数をインクリメント
    const nextAttempts = (settings.passcodeFailedAttempts || 0) + 1;
    const waitSeconds = calculateLockWaitSeconds(nextAttempts);
    const lockedUntil =
      waitSeconds > 0 ? new Date(Date.now() + waitSeconds * 1000).toISOString() : null;

    await dbInstance.settings.update('app-settings', {
      passcodeFailedAttempts: nextAttempts,
      passcodeLockedUntil: lockedUntil,
    });

    return {
      success: false,
      remainingSeconds: waitSeconds,
      error: 'パスコードが正しくありません',
    };
  }
}

/**
 * パスコード解除とデータの復号処理
 * - パスコードを照合
 * - トランザクション内で暗号化データをすべて復号して保存し直す
 * - 設定テーブルのパスコード情報をクリア
 */
export async function decryptAndRemovePasscode(
  dbInstance: KakeiboDB,
  passcode: string
): Promise<void> {
  const settings = await dbInstance.settings.get('app-settings');
  if (!settings || !settings.passcodeHash || !settings.passcodeSalt) {
    throw new Error('パスコードが設定されていません');
  }

  // 現在のパスコードの正当性を照合
  const isValid = await verifyPasscodeMatch(
    passcode,
    settings.passcodeHash,
    settings.passcodeSalt
  );

  if (!isValid) {
    throw new Error('パスコードが正しくありません');
  }

  const salt = settings.passcodeSalt;

  // 1. 先にすべての暗号化メモを復号して更新データを準備（Web CryptoのPromiseがIndexedDBトランザクションを早急コミットさせないため）
  const transactions = await dbInstance.transactions.toArray();
  const updates: { id: string; memo: string }[] = [];

  for (const tx of transactions) {
    if (tx.memo && isEncryptedData(tx.memo)) {
      try {
        const payload = extractEncryptedPayload(tx.memo);
        const decryptedMemo = await decryptData(payload, passcode, salt);
        updates.push({ id: tx.id, memo: decryptedMemo });
      } catch (err) {
        console.warn(`Failed to decrypt transaction memo ${tx.id}:`, err);
      }
    }
  }

  // 2. トランザクション内で復号済みデータと設定解除をアトミックに一括更新
  await dbInstance.transaction('rw', [dbInstance.transactions, dbInstance.settings], async () => {
    for (const update of updates) {
      await dbInstance.transactions.update(update.id, { memo: update.memo });
    }

    await dbInstance.settings.update('app-settings', {
      passcodeEnabled: false,
      passcodeHash: null,
      passcodeSalt: null,
      passcodeIv: null,
      passcodeFailedAttempts: 0,
      passcodeLockedUntil: null,
    });
  });
}
