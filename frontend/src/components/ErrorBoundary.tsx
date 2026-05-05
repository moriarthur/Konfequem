import { Component, type ReactNode, type ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundaryInternal extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-surface-base border border-border-subtle rounded-xl p-6 max-w-md w-full text-center">
            <div className="w-12 h-12 bg-status-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-status-danger"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h8m-8 0H8m8 0V8m0 0h8M8 8H8"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-accent-secondary mb-2">Something went wrong</h2>
            <p className="text-sm text-accent-secondary/70 mb-4">
              We encountered an unexpected error. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return <ErrorBoundaryInternal>{children}</ErrorBoundaryInternal>;
}
