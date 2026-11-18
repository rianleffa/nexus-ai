import React, { Component, lazy, useMemo, useState } from 'react';

type LazyLoader = () => Promise<React.ComponentType<any>>;

interface RetryableLazyProps {
  load: LazyLoader;
  componentProps?: Record<string, unknown>;
}

interface BoundaryProps {
  children: React.ReactNode;
  onRetry: () => void;
}

interface BoundaryState {
  error: Error | null;
}

const isChunkLoadError = (error: Error) =>
  /failed to fetch dynamically imported module|importing a module script failed|loading chunk|unable to preload css|module script.*failed/i.test(error.message);

class PageErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Nexus navigation] Page failed to load or render.', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkFailure = isChunkLoadError(error);
    return (
      <section className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-6 text-center" role="alert" aria-live="assertive">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Não foi possível abrir esta página</h2>
          <p className="mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-300">
            {chunkFailure
              ? 'A conexão pode ter falhado durante o carregamento. Tente novamente ou carregue a versão mais recente.'
              : 'Ocorreu um erro ao exibir esta página. Você pode tentar novamente.'}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={this.props.onRetry} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
            Tentar novamente
          </button>
          {chunkFailure && (
            <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Recarregar versão
            </button>
          )}
        </div>
      </section>
    );
  }
}

const withTimeout = <T,>(promise: Promise<T>, milliseconds: number) => new Promise<T>((resolve, reject) => {
  const timeout = window.setTimeout(() => reject(new Error('O carregamento da página excedeu o tempo limite.')), milliseconds);
  promise.then(
    (value) => { window.clearTimeout(timeout); resolve(value); },
    (error: unknown) => { window.clearTimeout(timeout); reject(error); },
  );
});

const loadWithRetry = async (load: LazyLoader) => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const Component = await withTimeout(load(), 12_000);
      return { default: Component };
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 350));
    }
  }
  throw lastError;
};

export const RetryableLazy: React.FC<RetryableLazyProps> = ({ load, componentProps = {} }) => {
  const [attempt, setAttempt] = useState(0);
  const LazyComponent = useMemo(() => lazy(() => loadWithRetry(load)), [attempt, load]);

  return (
    <PageErrorBoundary key={attempt} onRetry={() => setAttempt((value) => value + 1)}>
      <React.Suspense
        fallback={(
          <div className="min-h-[40vh] flex items-center justify-center gap-3 p-6 text-sm text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-brand-500" />
            Carregando página…
          </div>
        )}
      >
        <LazyComponent {...componentProps} />
      </React.Suspense>
    </PageErrorBoundary>
  );
};
