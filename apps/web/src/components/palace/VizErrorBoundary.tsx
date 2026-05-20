import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class VizErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('[VizErrorBoundary]', error.message);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center h-64 bg-slate-900/50 rounded-xl border border-red-500/20 p-6">
          <AlertTriangle size={32} className="text-red-400 mb-3" />
          <p className="text-slate-300 font-medium mb-1">3D Renderer Error</p>
          <p className="text-sm text-slate-500 mb-4 text-center max-w-md">
            {this.state.error?.message || 'An error occurred while rendering the 3D scene.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            <RefreshCw size={14} className="mr-2" /> Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
