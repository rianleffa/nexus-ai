import { useEffect, useState } from 'react';
import { signClientPhoto } from '../../services/clientPhotos';
import { CLIENT_PHOTO_ACCEPT, validateClientPhoto } from '../../services/clientPhotoValidation';
import { UserAvatar } from './UserAvatar';

function usePhotoUrl(path?: string | null) {
  const [signed, setSigned] = useState<{ path: string; url?: string }>();
  useEffect(() => {
    if (!path) return;
    let active = true;
    const load = () => {
      void signClientPhoto(path).then((url) => {
        if (active) setSigned({ path, url });
      }).catch(() => undefined);
    };
    load();
    const interval = window.setInterval(load, 540_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [path]);
  return signed && signed.path === path ? signed.url : undefined;
}

export function ClientPhoto({ name, path, size }: { name: string; path?: string | null; size: 'sm' | 'xl' }) {
  const url = usePhotoUrl(path);
  return <UserAvatar key={url} name={name} avatarUrl={url} size={size} />;
}

export function ClientPhotoField({ name, path, value, onChange, disabled }: {
  name: string;
  path?: string | null;
  value: File | null | undefined;
  onChange: (file: File | null | undefined) => void;
  disabled: boolean;
}) {
  const [preview, setPreview] = useState<{ file: File; url: string }>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!value) return;
    const url = URL.createObjectURL(value);
    setPreview({ file: value, url });
    return () => URL.revokeObjectURL(url);
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {value && preview?.file === value
          ? <UserAvatar key={preview.url} name={name} avatarUrl={preview.url} size="xl" />
          : <ClientPhoto name={name} path={value === undefined ? path : undefined} size="xl" />}
        <label className="min-w-0 text-sm font-medium">
          Foto ou logotipo
          <input type="file" accept={CLIENT_PHOTO_ACCEPT} disabled={disabled} className="mt-1 block w-full text-xs"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!file) return;
              const validation = validateClientPhoto(file);
              setError(validation ?? '');
              if (!validation) onChange(file);
            }} />
        </label>
        {(value || (value === undefined && path)) && <button type="button" disabled={disabled}
          className="text-xs font-semibold text-rose-700 dark:text-rose-400"
          onClick={() => { setError(''); onChange(path ? null : undefined); }}>Remover imagem</button>}
        {path && value !== undefined && <button type="button" disabled={disabled}
          className="text-xs underline" onClick={() => { setError(''); onChange(undefined); }}>Manter imagem atual</button>}
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">JPG, PNG ou WEBP, até 5 MB.</p>
      {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-400">{error}</p>}
    </div>
  );
}
