import React, { useState } from 'react';

export function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UserAvatarProps {
  name?: string;
  avatarUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showStatus?: boolean;
  status?: 'ativo' | 'inativo' | 'pendente';
  onClick?: () => void;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name = 'Usuário',
  avatarUrl,
  size = 'md',
  className = '',
  showStatus = false,
  status = 'ativo',
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-24 h-24 text-2xl',
  };

  const statusDotSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5',
    '2xl': 'w-4 h-4',
  };

  const statusColors = {
    ativo: 'bg-emerald-500',
    inativo: 'bg-slate-400',
    pendente: 'bg-amber-500',
  };

  const initials = getInitials(name);
  const hasImage = Boolean(avatarUrl && !imageError);

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex shrink-0 select-none ${onClick ? 'cursor-pointer' : ''}`}
    >
      {hasImage ? (
        <img
          src={avatarUrl}
          alt={name}
          onError={() => setImageError(true)}
          className={`rounded-xl object-cover ring-2 ring-brand-500/20 shadow-xs ${sizeClasses[size]} ${className}`}
        />
      ) : (
        <div
          className={`rounded-xl bg-gradient-to-tr from-brand-600 via-emerald-600 to-teal-400 flex items-center justify-center font-bold text-white shadow-xs ring-2 ring-brand-500/20 tracking-wider ${sizeClasses[size]} ${className}`}
        >
          {initials}
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-white dark:ring-slate-900 ${
            statusDotSizes[size]
          } ${statusColors[status]}`}
        />
      )}
    </div>
  );
};
