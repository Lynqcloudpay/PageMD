import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-paper-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
                        <p className="text-ink-700 mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                            className="px-4 py-2 bg-paper-700 text-white rounded-md hover:bg-paper-800"
                        >
                            Reload Page
                        </button>
                        <details className="mt-4">
                            <summary className="cursor-pointer text-sm text-ink-500">Error Details</summary>
                            <pre className="mt-2 p-4 bg-paper-100 rounded text-xs overflow-auto">
                                {this.state.error?.stack}
                            </pre>
                        </details>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;










