import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Company } from '../types';
import { defaultUser, dataStore } from '../services/dataStore';
import { AIService } from '../services/ai/aiService';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { supabaseSync } from '../services/supabaseSync';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  login: (email: string, pass: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginDemo: () => void;
  register: (name: string, companyName: string, email: string, phone: string, password: string) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  updateCompany: (updates: Partial<Company>) => Promise<boolean>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>;
  uploadAvatar: (file: File) => Promise<string>;
  removeAvatar: () => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    if (isSupabaseConfigured) return null;
    const saved = localStorage.getItem('nexus_auth_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaultUser,
          ...parsed,
          full_name: parsed.full_name || parsed.name || defaultUser.full_name,
          display_name: parsed.display_name || parsed.name || defaultUser.display_name,
          job_title: parsed.job_title || defaultUser.job_title,
          status: parsed.status || defaultUser.status,
        };
      } catch (e) {}
    }
    return null;
  });

  const [company, setCompany] = useState<Company | null>(() => {
    if (isSupabaseConfigured || !localStorage.getItem('nexus_auth_user')) return null;
    const saved = localStorage.getItem('nexus_auth_company');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });

  const applyAuthenticatedUser = useCallback(async (authUser: { id: string; email?: string; user_metadata?: Record<string, any>; created_at?: string }) => {
    if (!supabase) return false;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (profileError || !profile) {
      console.error('[Auth] Perfil da empresa não encontrado para a sessão atual.', profileError);
      setUser(null);
      setCompany(null);
      setAuthError('A conta foi autenticada, mas ainda não tem um perfil empresarial ativo. Verifique a configuração de cadastro de usuários no Supabase.');
      return false;
    }

    const companyQuery = supabase.from('companies').select('*');
    // Owner-based companies must be scoped to the authenticated user.
    const { data: companyRow, error: companyError } = await (profile.company_id
      ? companyQuery.eq('id', profile.company_id)
      : companyQuery.eq('user_id', authUser.id)
    ).maybeSingle();
    if (companyError || !companyRow) {
      console.error('[Auth] Empresa da sessão atual não encontrada.', companyError);
      setUser(null);
      setCompany(null);
      setAuthError('O perfil foi encontrado, mas a empresa vinculada não está disponível. Verifique as políticas de acesso do Supabase.');
      return false;
    }

    const displayName = profile.display_name || profile.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário';
    const tenant: Company = {
      id: companyRow.id,
      name: companyRow.name,
      cnpj: companyRow.cnpj || undefined,
      segment: companyRow.segment || undefined,
      phone: companyRow.phone || undefined,
      email: companyRow.email || undefined,
      address: companyRow.address || undefined,
      website: companyRow.website || undefined,
      city: companyRow.city || undefined,
      state: companyRow.state || undefined,
      plan: companyRow.plan || 'starter',
      created_at: companyRow.created_at || new Date().toISOString(),
      updated_at: companyRow.updated_at || undefined,
    };
    const loggedUser: User = {
      id: authUser.id,
      company_id: companyRow.id,
      name: displayName,
      full_name: profile.full_name || displayName,
      display_name: displayName,
      email: profile.email || authUser.email || '',
      role: profile.role || 'colaborador',
      job_title: profile.job_title || 'Colaborador',
      avatar_url: profile.avatar_url || '',
      phone: profile.phone || undefined,
      bio: profile.bio || undefined,
      status: profile.status || 'ativo',
      created_at: profile.created_at || authUser.created_at || new Date().toISOString(),
      updated_at: profile.updated_at || undefined,
    };

    if (dataStore.getCompany().id !== tenant.id) dataStore.clearTenantData();
    dataStore.updateCompany(tenant);
    dataStore.updateUser(loggedUser);
    setCompany(tenant);
    setUser(loggedUser);
    setAuthError(null);
    return true;
  }, []);

  // Keep state in sync with dataStore
  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      const current = dataStore.getUser();
      const currentComp = dataStore.getCompany();
      setUser((prev) => (prev ? { ...prev, ...current } : null));
      setCompany((prev) => (prev ? { ...prev, ...currentComp } : null));
    });
    return unsub;
  }, []);

  // Handle Supabase OAuth redirection & session recovery
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }
    const authClient = supabase;
    let active = true;
    const restoreSession = async () => {
      try {
        const { data: { session }, error } = await authClient.auth.getSession();
        if (error) throw error;
        if (!active) return;
        if (session?.user) {
          await applyAuthenticatedUser(session.user);
        } else {
          setUser(null);
          setCompany(null);
          dataStore.clearTenantData();
        }
      } catch (error) {
        console.error('[Auth] Não foi possível restaurar a sessão do Supabase.', error);
        if (active) {
          setUser(null);
          setCompany(null);
          setAuthError('Não foi possível restaurar sua sessão. Tente entrar novamente.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void restoreSession();

    const { data: authListener } = authClient.auth.onAuthStateChange((event, session) => {
      window.setTimeout(() => {
        if (!active) return;
        if (session?.user && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
          void applyAuthenticatedUser(session.user).finally(() => {
            if (active) setIsLoading(false);
          });
        } else if (event === 'SIGNED_OUT') {
          dataStore.clearTenantData();
          setUser(null);
          setCompany(null);
          setAuthError(null);
          setIsLoading(false);
        }
      }, 0);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [applyAuthenticatedUser]);

  useEffect(() => {
    if (user && company) {
      localStorage.setItem('nexus_auth_user', JSON.stringify(user));
      localStorage.setItem('nexus_auth_company', JSON.stringify(company));
      AIService.setContext({ user, company });
    } else {
      localStorage.removeItem('nexus_auth_user');
      localStorage.removeItem('nexus_auth_company');
    }
  }, [user, company]);

  // Remote sync with Supabase (fetch initial data & subscribe to realtime changes)
  useEffect(() => {
    if (isSupabaseConfigured && user) {
      supabaseSync.fetchRemoteData(company?.id).then((remoteData) => {
        if (remoteData) {
          dataStore.syncFromRemote(remoteData);
        }
      });

      const unsubRealtime = supabaseSync.subscribeToRealtime(async () => {
        const remoteData = await supabaseSync.fetchRemoteData(company?.id);
        if (remoteData) {
          dataStore.syncFromRemote(remoteData);
        }
      });

      return () => {
        unsubRealtime();
      };
    }
  }, [user?.id, company?.id]);

  const loginDemo = () => {
    if (isSupabaseConfigured) return;
    const demo = dataStore.getUser();
    const demoComp = dataStore.getCompany();
    setUser(demo);
    setCompany(demoComp);
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase || !email || !pass) return false;
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error || !data.user) {
        setAuthError('Não foi possível entrar. Confira o e-mail e a senha.');
        return false;
      }
      return await applyAuthenticatedUser(data.user);
    } catch (error) {
      console.error('[Auth] Não foi possível concluir o login.', error);
      setAuthError('Não foi possível conectar ao serviço de autenticação. Tente novamente.');
      return false;
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Login com Google indisponível. Configure o Supabase Auth para habilitar este acesso.' };
    }

    try {
      setAuthError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      const message = String(err?.message || '');
      const normalizedMessage = message.toLowerCase();
      const userMessage = /provider.*not enabled|unsupported provider/.test(normalizedMessage)
        ? 'O provedor Google ainda não está habilitado no Supabase Auth.'
        : /redirect.*(allow|url|match)|url.*(allow|redirect)/.test(normalizedMessage)
          ? 'A URL de retorno deste ambiente não está permitida na configuração do Supabase Auth.'
          : /network|fetch/.test(normalizedMessage)
            ? 'Não foi possível conectar ao Supabase. Verifique sua conexão e tente novamente.'
            : 'Não foi possível iniciar o login com Google. Confira a configuração OAuth do Supabase.';
      return {
        success: false,
        error: userMessage,
      };
    }
  };

  const register = async (name: string, companyName: string, email: string, phone: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'O cadastro seguro exige a configuração do Supabase Auth.' };
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, company_name: companyName, phone } },
      });
      if (error) return { success: false, error: error.message };
      if (!data.session || !data.user) {
        return { success: false, requiresEmailConfirmation: true, error: 'Cadastro criado. Confirme seu e-mail para entrar.' };
      }
      const profileReady = await applyAuthenticatedUser(data.user);
      return profileReady
        ? { success: true }
        : { success: false, error: 'A conta foi criada, mas o perfil da empresa não está disponível. Aplique as migrações do banco e tente entrar novamente.' };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Não foi possível conectar ao serviço de cadastro.' };
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<boolean> => {
    if (!user) return false;

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: updates.full_name || updates.name,
            display_name: updates.display_name,
            phone: updates.phone,
            job_title: updates.job_title,
            avatar_url: updates.avatar_url,
            bio: updates.bio,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        if (error) return false;
      }

      const updatedUser = dataStore.updateUser(updates);
      setUser(updatedUser);
      return true;
    } catch (err) {
      console.error('[Auth] Não foi possível atualizar o perfil.', err);
      return false;
    }
  };

  const updateCompany = async (updates: Partial<Company>): Promise<boolean> => {
    try {
      if (isSupabaseConfigured && supabase && company?.id) {
        const { error } = await supabase
          .from('companies')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', company.id);
        if (error) return false;
      }

      const updatedComp = dataStore.updateCompany(updates);
      setCompany(updatedComp);
      return true;
    } catch (e) {
      console.error('[Auth] Não foi possível atualizar a empresa.', e);
      return false;
    }
  };

  const changePassword = async (newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        return { success: true, message: 'Senha alterada com sucesso no Supabase Auth!' };
      } catch (e: any) {
        return { success: false, message: e?.message || 'Falha ao alterar senha no Supabase.' };
      }
    }

    return { success: true, message: 'Senha atualizada com sucesso (Modo Local/Demo)!' };
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado.');

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Formato inválido. Formatos aceitos: JPG, PNG e WEBP.');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('O arquivo excede o limite máximo permitido de 5MB.');
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const filePath = `${user.id}/profile.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        const avatarUrl = publicUrlData.publicUrl;
        await updateProfile({ avatar_url: avatarUrl });
        return avatarUrl;
      } catch (e: any) {
        console.warn('Falha no upload para o Supabase Storage, utilizando fallback local:', e);
      }
    }

    // Fallback: Base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Url = reader.result as string;
        await updateProfile({ avatar_url: base64Url });
        resolve(base64Url);
      };
      reader.onerror = () => reject(new Error('Falha ao processar arquivo de imagem.'));
      reader.readAsDataURL(file);
    });
  };

  const removeAvatar = async (): Promise<boolean> => {
    if (!user) return false;
    return await updateProfile({ avatar_url: '' });
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {}
    }
    setUser(null);
    setCompany(null);
    dataStore.clearTenantData();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        isAuthenticated: !!user,
        isLoading,
        authError,
        login,
        loginWithGoogle,
        loginDemo,
        register,
        updateProfile,
        updateCompany,
        changePassword,
        uploadAvatar,
        removeAvatar,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
