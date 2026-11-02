import React, { useState } from 'react';
import { AlertCircle, Check, X, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';

interface AIConfirmationCardProps {
  confirmationId: string;
  toolName: string;
  parameters: Record<string, any>;
  message: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export const AIConfirmationCard: React.FC<AIConfirmationCardProps> = ({
  toolName,
  parameters,
  message,
  onConfirm,
  onCancel,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isResolved, setIsResolved] = useState<'confirmed' | 'cancelled' | null>(null);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      setIsResolved('confirmed');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsResolved('cancelled');
    onCancel();
  };

  if (isResolved === 'confirmed') {
    return (
      <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
        <span className="font-medium">Operação autorizada e executada com sucesso.</span>
      </div>
    );
  }

  if (isResolved === 'cancelled') {
    return (
      <div className="mt-3 p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
        <X className="w-4 h-4 text-slate-400 shrink-0" />
        <span>Operação cancelada pelo usuário. Nenhuma alteração foi realizada.</span>
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-xl border-2 border-amber-300/80 dark:border-amber-600/60 bg-amber-50/70 dark:bg-amber-950/30 text-xs shadow-sm space-y-3">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
            Confirmação de Ação Sensível Obrigatória
          </h4>
          <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50 font-mono text-[11px] text-slate-600 dark:text-slate-400">
        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Ação pendente: <span className="text-amber-600 dark:text-amber-400">{toolName}</span>
        </div>
        <div>Parâmetros validados: {JSON.stringify(parameters)}</div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={isLoading}
          leftIcon={<X className="w-3.5 h-3.5" />}
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleConfirm}
          isLoading={isLoading}
          leftIcon={<Check className="w-3.5 h-3.5" />}
          className="bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500"
        >
          Confirmar Lançamento
        </Button>
      </div>
    </div>
  );
};
