import { clientPhotoExtensions, hasClientPhotoSignature, validateClientPhoto } from './clientPhotoValidation';
import { supabase } from './supabase';

export const CLIENT_PHOTOS_BUCKET = 'client-photos';
export async function uploadClientPhoto(companyId: string, file: File): Promise<string> {
  const validation = validateClientPhoto(file);
  if (validation) throw new Error(validation);
  if (!await hasClientPhotoSignature(file)) throw new Error('O conteúdo do arquivo não corresponde ao formato da imagem.');
  if (!supabase) throw new Error('O armazenamento em nuvem não está disponível.');
  const path = [companyId, crypto.randomUUID() + '.' + clientPhotoExtensions.get(file.type)].join('/');
  const { error } = await supabase.storage.from(CLIENT_PHOTOS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error('Não foi possível enviar a imagem.');
  return path;
}

export async function removeClientPhoto(path: string): Promise<void> {
  if (!supabase) throw new Error('O armazenamento em nuvem não está disponível.');
  const { error } = await supabase.storage.from(CLIENT_PHOTOS_BUCKET).remove([path]);
  if (error) throw error;
}

export async function signClientPhoto(path: string): Promise<string | undefined> {
  const { data } = await supabase?.storage.from(CLIENT_PHOTOS_BUCKET).createSignedUrl(path, 600) ?? {};
  return data?.signedUrl;
}

export const clientPhotosEnabled = import.meta.env.VITE_CLIENT_PHOTOS_ENABLED === 'true' && Boolean(supabase);
