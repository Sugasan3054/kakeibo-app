import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { KakeiboDB } from '../../db/database';
import {
  verifyPasscodeMatch,
  processPasscodeAttempt,
  decryptAndRemovePasscode,
  changePasscodeWithReEncryption,
  isEncryptedData,
  extractEncryptedPayload,
} from '../passcode';
import { hashPasscode, encryptData, decryptData } from '../crypto';
import type { Settings, Transaction } from '../../db/models';

describe('Passcode State Lifecycle: 未設定 → 設定済み → 変更 → 解除', () => {
  let db: KakeiboDB;

  beforeEach(async () => {
    db = new KakeiboDB();
    await db.settings.clear();
    await db.transactions.clear();

    const initialSettings: Settings = {
      id: 'app-settings',
      theme: 'light',
      passcodeEnabled: false,
      passcodeHash: null,
      passcodeSalt: null,
      passcodeIv: null,
      expectedMonthlyIncome: null,
      initialLaunchDone: true,
      passcodeFailedAttempts: 0,
      passcodeLockedUntil: null,
    };
    await db.settings.put(initialSettings);
  });

  it('executes full lifecycle: 未設定 → 設定済み → 変更 → 解除 while preserving data readability', async () => {
    // -------------------------------------------------------------------------
    // Phase 1: 未設定 (Initial unset state)
    // -------------------------------------------------------------------------
    let currentSettings = await db.settings.get('app-settings');
    expect(currentSettings?.passcodeEnabled).toBe(false);
    expect(currentSettings?.passcodeHash).toBeNull();
    expect(currentSettings?.passcodeSalt).toBeNull();

    // 取引データの登録（平文メモ）
    const sampleTx: Transaction = {
      id: 'tx-1',
      kind: 'expense',
      amount: 1500,
      categoryId: 'cat-food',
      date: '2026-10-02',
      memo: 'スーパーで買い物',
      accountId: 'acc-cash',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.transactions.put(sampleTx);

    // -------------------------------------------------------------------------
    // Phase 2: 設定済み (未設定 → 設定済み)
    // -------------------------------------------------------------------------
    const initialPasscode = '1234';
    const { hash: initialHash, salt: initialSalt } = await hashPasscode(initialPasscode);

    await db.settings.update('app-settings', {
      passcodeEnabled: true,
      passcodeHash: initialHash,
      passcodeSalt: initialSalt,
      passcodeFailedAttempts: 0,
      passcodeLockedUntil: null,
    });

    currentSettings = await db.settings.get('app-settings');
    expect(currentSettings?.passcodeEnabled).toBe(true);
    expect(currentSettings?.passcodeHash).toBe(initialHash);
    expect(currentSettings?.passcodeSalt).toBe(initialSalt);

    // 正しいパスコードで照合が通ることを検証
    const isPasscodeValid = await verifyPasscodeMatch(
      initialPasscode,
      currentSettings?.passcodeHash,
      currentSettings?.passcodeSalt
    );
    expect(isPasscodeValid).toBe(true);

    // 暗号化メモの取引を追加
    const secretMemo = '機密の買い物メモ';
    const encryptedSecret = 'enc:' + (await encryptData(secretMemo, initialPasscode, initialSalt));
    await db.transactions.update('tx-1', { memo: encryptedSecret });

    const txAfterSet = await db.transactions.get('tx-1');
    expect(isEncryptedData(txAfterSet!.memo)).toBe(true);

    // -------------------------------------------------------------------------
    // Phase 3: 変更 (設定済み → パスコード変更)
    // -------------------------------------------------------------------------
    // 間違った現在のパスコードでの変更は拒否されること
    await expect(
      changePasscodeWithReEncryption(db, '9999', '5678')
    ).rejects.toThrow('現在のパスコードが正しくありません');

    // 誤入力試行の判定（失敗カウントとロック）
    const failedAttempt = await processPasscodeAttempt(db, '0000');
    expect(failedAttempt.success).toBe(false);
    let settingsAfterFail = await db.settings.get('app-settings');
    expect(settingsAfterFail?.passcodeFailedAttempts).toBe(1);

    // 正しいパスコードで変更を実行
    const newPasscode = '5678';
    const { hash: newHash, salt: newSalt } = await changePasscodeWithReEncryption(
      db,
      initialPasscode,
      newPasscode
    );

    currentSettings = await db.settings.get('app-settings');
    expect(currentSettings?.passcodeEnabled).toBe(true);
    expect(currentSettings?.passcodeHash).toBe(newHash);
    expect(currentSettings?.passcodeSalt).toBe(newSalt);
    expect(currentSettings?.passcodeFailedAttempts).toBe(0); // 変更成功時にリセット

    // 旧パスコードでは照合できず、新パスコードで照合できること
    expect(
      await verifyPasscodeMatch(initialPasscode, currentSettings?.passcodeHash, currentSettings?.passcodeSalt)
    ).toBe(false);
    expect(
      await verifyPasscodeMatch(newPasscode, currentSettings?.passcodeHash, currentSettings?.passcodeSalt)
    ).toBe(true);

    // 取引データが新パスコードで再暗号化され、新パスコードで正しく読めること
    const txAfterChange = await db.transactions.get('tx-1');
    expect(isEncryptedData(txAfterChange!.memo)).toBe(true);
    const decryptedWithNew = await decryptData(
      extractEncryptedPayload(txAfterChange!.memo),
      newPasscode,
      newSalt
    );
    expect(decryptedWithNew).toBe(secretMemo);

    // -------------------------------------------------------------------------
    // Phase 4: 解除 (設定済み → 設定解除)
    // -------------------------------------------------------------------------
    // 間違ったパスコードでの解除は拒否されること
    await expect(
      decryptAndRemovePasscode(db, 'wrong')
    ).rejects.toThrow('パスコードが正しくありません');

    // 正しい新パスコードで設定解除を実行
    await decryptAndRemovePasscode(db, newPasscode);

    currentSettings = await db.settings.get('app-settings');
    expect(currentSettings?.passcodeEnabled).toBe(false);
    expect(currentSettings?.passcodeHash).toBeNull();
    expect(currentSettings?.passcodeSalt).toBeNull();
    expect(currentSettings?.passcodeFailedAttempts).toBe(0);
    expect(currentSettings?.passcodeLockedUntil).toBeNull();

    // 取引データのメモが平文に正しく復号されていること
    const txAfterRemove = await db.transactions.get('tx-1');
    expect(isEncryptedData(txAfterRemove!.memo)).toBe(false);
    expect(txAfterRemove!.memo).toBe(secretMemo);
  });
});
