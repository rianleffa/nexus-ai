import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Sparkles, ArrowRight, Globe } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { isSupabaseConfigured } from '../services/supabase';

interface LoginProps {
  onNavigateToRegister: () => void;
  onNavigateToLanding?: () => void;
  onSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigateToRegister, onNavigateToLanding, onSuccess }) => {
  const { login, loginWithGoogle, loginDemo, authError } = useAuth();
  const { showToast } = useNotification();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [oauthError, setOAuthError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const hasAuthorizationCode = query.has('code') || fragment.has('code') || fragment.has('access_token');
    const error = fragment.get('error_description') || query.get('error_description') || fragment.get('error') || query.get('error');
    if (!error || hasAuthorizationCode) return;

    const errorCode = fragment.get('error_code') || query.get('error_code') || error;
    setOAuthError(errorCode === 'access_denied' || /cancel|denied/i.test(error)
      ? 'O acesso com Google foi cancelado. Você pode tentar novamente.'
      : 'O Google não concluiu a autenticação. Verifique a configuração OAuth e tente novamente.');

    // Remove OAuth error parameters from the address bar without touching a PKCE code.
    for (const key of ['error', 'error_code', 'error_description', 'error_uri']) {
      query.delete(key);
      fragment.delete(key);
    }
    const nextUrl = `${window.location.pathname}${query.size ? `?${query}` : ''}${fragment.size ? `#${fragment}` : ''}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isGoogleLoading) return;
    setIsLoading(true);
    const success = await login(email, password);
    setIsLoading(false);
    if (success) onSuccess();
    else showToast('Não foi possível entrar. Confira o e-mail e a senha.', 'error');
  };

  const handleGoogleLogin = async () => {
    if (isGoogleLoading || isLoading) return;
    setOAuthError(null);
    setIsGoogleLoading(true);
    try {
      const res = await loginWithGoogle();
      if (!res.success) setOAuthError(res.error || 'Falha ao iniciar o acesso com Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDemoAccess = () => {
    loginDemo();
    onSuccess();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 p-4 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl relative z-10 animate-in zoom-in-95">
        {/* Brand Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 text-white font-black text-2xl shadow-glow mb-2">
            N
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center justify-center gap-1.5">
            <span>NEXUS</span>
            <span className="text-brand-400">AI</span>
          </h1>
          <p className="text-xs text-slate-400">
            Gestão inteligente para sua empresa.
          </p>
        </div>

        {(oauthError || authError) && (
          <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-800" role="alert" aria-live="polite">
            {oauthError || authError}
          </div>
        )}

        {/* Modo Demonstração explícito e isolado da autenticação real */}
        {!isSupabaseConfigured && <div className="mb-5 p-3.5 bg-brand-950/40 border border-brand-500/30 rounded-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-400 mb-1">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span>Modo Demonstração Instantâneo</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
            Use registros de demonstração fictícios salvos apenas neste navegador. Eles não representam uma empresa real.
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleDemoAccess}
            className="w-full shadow-glow"
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Acessar Modo Demonstração (1 Clique)
          </Button>
        </div>}

        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-[10px] text-slate-500 uppercase tracking-wider">
            Ou acesse com credenciais
          </span>
          <div className="border-t border-slate-200 w-full" />
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Input
            label="E-mail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu.email@empresa.com"
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">Senha</label>
            </div>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            disabled={isGoogleLoading}
            className="w-full mt-2"
          >
            Entrar
          </Button>

          {isSupabaseConfigured && <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleGoogleLogin}
            isLoading={isGoogleLoading}
            disabled={isLoading}
            className="w-full border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continuar com Google
          </Button>}
        </form>

        {/* Bottom Links */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
          <div>
            Não tem uma conta?{' '}
            <button
              onClick={onNavigateToRegister}
              className="text-brand-400 font-semibold hover:underline"
            >
              Criar conta
            </button>
          </div>

          {onNavigateToLanding && (
            <button
              onClick={onNavigateToLanding}
              className="flex items-center gap-1 text-slate-600 hover:text-brand-700 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Ver Landing Page</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
