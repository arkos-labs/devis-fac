import { Link } from 'react-router-dom'
import { Sparkles, CheckCircle2, ArrowRight, Zap, Shield, FileText } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-brand-200 selection:text-brand-900">
      {/* ── Navigation ── */}
      <nav className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glass">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-800 tracking-tight">CleanCRM</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-brand-600 transition-colors">
              Se connecter
            </Link>
            <Link to="/signup" className="text-sm font-bold bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 transition-colors shadow-card-hover">
              Essai gratuit
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-50 via-white to-white -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-600 text-sm font-semibold mb-8 animate-fade-in">
            <Zap size={14} className="fill-brand-600" /> 
            Générez vos devis par IA en quelques secondes
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 tracking-tight mb-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            Le CRM des pros du <span className="text-transparent bg-clip-text bg-gradient-brand">nettoyage</span>.
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg lg:text-xl text-slate-600 mb-10 animate-slide-up" style={{ animationDelay: '200ms' }}>
            Gérez vos clients, automatisez vos relances et créez des devis et factures professionnels en un éclair grâce à l'Intelligence Artificielle.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '300ms' }}>
            <Link to="/signup" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-brand-600 text-white font-bold text-lg hover:bg-brand-700 transition-all shadow-glass-lg hover:shadow-brand-500/30 hover:-translate-y-0.5 flex items-center justify-center gap-2">
              Démarrer gratuitement <ArrowRight size={20} />
            </Link>
            <Link to="/login" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-50 text-slate-700 font-bold text-lg hover:bg-slate-100 transition-all border border-slate-200">
              Voir la démo
            </Link>
          </div>
          
          <div className="mt-10 flex items-center justify-center gap-6 text-sm font-medium text-slate-500 animate-slide-up" style={{ animationDelay: '400ms' }}>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-brand-500" /> Sans engagement</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-brand-500" /> Installation en 1 min</span>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Tout ce dont vous avez besoin</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Pensé spécifiquement pour les entreprises de nettoyage, débarras et entretien.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-card hover:shadow-card-hover transition-shadow border border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6 text-brand-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Devis par IA</h3>
              <p className="text-slate-600">Décrivez la prestation ("canapé 3 places + matelas"), l'IA génère les lignes de devis avec vos prix en 2 secondes.</p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl shadow-card hover:shadow-card-hover transition-shadow border border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mb-6">
                <FileText className="w-6 h-6 text-brand-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Facturation Pro</h3>
              <p className="text-slate-600">Transformez vos devis en factures d'un clic. Signature électronique, encart avis Google et mentions légales inclus.</p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl shadow-card hover:shadow-card-hover transition-shadow border border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mb-6">
                <Shield className="w-6 h-6 text-brand-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Suivi et Relances</h3>
              <p className="text-slate-600">Relances automatiques par SMS/Email pour les impayés, les devis en attente et les demandes d'avis Google.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white py-12 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Sparkles className="w-5 h-5 text-brand-600" />
            <span className="font-bold text-lg text-slate-800">CleanCRM</span>
          </div>
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} CleanCRM. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  )
}
