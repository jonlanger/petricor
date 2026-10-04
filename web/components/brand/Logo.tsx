/** Petricor wordmark + dish mark (from the original brand board: blue block, mono type, dish-in-perspective mark). */
export function Mark({ className = 'h-8 w-8', inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="6" fill={inverted ? '#ffffff' : '#3a44ff'} />
      <g fill="none" stroke={inverted ? '#3a44ff' : '#ffffff'} strokeWidth="3.2">
        <ellipse cx="20" cy="17.5" rx="9.5" ry="9.5" />
        <path d="M10.5 21.5c0 5.2 4.3 9 9.5 9s9.5-3.8 9.5-9" />
      </g>
    </svg>
  )
}

export default function Logo({ className = 'h-7', inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark className="h-full w-auto" inverted={inverted} />
      <span className={`font-mono text-[1.05em] font-semibold tracking-tight ${inverted ? 'text-white' : 'text-ink'}`} style={{ fontSize: 'inherit' }}>PetriCor</span>
    </span>
  )
}
