import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  Search,
  Download,
  Trash2,
  Eye,
  Folder,
  Plus,
  File,
  CheckCircle2,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  FolderPlus,
  Filter,
  Calendar,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { dataStore } from '../services/dataStore';
import { Document, DocumentCategory } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase';

const LOCAL_FILE_LIMIT_BYTES = 2 * 1024 * 1024;

const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
  reader.readAsDataURL(file);
});

interface DocumentsProps {
  onNavigate?: (page: string, prompt?: string, params?: Record<string, any>) => void;
}

export const Documents: React.FC<DocumentsProps> = ({ onNavigate }) => {
  const { user, company } = useAuth();
  const { showToast } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Upload Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Contratos');
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const clients = dataStore.getClients();

  const refresh = () => {
    setDocuments(dataStore.getDocuments());
    setCategories(dataStore.getDocumentCategories());
  };

  useEffect(() => {
    refresh();
    const unsub = dataStore.subscribe(refresh);
    return unsub;
  }, []);

  useEffect(() => {
    let active = true;
    setPreviewUrl(previewDoc?.data_url || '');
    if (previewDoc && !previewDoc.data_url && isSupabaseConfigured && supabase && previewDoc.file_path.startsWith(`${company?.id}/`)) {
      setIsPreviewLoading(true);
      supabase.storage.from('documents').createSignedUrl(previewDoc.file_path, 120)
        .then(({ data, error }) => {
          if (!active) return;
          if (error) throw error;
          setPreviewUrl(data.signedUrl);
        })
        .catch((error) => {
          if (active) {
            console.warn('[Documents] Não foi possível abrir a pré-visualização.', error);
            setPreviewUrl('');
          }
        })
        .finally(() => {
          if (active) setIsPreviewLoading(false);
        });
    } else {
      setIsPreviewLoading(false);
    }
    return () => { active = false; };
  }, [previewDoc, company?.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = isSupabaseConfigured ? 25 * 1024 * 1024 : LOCAL_FILE_LIMIT_BYTES;
    if (file.size > maxSize) {
      setSelectedFile(null);
      showToast(isSupabaseConfigured
        ? 'O arquivo selecionado excede o limite de 25 MB.'
        : 'No modo local, selecione um arquivo de até 2 MB. Conecte o armazenamento para enviar arquivos maiores.', 'warning');
      return;
    }

    setSelectedFile(file);
    if (!title) {
      setTitle(file.name);
    }

  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedFile) {
      showToast('Selecione um arquivo real e informe o título do documento.', 'warning');
      return;
    }

    setIsUploading(true);
    let uploadedPath = '';
    try {
      const fileType = selectedFile.type || 'application/octet-stream';
      const fileSize = `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`;
      const safeFilename = selectedFile.name.normalize('NFKD').replace(/[^\w.-]+/g, '_');
      let filePath = `local/${crypto.randomUUID()}/${safeFilename}`;
      let dataUrl: string | undefined;

      if (isSupabaseConfigured) {
        if (!supabase || !company?.id || !user?.id) {
          throw new Error('Entre na sua conta antes de enviar documentos ao armazenamento da empresa.');
        }
        uploadedPath = `${company.id}/${crypto.randomUUID()}-${safeFilename}`;
        const { error } = await supabase.storage.from('documents').upload(uploadedPath, selectedFile, {
          cacheControl: '3600',
          contentType: fileType,
          upsert: false,
        });
        if (error) throw error;
        filePath = uploadedPath;
      } else {
        dataUrl = await readFileAsDataUrl(selectedFile);
      }

      const client = clients.find((item) => item.id === clientId);
      const savedDoc = await dataStore.addDocument({
        title: title.trim(),
        category,
        client_name: client?.name || clientName.trim() || undefined,
        client_id: client?.id,
        file_path: filePath,
        file_size: fileSize,
        file_type: fileType,
        mime_type: fileType,
        data_url: dataUrl,
        uploaded_by: user?.name || 'Demonstração local',
      });

      if (!savedDoc) {
        if (uploadedPath && supabase) await supabase.storage.from('documents').remove([uploadedPath]);
        throw new Error('O arquivo foi enviado, mas não foi possível salvar seu cadastro. Confira as políticas do Supabase.');
      }

      showToast(`Documento "${title.trim()}" enviado com sucesso.`, 'success');
      setIsUploadModalOpen(false);
      setTitle('');
      setClientName('');
      setClientId('');
      setSelectedFile(null);
    } catch (error: any) {
      if (uploadedPath && supabase) {
        await supabase.storage.from('documents').remove([uploadedPath]).catch(() => undefined);
      }
      showToast(error?.message || 'Não foi possível salvar o documento.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const saved = await dataStore.addDocumentCategory(newCategoryName.trim());
    if (!saved) {
      showToast('Não foi possível salvar a categoria. Confira as permissões e tente novamente.', 'error');
      return;
    }
    showToast(`Categoria "${newCategoryName.trim()}" criada com sucesso!`, 'success');
    setNewCategoryName('');
    setIsNewCategoryModalOpen(false);
    refresh();
  };

  const handleDelete = async (id: string, docTitle: string) => {
    if (confirm(`Deseja realmente remover o documento "${docTitle}"?`)) {
      const deleted = await dataStore.deleteDocument(id);
      if (!deleted) {
        showToast('Não foi possível excluir o documento ou o arquivo no armazenamento.', 'error');
        return;
      }
      showToast('Documento excluído com sucesso.', 'info');
      if (previewDoc?.id === id) setPreviewDoc(null);
    }
  };

  const handleDownload = async (doc: Document) => {
    if (doc.data_url) {
      const link = window.document.createElement('a');
      link.href = doc.data_url;
      link.download = doc.title;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      showToast(`Download de "${doc.title}" concluído.`, 'success');
    } else if (isSupabaseConfigured && supabase && doc.file_path.startsWith(`${company?.id}/`)) {
      try {
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 120);
        if (error) throw error;
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error('O arquivo não pôde ser baixado.');
        const url = URL.createObjectURL(await response.blob());
        const link = window.document.createElement('a');
        link.href = url;
        link.download = doc.title;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast(`Download de "${doc.title}" concluído.`, 'success');
      } catch (error: any) {
        showToast(error?.message || 'Não foi possível baixar o arquivo.', 'error');
      }
    } else {
      showToast('O arquivo original não está disponível neste registro.', 'warning');
    }
  };

  // Filter & Sort
  const filteredDocs = documents
    .filter((doc) => {
      const matchesCategory =
        selectedCategory === 'all' || doc.category === selectedCategory;
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.client_name && doc.client_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        doc.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title);
      if (sortBy === 'size') return parseFloat(b.file_size) - parseFloat(a.file_size);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const getFileIcon = (fileType: string, title: string) => {
    const t = (fileType || title).toLowerCase();
    if (t.includes('image') || t.includes('png') || t.includes('jpg') || t.includes('jpeg')) {
      return <ImageIcon className="w-5 h-5 text-blue-500" />;
    }
    if (t.includes('sheet') || t.includes('xls') || t.includes('csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    }
    return <FileText className="w-5 h-5 text-rose-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-500" />
            <span>Documentos da Empresa</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organize e baixe arquivos reais. No modo local, eles ficam salvos neste navegador.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => setIsNewCategoryModalOpen(true)}
            leftIcon={<FolderPlus className="w-4 h-4" />}
          >
            + Nova Categoria
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsUploadModalOpen(true)}
            leftIcon={<UploadCloud className="w-4 h-4" />}
            className="shadow-glow"
          >
            + Enviar Arquivo
          </Button>
        </div>
      </div>

      {/* Category Folders Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div
          onClick={() => setSelectedCategory('all')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            selectedCategory === 'all'
              ? 'bg-brand-50/50 dark:bg-brand-950/40 border-brand-500 text-brand-600 dark:text-brand-400 shadow-xs'
              : 'bg-white dark:bg-[#111827] border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300'
          }`}
        >
          <Folder className="w-5 h-5 mb-1 text-brand-500" />
          <p className="text-xs font-bold truncate">Todos</p>
          <span className="text-[10px] text-slate-400">{documents.length} arquivos</span>
        </div>

        {categories.map((cat) => {
          const count = documents.filter((d) => d.category === cat).length;
          const isSel = selectedCategory === cat;

          return (
            <div
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                isSel
                  ? 'bg-brand-50/50 dark:bg-brand-950/40 border-brand-500 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'bg-white dark:bg-[#111827] border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300'
              }`}
            >
              <Folder className={`w-5 h-5 mb-1 ${isSel ? 'text-brand-500' : 'text-slate-400'}`} />
              <p className="text-xs font-bold truncate" title={cat}>{cat}</p>
              <span className="text-[10px] text-slate-400">{count} arquivos</span>
            </div>
          );
        })}
      </div>

      {/* Search & Sort Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, cliente ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
          <span className="text-slate-400">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
          >
            <option value="date">Data de Envio (Recentes)</option>
            <option value="name">Nome (A-Z)</option>
            <option value="size">Tamanho do Arquivo</option>
          </select>
        </div>
      </div>

      {/* Documents Grid */}
      {filteredDocs.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Nenhum documento encontrado
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Não há arquivos cadastrados para a categoria ou termo de busca selecionado.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsUploadModalOpen(true)}
          >
            Enviar Primeiro Arquivo
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredDocs.map((doc) => (
            <Card key={doc.id} hoverable className="p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                    {getFileIcon(doc.file_type, doc.title)}
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
                    {doc.category}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={doc.title}>
                    {doc.title}
                  </h4>
                  {doc.client_name ? (
                    <button
                      type="button"
                      onClick={() => {
                        const cid = doc.client_id || dataStore.findClientByName(doc.client_name!)?.id;
                        if (cid && onNavigate) {
                          onNavigate('clients', undefined, { clientId: cid });
                        }
                      }}
                      className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline mt-0.5 truncate block text-left font-medium"
                      title="Ver Cliente 360°"
                    >
                      Cliente: {doc.client_name}
                    </button>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      Documento Geral da Empresa
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 font-mono">{doc.file_size}</span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    className="p-1.5 text-slate-400 hover:text-brand-500 rounded-lg transition-colors"
                    title="Pré-visualizar informações"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 text-slate-400 hover:text-emerald-500 rounded-lg transition-colors"
                    title="Baixar arquivo seguro"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id, doc.title)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                    title="Excluir documento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Upload de Arquivo */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Seguro de Documento"
        subtitle={isSupabaseConfigured
          ? 'O arquivo será enviado ao bucket privado do Supabase e associado à sua empresa.'
          : 'No modo local, o arquivo fica salvo somente neste navegador (limite de 2 MB).'}
        maxWidth="md"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50 dark:bg-slate-900/40"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
              className="hidden"
            />
            <UploadCloud className="w-8 h-8 text-brand-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {selectedFile ? selectedFile.name : 'Clique para selecionar um arquivo'}
            </p>
            <span className="text-[10px] text-slate-400 block mt-1">
              PDF, DOCX, XLSX, PNG, JPG {isSupabaseConfigured ? '(até 25 MB)' : '(até 2 MB neste navegador)'}
            </span>
          </button>

          <Input
            label="Título do Documento *"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Contrato_Prestacao_Servicos.pdf"
          />

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Categoria de Organização
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Cliente Vinculado (Opcional)
            </label>
            <select
              value={clientId}
              onChange={(e) => {
                const id = e.target.value;
                setClientId(id);
                const sel = clients.find((c) => c.id === id);
                if (sel) {
                  setClientName(sel.name);
                } else {
                  setClientName('');
                }
              }}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="">Nenhum / Documento Geral da Empresa</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company_name ? `(${c.company_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsUploadModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={isUploading}>
              Enviar arquivo
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Nova Categoria */}
      <Modal
        isOpen={isNewCategoryModalOpen}
        onClose={() => setIsNewCategoryModalOpen(false)}
        title="Criar Nova Categoria"
        subtitle="Organize seus arquivos em categorias personalizadas"
        maxWidth="sm"
      >
        <form onSubmit={handleAddCategory} className="space-y-4">
          <Input
            label="Nome da Categoria *"
            required
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Ex: Laudos Técnicos, Auditoria, Marketing"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsNewCategoryModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Criar Categoria
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Visualizador de Documento */}
      {previewDoc && (
        <Modal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={`Visualizador: ${previewDoc.title}`}
          subtitle={`Categoria: ${previewDoc.category} • Tamanho: ${previewDoc.file_size}`}
          maxWidth="xl"
        >
          <div className="space-y-4 text-center">
            {isPreviewLoading ? (
              <div className="py-10 text-xs text-slate-500">Carregando pré-visualização…</div>
            ) : previewUrl && previewDoc.file_type.startsWith('image/') ? (
              <div className="max-h-72 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <img
                  src={previewUrl}
                  alt={previewDoc.title}
                  className="w-full h-auto object-contain mx-auto"
                />
              </div>
            ) : previewUrl && previewDoc.file_type === 'application/pdf' ? (
              <iframe src={previewUrl} title={`Pré-visualização de ${previewDoc.title}`} className="w-full h-[60vh] rounded-xl border border-slate-200 dark:border-slate-800" />
            ) : (
              <div className="p-8 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <FileText className="w-16 h-16 text-brand-500 mx-auto" />
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    {previewDoc.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">A pré-visualização não está disponível para este tipo de arquivo.</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enviado por: {previewDoc.uploaded_by || 'Administrador'} em{' '}
                    {new Date(previewDoc.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewDoc(null)}
              >
                Fechar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDownload(previewDoc)}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Baixar Arquivo
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
