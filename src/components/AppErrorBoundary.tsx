import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { error: Error | null };

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Whybrary render error.', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="loading-shell">
        <div className="loading-card loading-card--error">
          <p className="eyebrow">Whybrary</p>
          <h1>Something went wrong</h1>
          <p>Your local data was not cleared. Reload the app to try again.</p>
          <button
            className="button button--accent"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload
          </button>
        </div>
      </main>
    );
  }
}
