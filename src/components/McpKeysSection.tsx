import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, Copy, Loader2, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface McpCle {
  id: string
  nom: string
  prefixe: string
  derniere_utilisation: string | null
  created_at: string
}

async function sha256Hex(value: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

function generateKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return 'crm_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function McpKeysSection() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [nom, setNom] = useState('ChatGPT')
  const [newKey, setNewKey] = useState<string | null>(null)

  const mcpBase = window.location.origin

  const { data: cles = [], isLoading } = useQuery({
    queryKey: ['mcp_cles'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mcp_cles')
        .select('id, nom, prefixe, derniere_utilisation, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as McpCle[]
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const key = generateKey()
      const { error } = await supabase.from('mcp_cles').insert({
        user_id: user!.id,
        nom: nom.trim() || 'ChatGPT',
        prefixe: key.slice(0, 8),
        cle_hash: await sha256Hex(key),
      })
      if (error) throw error
      return key
    },
    onSuccess: (key) => {
      setNewKey(key)
      qc.invalidateQueries({ queryKey: ['mcp_cles'] })
    },
    onError: () => toast.error('Impossible de créer la clé'),
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('mcp_cles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Clé révoquée')
      qc.invalidateQueries({ queryKey: ['mcp_cles'] })
    },
    onError: () => toast.error('Impossible de révoquer la clé'),
  })

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copié'))
  }

  return (
    <div className="card">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 mb-2">
        <span className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
          <Bot size={15} className="text-brand-700" />
        </span>
        Accès ChatGPT (MCP)
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Permet à ChatGPT de <strong>consulter</strong> vos clients, devis, factures et statistiques, et de{' '}
        <strong>créer</strong> des clients, devis et factures (abonnement requis pour les documents).
        Il peut modifier un devis non signé, mais jamais une facture, et ne peut rien supprimer. La clé ne donne accès qu'à votre compte et uniquement à cette fonction.
      </p>

      <div className="text-sm mb-4">
        <p className="text-slate-500 mb-1">
          Créez une clé : vous obtiendrez l'adresse complète à coller dans Claude ou ChatGPT
          (Paramètres → Connecteurs → Ajouter un connecteur personnalisé, sans authentification).
        </p>
      </div>

      {newKey && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4 text-sm">
          <p className="font-medium text-amber-800 mb-1">
            Copiez cette adresse maintenant : elle contient votre clé secrète et ne sera plus affichée.
            Ne la partagez avec personne.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white rounded px-2 py-1 text-xs break-all">{`${mcpBase}/mcp/${newKey}`}</code>
            <button className="btn-secondary" onClick={() => copy(`${mcpBase}/mcp/${newKey}`)} aria-label="Copier l'adresse">
              <Copy size={14} />
            </button>
          </div>
          <p className="text-xs text-amber-700 mt-2">
            Claude Code / Claude Desktop : vous pouvez aussi utiliser {`${mcpBase}/api/mcp`} avec l'en-tête
            {' '}<code>Authorization: Bearer {newKey.slice(0, 8)}…</code>
          </p>
          <button className="text-xs text-amber-700 underline mt-2" onClick={() => setNewKey(null)}>
            J'ai copié l'adresse
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <input
          className="input flex-1"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Nom de la clé"
          maxLength={50}
        />
        <button className="btn-primary" onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer une clé
        </button>
      </div>

      {isLoading ? (
        <Loader2 size={16} className="animate-spin text-slate-400" />
      ) : cles.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune clé active.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {cles.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-slate-700">
                  {c.nom} <span className="text-slate-400 font-normal">· {c.prefixe}…</span>
                </p>
                <p className="text-xs text-slate-400">
                  {c.derniere_utilisation
                    ? `Dernière utilisation : ${new Date(c.derniere_utilisation).toLocaleString('fr-FR')}`
                    : 'Jamais utilisée'}
                </p>
              </div>
              <button
                className="text-red-500 hover:text-red-700 p-1"
                onClick={() => confirm(`Révoquer la clé « ${c.nom} » ?`) && revoke.mutate(c.id)}
                aria-label="Révoquer la clé"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
