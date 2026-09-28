import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Icon } from '../Icon/Icon';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
        }}>
          <p style={{ marginBottom: '1rem' }}>
            <Icon name="attention" size={48} variant="fill" style={{ color: 'var(--color-warning)' }} />
          </p>
          <h2 style={{ marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
            エラーが発生しました
          </h2>
          <p style={{ marginBottom: '1rem' }}>
            予期せぬエラーが発生しました。ページを再読み込みしてください。
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
