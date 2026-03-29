export default function Messages() {
  return (
    <div className="page" style={{ minHeight: 'calc(100vh - 64px - 72px)', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        <h1 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Messages</h1>
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            No messages yet. Start a conversation!
          </p>
        </div>
      </div>
    </div>
  )
}
