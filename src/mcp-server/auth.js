import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { randomBytes } from 'crypto';

export function generateSessionToken(tokenPath) {
  const token = randomBytes(32).toString('hex');
  mkdirSync(dirname(tokenPath), { recursive: true });
  writeFileSync(tokenPath, token, { mode: 0o600 });
  return token;
}

export function validateBearerToken(authHeader, tokenPath) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  try {
    const storedToken = readFileSync(tokenPath, 'utf-8').trim();
    const providedToken = authHeader.slice(7);
    if (storedToken.length !== providedToken.length) return false;
    let result = 0;
    for (let i = 0; i < storedToken.length; i++) {
      result |= storedToken.charCodeAt(i) ^ providedToken.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}
