import { Link } from 'react-router-dom'
import { Sparkles, CheckCircle2, ArrowRight, Zap, Shield, FileText } from 'lucide-react'
import ProductShowcase from '@/components/landing/ProductShowcase'

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
            <span className="font-bold text-xl text-slate-800 tracking-tight">CRM Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-brand-600 transition-colors">
              Se connecter
            </Link>
            <Link to="/signup" className="text-sm font-bold bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 transition-colors shadow-card-hover">
              Essai gratuit
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-50 via-white to-white -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-600 text-sm font-semibold mb-8 animate-fade-in">
            <Zap size={14} className="fill-brand-600" /> 
            Générez vos devis par IA en quelques secondes
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 tracking-tight mb-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            Le CRM des <span className="text-transparent bg-clip-text bg-gradient-brand">indépendants</span> et des TPE.
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg lg:text-xl text-slate-600 mb-10 animate-slide-up" style={{ animationDelay: '200ms' }}>
            Gérez vos clients, automatisez vos relances et créez des devis et factures professionnels en un éclair grâce à l'Intelligence Artificielle.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '300ms' }}>
            <Link to="/signup" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-brand-600 text-white font-bold text-lg hover:bg-brand-700 transition-all shadow-glass-lg hover:shadow-brand-500/30 hover:-translate-y-0.5 flex items-center justify-center gap-2">
              Démarrer gratuitement <ArrowRight size={20} />
            </Link>
            <Link to="/login" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-50 text-slate-700 font-bold text-lg hover:bg-slate-100 transition-all border border-slate-200 shadow-sm hover:-translate-y-0.5">
              Voir la démo
            </Link>
          </div>
          
          <div className="mt-8 flex items-center justify-center gap-6 text-sm font-medium text-slate-500 animate-slide-up" style={{ animationDelay: '400ms' }}>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-brand-500" /> Sans engagement</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-brand-500" /> Installation en 1 min</span>
          </div>


        </div>
      </section>

      {/* ── Aperçu produit ── */}
      <ProductShowcase />

      {/* ── Features ── */}
      <section className="py-24 bg-slate-50 border-y border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">Tout ce dont vous avez besoin</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">Pensé spécifiquement pour vous faire gagner du temps sur l'administratif.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/60 backdrop-blur-xl p-8 rounded-3xl shadow-card hover:shadow-card-hover transition-all duration-300 border border-white hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-brand shadow-glass flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Devis propulsés par l'IA</h3>
              <p className="text-slate-600 leading-relaxed">Décrivez simplement votre prestation, l'IA génère instantanément les lignes de devis détaillées et professionnelles.</p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-xl p-8 rounded-3xl shadow-card hover:shadow-card-hover transition-all duration-300 border border-white hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-brand shadow-glass flex items-center justify-center mb-6">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Facturation Professionnelle</h3>
              <p className="text-slate-600 leading-relaxed">Transformez vos devis en factures en un clic. Suivi des paiements, acomptes et génération PDF pixel-perfect intégrés.</p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-xl p-8 rounded-3xl shadow-card hover:shadow-card-hover transition-all duration-300 border border-white hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-brand shadow-glass flex items-center justify-center mb-6">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Suivi et Relances</h3>
              <p className="text-slate-600 leading-relaxed">Automatisez vos relances clients pour les factures impayées, les devis en attente et boostez votre récolte d'avis Google.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white py-12 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glass">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-800">CRM Pro</span>
          </div>
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} CRM Pro. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  )
}
