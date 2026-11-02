import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Building,
  User as UserIcon,
  Key,
  Database,
  RotateCcw,
  CheckCircle2,
  Lock,
  Camera,
  Trash2,
  Sparkles,
  Shield,
  Upload,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { dataStore } from '../services/dataStore';
import { useNotification } from '../contexts/NotificationContext';
import { UserAvatar } from '../components/common/UserAvatar';
import { supabaseSync } from '../services/supabaseSync';
import { isSupabaseConfigured } from '../services/supabase';

export const Settings: React.FC = () => {
  const { user, company, updateProfile, updateCompany, changePassword, uploadAvatar, removeAvatar } = useAuth();
  const { showToast } = useNotification();

  const [activeTab, setActiveTab] = useState<'profile' | 'company' | 'integrations' | 'demo'>('profile');

  // User Profile Form states
  const [fullName, setFullName] = useState(user?.full_name || user?.name || '');
  const [displayName, setDisplayName] = useState(user?.display_name || user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [jobTitle, setJobTitle] = useState(user?.job_title || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Password Form states
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Company Form states
  const [companyName, setCompanyName] = useState(company?.name || '');
  const [cnpj, setCnpj] = useState(company?.cnpj || '');
  const [segment, setSegment] = useState(company?.segment || '');
  const [companyEmail, setCompanyEmail] = useState(company?.email || '');
  const [companyPhone, setCompanyPhone] = useState(company?.phone || '');
  const [companyAddress, setCompanyAddress] = useState(company?.address || '');
  const [companyWebsite, setCompanyWebsite] = useState(company?.website || '');

  // Integrations states
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{
    success: boolean;
    message: string;
    tablesFound?: string[];
    latencyMs?: number;
  } | null>(null);

  const handleTestConnection = async () => {
    setIsTestingSupabase(true);
    setSupabaseTestResult(null);
    const result = await supabaseSync.testConnection();
    setSupabaseTestResult(result);
    setIsTestingSupabase(false);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'warning');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await updateProfile({
      full_name: fullName,
      name: fullName,
      display_name: displayName,
      phone,
      job_title: jobTitle,
      bio,
    });
    showToast(saved ? 'Perfil do usuário atualizado com sucesso!' : 'Não foi possível salvar o perfil no servidor.', saved ? 'success' : 'error');
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingAvatar(true);
      await uploadAvatar(file);
      showToast('Foto de perfil atualizada!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao fazer upload da foto.', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    await removeAvatar();
    showToast('Foto de perfil removida.', 'info');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      showToast('A nova senha e a confirmação não coincidem.', 'warning');
      return;
    }
    setIsChangingPass(true);
    const res = await changePassword(newPass);
    setIsChangingPass(false);
    if (res.success) {
      showToast(res.message, 'success');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await updateCompany({
      name: companyName,
      cnpj,
      segment,
      email: companyEmail,
      phone: companyPhone,
      address: companyAddress,
      website: companyWebsite,
    });
    showToast(saved ? 'Dados da empresa salvos com sucesso!' : 'Não foi possível salvar os dados da empresa.', saved ? 'success' : 'error');
  };

  const handleResetData = () => {
    if (confirm('Deseja substituir os exemplos locais pelos dados de demonstração padrão?')) {
      dataStore.resetToDefault();
      showToast('Exemplos de demonstração restaurados.', 'success');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-brand-500" />
          <span>Configurações & Perfil</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Gerencie seu perfil de usuário, informações da sua organização, credenciais e integrações
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
        {[
          { id: 'profile', label: 'Meu Perfil', icon: UserIcon },
          { id: 'company', label: 'Minha Empresa', icon: Building },
          { id: 'integrations', label: 'Integrações & IA', icon: Key },
          ...(!isSupabaseConfigured ? [{ id: 'demo', label: 'Dados de demonstração', icon: RotateCcw }] : []),
        ].map((tab) => {
          const Icon = tab.icon;
          const isSel = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
                isSel
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MEU PERFIL */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* User Avatar Card */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                <UserAvatar
                  name={user?.full_name || user?.name}
                  avatarUrl={user?.avatar_url}
                  size="xl"
                  className="ring-4 ring-brand-500/20 shadow-md"
                />
                <label className="absolute inset-0 bg-black/50 text-white rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-[10px] font-bold">
                  <Camera className="w-5 h-5 mb-1" />
                  Trocar
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-2 text-center sm:text-left flex-1">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {user?.full_name || user?.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {user?.job_title} • {user?.email}
                  </p>
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-xs">
                      <Upload className="w-3.5 h-3.5" />
                      {isUploadingAvatar ? 'Enviando...' : 'Carregar Nova Foto'}
                    </span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                    />
                  </label>

                  {user?.avatar_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs"
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* User Data Form */}
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              Informações Pessoais & Profissionais
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nome Completo *"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <Input
                  label="Nome de Exibição / Apelido"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="E-mail"
                  disabled
                  value={email}
                  helperText="O e-mail é gerenciado pela autenticação."
                />
                <Input
                  label="Telefone / WhatsApp"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                />
              </div>

              <Input
                label="Cargo / Função na Empresa"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ex: Diretor de Operações"
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Bio / Apresentação Curta
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="primary" size="sm" type="submit">
                  Salvar Perfil
                </Button>
              </div>
            </form>
          </Card>

          {/* Change Password Card */}
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Lock className="w-4 h-4 text-brand-500" />
              <span>Segurança da Conta & Alteração de Senha</span>
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nova Senha *"
                  type="password"
                  required
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <Input
                  label="Confirmar Nova Senha *"
                  type="password"
                  required
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  type="submit"
                  isLoading={isChangingPass}
                >
                  Alterar Senha
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 2: MINHA EMPRESA */}
      {activeTab === 'company' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cadastro da Organização
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Dados cadastrais e fiscais utilizados na emissão de relatórios
              </p>
            </div>
            <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              Plano {company?.plan?.toUpperCase() || 'PRO'}
            </span>
          </div>

          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Razão Social / Nome Fantasia *"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
              <Input
                label="CNPJ"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Segmento de Atuação"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="Ex: Consultoria em Tecnologia"
              />
              <Input
                label="Website Oficial"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                placeholder="https://suaempresa.com.br"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="E-mail Comercial"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
              />
              <Input
                label="Telefone Comercial"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
              />
            </div>

            <Input
              label="Endereço Completo"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="Rua, Número, Bairro, Cidade/UF - CEP"
            />

            <div className="flex justify-end pt-2">
              <Button variant="primary" size="sm" type="submit">
                Salvar Dados da Empresa
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 3: INTEGRAÇÕES & IA */}
      {activeTab === 'integrations' && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <Key className="w-5 h-5 text-brand-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Integrações & Banco de Dados Supabase
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Gerenciamento de credenciais do PostgreSQL, Storage e Google Gemini
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 font-bold border border-slate-500/20">
                Diagnóstico do Servidor
              </span>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 leading-relaxed text-slate-600 dark:text-slate-300">
              As credenciais são definidas no ambiente de implantação. A chave Gemini deve ficar apenas nos secrets da função Supabase; esta tela não lê nem exibe chaves do servidor.
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">Estado da conexão: {isSupabaseConfigured ? 'Supabase configurado' : 'Supabase não configurado'}. Use o teste abaixo para confirmar a conexão com o projeto.</p>

            {/* Test Connection Button & Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  isLoading={isTestingSupabase}
                  leftIcon={<Database className="w-4 h-4 text-brand-500" />}
                >
                  Testar Conexão Supabase
                </Button>
              </div>

              <span className="text-[11px] text-slate-400">
                Schema SQL completo disponível em <code className="font-mono text-slate-500">supabase/schema.sql</code>
              </span>
            </div>

            {/* Diagnostic Output Card */}
            {supabaseTestResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 ${
                  supabaseTestResult.success
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      supabaseTestResult.success ? 'text-emerald-500' : 'text-amber-500'
                    }`}
                  />
                  <span>
                    {supabaseTestResult.success
                      ? 'Diagnóstico: Supabase Conectado'
                      : 'Diagnóstico: Supabase não conectado'}
                  </span>
                </div>
                <p className="text-[11px] opacity-90">{supabaseTestResult.message}</p>
                {supabaseTestResult.tablesFound && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {supabaseTestResult.tablesFound.map((tbl) => (
                      <span
                        key={tbl}
                        className="px-2 py-0.5 rounded-md bg-white/60 dark:bg-slate-900/60 font-mono text-[10px] border border-emerald-500/20"
                      >
                        ✓ {tbl}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* TAB 4: ZONA DEMO */}
      {!isSupabaseConfigured && activeTab === 'demo' && (
        <Card className="p-6 space-y-4 border-rose-200 dark:border-rose-900/50">
          <div className="flex items-center gap-2.5 pb-3 border-b border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-400">
            <RotateCcw className="w-5 h-5" />
            <h3 className="text-sm font-bold">
              Zona de Restauração de Demonstração
            </h3>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Restaura exemplos fictícios locais para uma demonstração. Esses registros não representam dados de uma empresa real.
          </p>

          <Button
            variant="danger"
            size="sm"
            onClick={handleResetData}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Restaurar exemplos de demonstração
          </Button>
        </Card>
      )}
    </div>
  );
};
