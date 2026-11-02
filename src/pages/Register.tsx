import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Shield, ArrowLeft } from 'lucide-react';

interface RegisterProps {
  onNavigateToLogin: () => void;
  onSuccess: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onNavigateToLogin, onSuccess }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }
    setError('');
    setNotice('');
    setIsLoading(true);
    try {
      const result = await register(name, companyName, email, phone, password);
      if (result.success) onSuccess();
      else if (result.requiresEmailConfirmation) setNotice(result.error || 'Confirme seu e-mail para continuar.');
      else setError(result.error || 'Não foi possível criar a conta.');
    } catch {
      setError('Não foi possível conectar ao serviço de cadastro. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden">
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-[#0F1622] border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 animate-in zoom-in-95">
        <button
          onClick={onNavigateToLogin}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para o login</span>
        </button>

        <div className="space-y-1 mb-6">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Criar conta no NEXUS AI
          </h2>
          <p className="text-xs text-slate-400">
            Cadastre sua empresa e experimente a gestão integrada por IA.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-4 p-3 bg-blue-950/40 border border-blue-800 rounded-xl text-xs text-blue-200">
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nome Completo *"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Rian Silva"
            />
            <Input
              label="Nome da Empresa *"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Tech Solutions"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="E-mail Corporativo *"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rian@empresa.com"
            />
            <Input
              label="Telefone / WhatsApp *"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 98765-4321"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Senha *"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Input
              label="Confirmar Senha *"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            className="w-full mt-3"
          >
            Cadastrar e Acessar Dashboard
          </Button>
        </form>

        <div className="mt-5 text-center text-xs text-slate-400">
          Já possui conta cadastrada?{' '}
          <button
            onClick={onNavigateToLogin}
            className="text-brand-400 font-semibold hover:underline"
          >
            Fazer login
          </button>
        </div>
      </div>
    </div>
  );
};
