export const CLIENT_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const CLIENT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const clientPhotoExtensions = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);

export function validateClientPhoto(file: Pick<File, 'type' | 'size'>): string | undefined {
  if (!clientPhotoExtensions.has(file.type)) return 'Selecione uma imagem JPG, PNG ou WEBP.';
  if (file.size <= 0 || file.size > CLIENT_PHOTO_MAX_BYTES) return 'A imagem deve ter até 5 MB e não pode estar vazia.';
}

export async function hasClientPhotoSignature(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matches = (bytes: number[], offset = 0) => bytes.every((byte, index) => header[offset + index] === byte);
  switch (file.type) {
    case 'image/jpeg': return matches([255, 216, 255]);
    case 'image/png': return matches([137, 80, 78, 71, 13, 10, 26, 10]);
    case 'image/webp': return matches([82, 73, 70, 70]) && matches([87, 69, 66, 80], 8);
    default: return false;
  }
}
