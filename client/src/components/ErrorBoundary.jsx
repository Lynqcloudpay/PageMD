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

        // Auto-reload on chunk load failures (stale deploy)
        const isChunkError =
            error?.message?.includes('Failed to fetch dynamically imported module') ||
            error?.message?.includes('Loading chunk') ||
            error?.message?.includes('Loading CSS chunk') ||
            error?.message?.includes('Importing a module script failed');

        if (isChunkError) {
            // Only auto-reload once to prevent infinite loops
            const lastReload = sessionStorage.getItem('chunk_error_reload');
            const now = Date.now();
            if (!lastReload || now - parseInt(lastReload) > 10000) {
                sessionStorage.setItem('chunk_error_reload', now.toString());
                console.log('[ErrorBoundary] Chunk load error detected — auto-reloading for fresh assets...');
                window.location.reload();
                return;
            }
        }
    }

    render() {
        if (this.state.hasError) {
            const isChunkError =
                this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
                this.state.error?.message?.includes('Loading chunk');

            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
                        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </div>
                        <h1 className="text-lg font-bold text-gray-900 mb-2">
                            {isChunkError ? 'New Update Available' : 'Something went wrong'}
                        </h1>
                        <p className="text-sm text-gray-500 mb-6">
                            {isChunkError
                                ? 'A new version of PageMD was deployed. Please reload to get the latest version.'
                                : (this.state.error?.message || 'An unexpected error occurred.')
                            }
                        </p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm"
                        >
                            {isChunkError ? 'Reload Now' : 'Try Again'}
                        </button>
                        {!isChunkError && (
                            <details className="mt-5 text-left">
                                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">Error Details</summary>
                                <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-[10px] overflow-auto text-gray-500 max-h-40">
                                    {this.state.error?.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
