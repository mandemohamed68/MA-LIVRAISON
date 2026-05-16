import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // If it's a dynamic import failure (like standard Vite chunk load errors), auto-reload the page
    if (error.message && (error.message.includes('Failed to fetch dynamically imported module') || error.message.includes('Importing a module script failed'))) {
      window.location.reload();
    }
  }

  public render() {
    const { hasError, error } = this.state;
    const { children } = (this as any).props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white p-10 rounded-[32px] shadow-xl border border-slate-100 flex flex-col items-center"
          >
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 text-rose-500">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic mb-4">
              Oups ! Un problème est survenu
            </h1>
            <p className="text-slate-500 font-medium text-sm mb-8 leading-relaxed">
              L'application a rencontré une erreur inattendue. Veuillez rafraîchir la page ou réessayer plus tard.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-slate-900 text-white rounded-2xl font-black text-[12px] uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
            >
              <RefreshCcw className="w-5 h-5" />
              Rafraîchir
            </button>
            {error && (
              <p className="mt-8 text-[10px] font-mono text-slate-400 bg-slate-50 p-4 rounded-xl w-full overflow-hidden text-ellipsis whitespace-nowrap border border-slate-100">
                {error.toString()}
              </p>
            )}
          </motion.div>
        </div>
      );
    }

    return children;
  }
}
