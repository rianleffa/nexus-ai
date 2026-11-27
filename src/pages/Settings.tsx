import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Building,
  User as UserIcon,
  RotateCcw,
  Lock,
  Camera,
  Trash2,
  Upload,
  MapPin,
  Sun,
  Moon,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { dataStore } from '../services/dataStore';
import { useNotification } from '../contexts/NotificationContext';
import { UserAvatar } from '../components/common/UserAvatar';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import { useTheme } from '../contexts/ThemeContext';

export const Settings: React.FC = () => {
  const { user, company, updateProfile, updateCompany, saveCompany, changePassword, uploadAvatar, removeAvatar, uploadCompanyLogo, removeCompanyLogo } = useAuth();
  const { showToast } = useNotification();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'profile' | 'company' | 'security' | 'preferences' | 'demo'>('profile');

  // User Profile Form states
  const [fullName, setFullName] = useState(user?.full_name || user?.name || '');
  const [displayName, setDisplayName] = useState(user?.display_name || user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [jobTitle, setJobTitle] = useState(user?.job_title || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Password Form states
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
  const [postalCode, setPostalCode] = useState(company?.postal_code || '');
  const [companyCity, setCompanyCity] = useState(company?.city || '');
  const [companyState, setCompanyState] = useState(company?.state || '');
  const [isLookingUpPostalCode, setIsLookingUpPostalCode] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || user.name || '');
      setDisplayName(user.display_name || user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setJobTitle(user.job_title || '');
      setBio(user.bio || '');
    }
    if (company) {
      setCompanyName(company.name || '');
      setCnpj(company.cnpj || '');
      setSegment(company.segment || '');
      setCompanyEmail(company.email || '');
      setCompanyPhone(company.phone || '');
      setCompanyAddress(company.address || '');
      setCompanyWebsite(company.website || '');
      setPostalCode(company.postal_code || '');
      setCompanyCity(company.city || '');
      setCompanyState(company.state || '');
    }
  }, [user?.id, company?.id]);

  const handlePostalCodeLookup = async () => {
    const digits = postalCode.replace(/\D/g, '');
    if (digits.length !== 8) {
      showToast('Informe um CEP válido com 8 números.', 'warning');
      return;
    }
    setIsLookingUpPostalCode(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!response.ok) throw new Error('Não foi possível consultar o CEP.');
      const data = await response.json();
      if (data.erro) throw new Error('CEP não encontrado. Confira os números e tente novamente.');
      const addressParts = [data.logradouro, data.bairro].filter(Boolean);
      if (addressParts.length) setCompanyAddress(addressParts.join(', '));
      setCompanyCity(data.localidade || '');
      setCompanyState(data.uf || '');
      setPostalCode(`${digits.slice(0, 5)}-${digits.slice(5)}`);
      showToast('Endereço preenchido pelo CEP. Confira os dados antes de salvar.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Não foi possível buscar esse CEP.', 'error');
    } finally {
      setIsLookingUpPostalCode(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('Informe seu nome completo.', 'warning');
      return;
    }
    const saved = await updateProfile({
      full_name: fullName.trim(),
      name: fullName.trim(),
      display_name: displayName.trim() || fullName.trim(),
      phone: phone.trim(),
      job_title: jobTitle.trim(),
      bio: bio.trim(),
    });
    showToast(saved ? 'Perfil do usuário atualizado com sucesso!' : 'Não foi possível salvar o perfil no servidor.', saved ? 'success' : 'error');
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
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
    const removed = await removeAvatar();
    showToast(removed ? 'Foto de perfil removida.' : 'Não foi possível remover a foto de perfil.', removed ? 'info' : 'error');
  };

  const handleCompanyLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      await uploadCompanyLogo(file);
      showToast('Logotipo da empresa atualizado.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Não foi possível enviar o logotipo.', 'error');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveCompanyLogo = async () => {
    const removed = await removeCompanyLogo();
    showToast(removed ? 'Logotipo removido.' : 'Não foi possível remover o logotipo.', removed ? 'info' : 'error');
  };

  const [endingOtherSessions, setEndingOtherSessions] = useState(false);

  const endOtherSessions = async () => {
    if (!supabase || endingOtherSessions) return;
    if (!window.confirm('Encerrar as outras sessões da sua conta?')) return;
    setEndingOtherSessions(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      showToast('Outras sessões encerradas. Sua sessão atual continua ativa.', 'success');
    } catch {
      showToast('Não foi possível encerrar as outras sessões.', 'error');
    } finally {
      setEndingOtherSessions(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChangingPass) return;
    if (newPass !== confirmPass) {
      showToast('A nova senha e a confirmação não coincidem.', 'warning');
      return;
    }
    setIsChangingPass(true);
    try {
      const res = await changePassword(newPass);
      showToast(res.message, res.success ? 'success' : 'error');
      if (res.success) {
        setNewPass('');
        setConfirmPass('');
      }
    } catch {
      showToast('Não foi possível alterar a senha.', 'error');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      showToast('Informe o nome da empresa.', 'warning');
      return;
    }
    const result = await saveCompany({
      name: companyName.trim(),
      cnpj: cnpj.trim(),
      segment: segment.trim(),
      email: companyEmail.trim(),
      phone: companyPhone.trim(),
      address: companyAddress.trim(),
      website: companyWebsite.trim(),
      postal_code: postalCode.trim(),
      city: companyCity.trim(),
      state: companyState.trim(),
    });
    showToast(result.success ? 'Dados da empresa salvos com sucesso!' : result.message || 'Não foi possível salvar os dados da empresa.', result.success ? 'success' : 'error');
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
          Gerencie seu perfil pessoal, os dados da empresa, a segurança da conta e a aparência do sistema.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
        {[
          { id: 'profile', label: 'Meu Perfil', icon: UserIcon },
          { id: 'company', label: 'Minha Empresa', icon: Building },
          { id: 'security', label: 'Segurança', icon: ShieldCheck },
          { id: 'preferences', label: 'Preferências', icon: Sun },
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
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-500 text-slate-900 hover:bg-brand-600 hover:text-white transition-colors shadow-xs">
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                {company?.logo_url ? (
                  <img src={company.logo_url} alt={`Logotipo de ${company.name}`} className="h-full w-full object-contain p-1" />
                ) : (
                  <Building className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Logotipo empresarial</h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">JPG, PNG ou WEBP, até 5 MB. Será exibido nos relatórios e na área de documentos.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer">
                  <span className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-brand-500 px-3 text-xs font-semibold text-slate-950 transition hover:bg-brand-400">
                    <Upload className="h-3.5 w-3.5" />
                    {isUploadingLogo ? 'Enviando...' : company?.logo_url ? 'Alterar logotipo' : 'Enviar logotipo'}
                  </span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleCompanyLogoChange} disabled={isUploadingLogo} className="hidden" />
                </label>
                {company?.logo_url && (
                  <Button variant="ghost" size="sm" type="button" onClick={handleRemoveCompanyLogo} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                )}
              </div>
            </div>

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
                placeholder="Informe o CNPJ"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Segmento de Atuação"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="Ex: Saúde, comércio, indústria ou serviços"
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

            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
              <Input
                label="CEP"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2'))}
                onBlur={handlePostalCodeLookup}
                placeholder="00000-000"
                inputMode="numeric"
              />
              <Button variant="outline" size="sm" type="button" onClick={handlePostalCodeLookup} isLoading={isLookingUpPostalCode} leftIcon={<MapPin className="h-3.5 w-3.5" />}>
                Buscar CEP
              </Button>
            </div>
            <Input
              label="Endereço"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="Rua, número e bairro"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Cidade" value={companyCity} onChange={(event) => setCompanyCity(event.target.value)} />
              <Input label="Estado (UF)" value={companyState} onChange={(event) => setCompanyState(event.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" size="sm" type="submit">
                Salvar Dados da Empresa
              </Button>
            </div>
          </form>
        </Card>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400"><ShieldCheck className="h-5 w-5" /></div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Proteção da conta</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">As sessões do NEXUS AI podem ser encerradas neste painel. Se você usa o Google para entrar, gerencie a senha e a verificação em duas etapas na sua Conta Google.</p>
              </div>
            </div>
          </Card>

          {supabase && <Card className="p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sessões da conta</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">Use esta opção se você entrou em outro dispositivo e quer encerrar as sessões de lá.</p>
            <Button type="button" variant="outline" size="sm" isLoading={endingOtherSessions} onClick={endOtherSessions}>Encerrar outras sessões</Button>
          </Card>}

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Lock className="h-4 w-4 text-brand-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Alterar senha</h3>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Nova senha *" type="password" required minLength={6} autoComplete="new-password" value={newPass} onChange={(event) => setNewPass(event.target.value)} placeholder="Mínimo 6 caracteres" />
                <Input label="Confirmar nova senha *" type="password" required minLength={6} autoComplete="new-password" value={confirmPass} onChange={(event) => setConfirmPass(event.target.value)} placeholder="Repita a nova senha" />
              </div>
              <div className="flex justify-end">
                <Button variant="primary" size="sm" type="submit" isLoading={isChangingPass}>Atualizar senha</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aparência</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Escolha o tema para este dispositivo. A preferência é salva automaticamente.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                { value: 'light', label: 'Tema claro', description: 'Fundo claro e alto contraste', icon: Sun },
                { value: 'dark', label: 'Tema escuro', description: 'Confortável em ambientes pouco iluminados', icon: Moon },
              ] as const).map((option) => {
                const Icon = option.icon;
                const selected = theme === option.value;
                return (
                  <button key={option.value} type="button" aria-pressed={selected} onClick={() => setTheme(option.value)} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${selected ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-500/20 dark:bg-brand-950/30' : 'border-slate-200 bg-white hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700'}`}>
                    <Icon className="mt-0.5 h-5 w-5 text-brand-500" />
                    <span><strong className="block text-sm text-slate-900 dark:text-white">{option.label}</strong><small className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{option.description}</small></span>
                  </button>
                );
              })}
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Formato regional</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">O sistema utiliza Português (Brasil), moeda Real (R$) e datas no formato brasileiro.</p>
          </Card>
        </div>
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
