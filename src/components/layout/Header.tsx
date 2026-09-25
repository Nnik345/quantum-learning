import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'

/**
 * Four entries, not four tracks. Home says what the site is, the path is the way through, and
 * reference is for browsing once you know what you are looking for.
 */
const NAV = [
  { to: '/', label: 'Home', exact: true },
  { to: '/path', label: 'Path' },
  { to: '/reference', label: 'Reference' },
  { to: '/circuit', label: 'Circuit Lab' },
]

export function Header() {
  const [open, setOpen] = useState(false)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'rounded-md px-3 py-1.5 text-sm transition-colors',
      isActive ? 'bg-surface-2 text-cyan' : 'text-ink-dim hover:bg-surface hover:text-ink',
    ].join(' ')

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 shrink-0" onClick={() => setOpen(false)}>
          <Logo />
          <span className="font-semibold tracking-tight">
            Quantum<span className="text-cyan">Learn</span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.exact} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle navigation"
          className="ml-auto rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim md:hidden"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={linkClass}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="2.4" fill="#22d3ee" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="#a78bfa" strokeWidth="1.3" />
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="4.2"
        stroke="#22d3ee"
        strokeWidth="1.3"
        transform="rotate(60 12 12)"
        opacity="0.75"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="4.2"
        stroke="#a78bfa"
        strokeWidth="1.3"
        transform="rotate(120 12 12)"
        opacity="0.55"
      />
    </svg>
  )
}
