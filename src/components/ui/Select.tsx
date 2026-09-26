import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
  buttonClassName?: string
}

// Dropdown custom (remplace <select> natif) : la liste des options des selects
// natifs ne peut pas être stylée finement selon les navigateurs/OS.
export default function Select({ value, onChange, options, className, buttonClassName }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'input flex items-center justify-between gap-2 cursor-pointer text-left',
          buttonClassName
        )}
      >
        <span className="truncate">{current?.label ?? 'Sélectionner…'}</span>
        <ChevronDown size={14} className={cn('text-slate-400 flex-shrink-0 transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full min-w-max max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1.5 animate-slide-up">
          {options.map(o => {
            const isSelected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3.5 py-2 text-sm text-left transition-colors',
                  isSelected ? 'text-brand-700 font-semibold bg-brand-50' : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                {o.label}
                {isSelected && <Check size={13} className="text-brand-600 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
