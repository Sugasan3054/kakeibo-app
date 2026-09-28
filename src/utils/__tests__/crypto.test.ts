import { describe, it, expect } from 'vitest';
import {
  hashPasscode,
  verifyPasscode,
  encryptData,
  decryptData,
} from '../crypto';

describe('crypto utils', () => {
  it('hashes and verifies correct passcode', async () => {
    const passcode = '1234';
    const { hash, salt } = await hashPasscode(passcode);

    expect(hash).toBeTruthy();
    expect(salt).toBeTruthy();

    const isMatch = await verifyPasscode(passcode, hash, salt);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPasscode('9999', hash, salt);
    expect(isWrongMatch).toBe(false);
  });

  it('encrypts and decrypts arbitrary string data with passcode', async () => {
    const data = JSON.stringify({ secret: 'my-personal-account', amount: 50000 });
    const passcode = '5678';
    const { salt } = await hashPasscode(passcode);

    const encrypted = await encryptData(data, passcode, salt);
    expect(encrypted).not.toBe(data);

    const decrypted = await decryptData(encrypted, passcode, salt);
    expect(decrypted).toBe(data);
    expect(JSON.parse(decrypted)).toEqual({ secret: 'my-personal-account', amount: 50000 });
  });
});
