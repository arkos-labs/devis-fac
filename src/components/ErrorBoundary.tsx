import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// Sans ce filet, la moindre erreur JS pendant le rendu démonte toute
// l'app React et laisse une page blanche sans aucun message.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur applicative interceptée :', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
              <AlertTriangle size={26} className="text-red-600" />
            </div>
            <h1 className="text-lg font-bold text-slate-800">
              Une erreur est survenue
            </h1>
            <p className="text-sm text-slate-500">
              Quelque chose s'est mal passé sur cette page. Vous pouvez essayer de recharger.
            </p>
            <p className="text-xs font-mono text-slate-400 bg-slate-100 rounded-lg p-3 break-words">
              {this.state.error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary mx-auto"
            >
              <RefreshCw size={14} /> Recharger la page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
