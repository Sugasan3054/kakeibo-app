/**
 * Web Crypto API を使ったパスコード暗号化ユーティリティ
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * ランダムバイト列を生成する
 */
function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * ArrayBuffer または Uint8Array をBase64文字列に変換する
 */
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64文字列をUint8Arrayに変換する
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * パスコードからPBKDF2で暗号鍵を導出する
 */
async function deriveKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passcode),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * パスコードからPBKDF2で暗号鍵を導出する（外部利用用）
 */
export async function deriveCryptoKey(passcode: string, storedSalt: string): Promise<CryptoKey> {
  const salt = base64ToBytes(storedSalt);
  return deriveKey(passcode, salt);
}

/**
 * パスコードのハッシュを生成する（検証用）
 */
export async function hashPasscode(passcode: string): Promise<{ hash: string; salt: string }> {
  const salt = getRandomBytes(SALT_LENGTH);
  const key = await deriveKey(passcode, salt);
  // ハッシュとして、固定文字列を暗号化した結果を使用
  const encoder = new TextEncoder();
  const iv = getRandomBytes(IV_LENGTH);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoder.encode('KAKEIBO_PASSCODE_VERIFY')
  );

  return {
    hash: bufferToBase64(iv) + ':' + bufferToBase64(encrypted),
    salt: bufferToBase64(salt),
  };
}

/**
 * パスコードが正しいか検証する
 */
export async function verifyPasscode(
  passcode: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  try {
    const salt = base64ToBytes(storedSalt);
    const key = await deriveKey(passcode, salt);
    const [ivBase64, encBase64] = storedHash.split(':');
    const iv = base64ToBytes(ivBase64);
    const encrypted = base64ToBytes(encBase64);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      encrypted as unknown as BufferSource
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted) === 'KAKEIBO_PASSCODE_VERIFY';
  } catch {
    return false;
  }
}

/**
 * データを暗号化する
 */
export async function encryptData(data: string, passcode: string, storedSalt: string): Promise<string> {
  const salt = base64ToBytes(storedSalt);
  const key = await deriveKey(passcode, salt);
  const iv = getRandomBytes(IV_LENGTH);
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoder.encode(data)
  );

  return bufferToBase64(iv) + ':' + bufferToBase64(encrypted);
}

/**
 * データを復号する
 */
export async function decryptData(encryptedData: string, passcode: string, storedSalt: string): Promise<string> {
  const salt = base64ToBytes(storedSalt);
  const key = await deriveKey(passcode, salt);
  const [ivBase64, encBase64] = encryptedData.split(':');
  const iv = base64ToBytes(ivBase64);
  const encrypted = base64ToBytes(encBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encrypted as unknown as BufferSource
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
