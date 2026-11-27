import assert from 'node:assert/strict';
import test from 'node:test';
import { CLIENT_PHOTO_MAX_BYTES, hasClientPhotoSignature, validateClientPhoto } from './clientPhotoValidation.ts';

test('client photos accept JPG, PNG and WEBP up to 5 MiB', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(validateClientPhoto({ type, size: CLIENT_PHOTO_MAX_BYTES }), undefined);
    assert.ok(validateClientPhoto({ type, size: CLIENT_PHOTO_MAX_BYTES + 1 }));
    assert.ok(validateClientPhoto({ type, size: 0 }));
  }
  assert.ok(validateClientPhoto({ type: 'image/svg+xml', size: 100 }));
});

test('client uploads check the binary header against the declared MIME type', async () => {
  for (const [type, bytes] of [
    ['image/jpeg', [255, 216, 255]],
    ['image/png', [137, 80, 78, 71, 13, 10, 26, 10]],
    ['image/webp', [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]],
  ]) {
    assert.equal(await hasClientPhotoSignature(new File([Uint8Array.from(bytes)], 'photo', { type })), true);
    assert.equal(await hasClientPhotoSignature(new File(['not an image'], 'photo', { type })), false);
  }
});
