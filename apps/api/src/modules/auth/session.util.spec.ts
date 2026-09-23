import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from './session.util';

describe('session.util', () => {
  describe('password hashing', () => {
    it('produces a scrypt hash that verifies against the original password', async () => {
      const hash = await hashPassword('secret123');

      expect(hash.startsWith('scrypt$')).toBe(true);
      await expect(verifyPassword('secret123', hash)).resolves.toBe(true);
    });

    it('rejects a wrong password', async () => {
      const hash = await hashPassword('secret123');

      await expect(verifyPassword('nope', hash)).resolves.toBe(false);
    });

    it('rejects a malformed stored hash', async () => {
      await expect(verifyPassword('secret123', 'not-a-hash')).resolves.toBe(false);
    });
  });

  describe('session tokens', () => {
    it('generates unique opaque tokens', () => {
      expect(generateSessionToken()).not.toBe(generateSessionToken());
    });

    it('hashes tokens deterministically to a sha256 hex digest', () => {
      const hash = hashSessionToken('raw-token');

      expect(hash).toBe(hashSessionToken('raw-token'));
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).not.toBe('raw-token');
    });
  });
});
