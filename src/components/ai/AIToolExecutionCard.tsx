import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Wrench, ShieldCheck } from 'lucide-react';
import { ChatStep, AIToolExecutionResult } from '../../types';

interface AIToolExecutionCardProps {
  toolName: string;
  parameters: Record<string, any>;
  steps: ChatStep[];
  result?: AIToolExecutionResult;
  status: 'interpreting' | 'validating' | 'executing' | 'success' | 'error' | 'pending_confirmation';
}

export const AIToolExecutionCard: React.FC<AIToolExecutionCardProps> = ({
  toolName,
  parameters,
  steps,
  result,
  status,
}) => {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 text-xs shadow-sm">
      {/* Header with security tag */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 text-brand-500" />
          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
            Tool: {toolName}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          <ShieldCheck className="w-3 h-3" />
          <span>Execução Segura / Validada</span>
        </div>
      </div>

      {/* Steps checklist */}
      <div className="p-3 space-y-2">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-start gap-2.5">
            <div className="mt-0.5">
              {step.status === 'success' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
              {step.status === 'pending' && (
                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
              )}
              {step.status === 'warning' && (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              {step.status === 'error' && (
                <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {step.label}
              </span>
              {step.detail && (
                <span className="ml-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                  ({step.detail})
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Parameters snippet */}
        {Object.keys(parameters).length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-600 dark:text-slate-300">Parâmetros: </span>
            <span className="font-mono bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
              {JSON.stringify(parameters)}
            </span>
          </div>
        )}
      </div>

      {/* Result badge if changes were made */}
      {result?.changesMade && (
        <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border-t border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium flex items-center justify-between text-[11px]">
          <span>Registro sincronizado com a base de dados</span>
          <span className="uppercase text-[10px] tracking-wider font-bold">
            {result.changesMade.entity}: {result.changesMade.action}
          </span>
        </div>
      )}
    </div>
  );
};
