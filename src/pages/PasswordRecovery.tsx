import React, { useState } from 'react';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface PasswordRecoveryProps {
  onBackToLogin: () => void;
}

export const PasswordRecovery: React.FC<PasswordRecoveryProps> = ({ onBackToLogin }) => {
  const { completePasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setError('');
    setIsLoading(true);
    const result = await completePasswordRecovery(password);
    setIsLoading(false);
    if (result.success) setIsComplete(true);
    else setError(result.error || 'Não foi possível atualizar sua senha.');
  };

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl">
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 text-white mb-2">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Redefinir senha</h1>
          <p className="text-sm text-slate-400">
            {isComplete ? 'Sua senha foi atualizada com segurança.' : 'Escolha uma nova senha para sua conta.'}
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-800" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        {isComplete ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800" role="status">
              Agora entre usando sua nova senha.
            </div>
            <Button type="button" variant="primary" size="md" className="w-full" onClick={onBackToLogin}>
              Ir para o login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nova senha"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Pelo menos 8 caracteres"
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Digite a senha novamente"
            />
            <Button type="submit" variant="primary" size="md" isLoading={isLoading} className="w-full">
              Atualizar senha
            </Button>
            <button type="button" onClick={onBackToLogin} className="flex items-center justify-center gap-2 w-full text-xs text-slate-600 hover:text-brand-700">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
            </button>
          </form>
        )}
      </div>
    </main>
  );
};
