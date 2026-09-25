import { Component, ErrorInfo, ReactNode } from 'react';

// Si algo falla al dibujar la app, mostrar una pantalla útil en vez de una pantalla en blanco
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  declare readonly props: { children: ReactNode };
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FotoMed+ se cayó:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-8 text-center text-ink">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-16 w-16 rounded-2xl" />
        <h1 className="text-2xl font-bold">Algo salió mal</h1>
        <p className="max-w-sm text-muted">La app tuvo un problema al abrir. Intenta de nuevo; tus datos siguen guardados.</p>
        <button onClick={() => location.reload()} className="rounded-2xl bg-brand px-6 py-3.5 font-semibold text-white">
          Reintentar
        </button>
        <p className="max-w-sm break-words text-xs text-faint">Detalle: {this.state.error.message}</p>
      </div>
    );
  }
}
