'use client';

import { Component } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * React Error Boundary — uygulama genelinde yakalanmayan render hatalarını yakalar.
 * Class component olması zorunlu çünkü fonksiyonel componentlerde getDerivedStateFromError yok.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Yakalanmayan hata:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">
              <AlertCircle size={48} />
            </div>
            <h2>Bir hata oluştu</h2>
            <p>
              Uygulama beklenmeyen bir hatayla karşılaştı.
              Aşağıdaki butona tıklayarak yeniden deneyebilirsiniz.
            </p>
            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Hata detayı</summary>
                <code>{this.state.error.message}</code>
              </details>
            )}
            <button
              className="error-boundary-btn"
              onClick={this.handleReset}
              aria-label="Uygulamayı yeniden başlat"
            >
              <RefreshCw size={16} />
              Yeniden Dene
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
