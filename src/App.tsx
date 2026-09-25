import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'

import { Header } from './components/layout/Header'
import { Home } from './routes/Home'
import { PathHome } from './routes/PathHome'
import { Reference } from './routes/Reference'
import { TrackIndex } from './routes/TrackIndex'
import { TopicPage } from './routes/TopicPage'
import { CircuitBoard } from './circuit/CircuitBoard'
import { PythonHome } from './routes/python/PythonHome'
import { PythonPlayground } from './routes/python/PythonPlayground'
import { PythonLesson } from './routes/python/PythonLesson'
import { AssistantPanel } from './assistant/AssistantPanel'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/path" element={<PathHome />} />
          <Route path="/reference" element={<Reference />} />
          <Route path="/circuit" element={<CircuitBoard />} />
          {/* Playground before the dynamic slug, so the two cannot be confused. */}
          <Route path="/python" element={<PythonHome />} />
          <Route path="/python/playground" element={<PythonPlayground />} />
          <Route path="/python/:slug" element={<PythonLesson />} />
          <Route path="/:trackId" element={<TrackIndex />} />
          <Route path="/:trackId/:slug" element={<TopicPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <AssistantPanel />
    </div>
  )
}

/** Jump to the top on navigation, but leave in-page anchor links alone. */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-mono text-5xl text-cyan">|404⟩</h1>
      <p className="mt-4 text-ink-dim">
        That page is not in any basis state we know about.
      </p>
      <Link to="/" className="mt-6 inline-block text-sm text-cyan hover:underline">
        ← Back home
      </Link>
    </div>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
        <span>Built for learning quantum computing.</span>
        <span className="font-mono">
          q0 = top wire = leftmost ket symbol (textbook order)
        </span>
      </div>
    </footer>
  )
}
