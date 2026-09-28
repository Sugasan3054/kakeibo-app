import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  calculateLockWaitSeconds,
  getRemainingLockSeconds,
  isEncryptedData,
  verifyPasscodeMatch,
  processPasscodeAttempt,
  decryptAndRemovePasscode,
} from '../passcode';
import { hashPasscode, encryptData } from '../crypto';
import { KakeiboDB } from '../../db/database';
import type { Transaction } from '../../db/models';

describe('Passcode Lock and Decryption Utilities', () => {
  let db: KakeiboDB;

  beforeEach(async () => {
    db = new KakeiboDB();
    await db.settings.clear();
    await db.transactions.clear();
  });

  describe('calculateLockWaitSeconds', () => {
    it('returns 0 for failed attempts less than 5', () => {
      expect(calculateLockWaitSeconds(0)).toBe(0);
      expect(calculateLockWaitSeconds(1)).toBe(0);
      expect(calculateLockWaitSeconds(4)).toBe(0);
    });

    it('returns 30 seconds for 5 consecutive failed attempts', () => {
      expect(calculateLockWaitSeconds(5)).toBe(30);
    });

    it('doubles wait time for each subsequent failure up to 15 minutes (900s)', () => {
      expect(calculateLockWaitSeconds(6)).toBe(60);
      expect(calculateLockWaitSeconds(7)).toBe(120);
      expect(calculateLockWaitSeconds(8)).toBe(240);
      expect(calculateLockWaitSeconds(9)).toBe(480);
      expect(calculateLockWaitSeconds(10)).toBe(900); // 30 * 2^5 = 960 -> capped at 900
      expect(calculateLockWaitSeconds(15)).toBe(900);
    });
  });

  describe('getRemainingLockSeconds', () => {
    it('returns 0 if lockedUntil is null, undefined, or past', () => {
      expect(getRemainingLockSeconds(null)).toBe(0);
      expect(getRemainingLockSeconds(undefined)).toBe(0);
      const pastTime = new Date(Date.now() - 5000).toISOString();
      expect(getRemainingLockSeconds(pastTime)).toBe(0);
    });

    it('calculates remaining seconds accurately for future timestamp', () => {
      const futureTime = new Date(Date.now() + 25000).toISOString();
      const remaining = getRemainingLockSeconds(futureTime);
      expect(remaining).toBeGreaterThanOrEqual(24);
      expect(remaining).toBeLessThanOrEqual(26);
    });
  });

  describe('isEncryptedData', () => {
    it('detects enc: prefix and IV:Ciphertext formats', () => {
      expect(isEncryptedData('plain text')).toBe(false);
      expect(isEncryptedData('enc:someencryptedcontent')).toBe(true);
      expect(isEncryptedData('dGVzdGl2MTIzNDU2:dGVzdGNpcGhlcjEyMzQ1Ng==')).toBe(true);
    });
  });

  describe('verifyPasscodeMatch (パスコード照合処理)', () => {
    it('verifies correct passcode using PBKDF2 and AES-GCM decryption', async () => {
      const passcode = '1234';
      const { hash, salt } = await hashPasscode(passcode);

      const isValid = await verifyPasscodeMatch(passcode, hash, salt);
      expect(isValid).toBe(true);
    });

    it('rejects incorrect passcode without comparing plaintext', async () => {
      const passcode = '1234';
      const { hash, salt } = await hashPasscode(passcode);

      const isWrong = await verifyPasscodeMatch('9999', hash, salt);
      expect(isWrong).toBe(false);
    });

    it('returns false when hash or salt is missing', async () => {
      expect(await verifyPasscodeMatch('1234', null, null)).toBe(false);
    });
  });

  describe('processPasscodeAttempt and lock state in IndexedDB', () => {
    it('tracks failed attempts and locks after 5 failures in IndexedDB', async () => {
      const passcode = '4321';
      const { hash, salt } = await hashPasscode(passcode);

      await db.settings.put({
        id: 'app-settings',
        theme: 'light',
        passcodeEnabled: true,
        passcodeHash: hash,
        passcodeSalt: salt,
        passcodeIv: null,
        expectedMonthlyIncome: null,
        initialLaunchDone: true,
        passcodeFailedAttempts: 0,
        passcodeLockedUntil: null,
      });

      // 1〜4回目の誤入力
      for (let i = 1; i <= 4; i++) {
        const result = await processPasscodeAttempt(db, '0000');
        expect(result.success).toBe(false);
        expect(result.remainingSeconds).toBe(0);
        expect(result.error).toBe('パスコードが正しくありません');
      }

      const settingsAfter4 = await db.settings.get('app-settings');
      expect(settingsAfter4?.passcodeFailedAttempts).toBe(4);
      expect(settingsAfter4?.passcodeLockedUntil).toBeNull();

      // 5回目の誤入力 -> ロック開始 (30秒)
      const result5 = await processPasscodeAttempt(db, '0000');
      expect(result5.success).toBe(false);
      expect(result5.remainingSeconds).toBe(30);

      const settingsAfter5 = await db.settings.get('app-settings');
      expect(settingsAfter5?.passcodeFailedAttempts).toBe(5);
      expect(settingsAfter5?.passcodeLockedUntil).toBeTruthy();

      // ロック中の再試行
      const lockedAttempt = await processPasscodeAttempt(db, passcode);
      expect(lockedAttempt.success).toBe(false);
      expect(lockedAttempt.remainingSeconds).toBeGreaterThan(0);
      expect(lockedAttempt.error).toContain('連続で誤入力したためロックされています');
    });

    it('resets failed attempts upon successful authentication', async () => {
      const passcode = '4321';
      const { hash, salt } = await hashPasscode(passcode);

      await db.settings.put({
        id: 'app-settings',
        theme: 'light',
        passcodeEnabled: true,
        passcodeHash: hash,
        passcodeSalt: salt,
        passcodeIv: null,
        expectedMonthlyIncome: null,
        initialLaunchDone: true,
        passcodeFailedAttempts: 3,
        passcodeLockedUntil: null,
      });

      const result = await processPasscodeAttempt(db, passcode);
      expect(result.success).toBe(true);
      expect(result.remainingSeconds).toBe(0);

      const updated = await db.settings.get('app-settings');
      expect(updated?.passcodeFailedAttempts).toBe(0);
      expect(updated?.passcodeLockedUntil).toBeNull();
    });
  });

  describe('decryptAndRemovePasscode (パスコード解除時のデータの復号処理)', () => {
    it('decrypts encrypted transaction data in transaction and resets passcode settings', async () => {
      const passcode = '7890';
      const { hash, salt } = await hashPasscode(passcode);

      // 暗号化された取引メモと平文メモを準備
      const encryptedMemo = 'enc:' + (await encryptData('極秘の買い物メモ', passcode, salt));
      const tx1: Transaction = {
        id: 'tx-1',
        kind: 'expense',
        amount: 2500,
        categoryId: 'cat-1',
        date: '2026-09-28',
        memo: encryptedMemo,
        accountId: 'acc-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const tx2: Transaction = {
        id: 'tx-2',
        kind: 'expense',
        amount: 500,
        categoryId: 'cat-1',
        date: '2026-09-28',
        memo: '平文メモそのまま',
        accountId: 'acc-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.transactions.bulkAdd([tx1, tx2]);

      await db.settings.put({
        id: 'app-settings',
        theme: 'light',
        passcodeEnabled: true,
        passcodeHash: hash,
        passcodeSalt: salt,
        passcodeIv: null,
        expectedMonthlyIncome: null,
        initialLaunchDone: true,
        passcodeFailedAttempts: 2,
        passcodeLockedUntil: null,
      });

      // 解除と復号を実行
      await decryptAndRemovePasscode(db, passcode);

      // トランザクション後のデータ確認
      const afterTx1 = await db.transactions.get('tx-1');
      expect(afterTx1?.memo).toBe('極秘の買い物メモ');

      const afterTx2 = await db.transactions.get('tx-2');
      expect(afterTx2?.memo).toBe('平文メモそのまま');

      const settings = await db.settings.get('app-settings');
      expect(settings?.passcodeEnabled).toBe(false);
      expect(settings?.passcodeHash).toBeNull();
      expect(settings?.passcodeSalt).toBeNull();
      expect(settings?.passcodeFailedAttempts).toBe(0);
      expect(settings?.passcodeLockedUntil).toBeNull();
    });

    it('fails and aborts without modifying data if wrong passcode is provided', async () => {
      const passcode = '7890';
      const { hash, salt } = await hashPasscode(passcode);

      const encryptedMemo = 'enc:' + (await encryptData('秘密のデータ', passcode, salt));
      await db.transactions.add({
        id: 'tx-secure',
        kind: 'expense',
        amount: 1000,
        categoryId: 'cat-1',
        date: '2026-09-28',
        memo: encryptedMemo,
        accountId: 'acc-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await db.settings.put({
        id: 'app-settings',
        theme: 'light',
        passcodeEnabled: true,
        passcodeHash: hash,
        passcodeSalt: salt,
        passcodeIv: null,
        expectedMonthlyIncome: null,
        initialLaunchDone: true,
      });

      await expect(decryptAndRemovePasscode(db, '9999')).rejects.toThrow(
        'パスコードが正しくありません'
      );

      // 取引データおよび設定が変更されていないこと
      const unchangedTx = await db.transactions.get('tx-secure');
      expect(unchangedTx?.memo).toBe(encryptedMemo);

      const unchangedSettings = await db.settings.get('app-settings');
      expect(unchangedSettings?.passcodeEnabled).toBe(true);
    });
  });
});
