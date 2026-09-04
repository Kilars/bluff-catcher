// The drill lives here — the single stateful view. Built out in Phase 4.
// See docs/PLAN.md. For now, a tokenised placeholder that proves the scaffold.

function App() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        gap: 'var(--space-4)',
        textAlign: 'center',
      }}
    >
      <div>
        <h1 style={{ fontSize: 28 }}>bluff-catcher</h1>
        <p style={{ color: 'var(--color-neutral-500)', margin: 0 }}>
          Odds trainer — scaffold ready.
        </p>
      </div>
    </main>
  )
}

export default App
