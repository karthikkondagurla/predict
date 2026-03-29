export default function Messages() {
  return (
    <div className="page" style={{ minHeight: 'calc(100vh - 64px - 72px)' }}>
      <div className="container" style={{ maxWidth: '600px', padding: '1.5rem 1rem' }}>
        <h1 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Chat</h1>
        
        <div className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Direct Messages</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            Select a friend to start chatting or join a match chat room. (Coming Soon)
          </p>
          <button className="btn btn-primary" disabled style={{ opacity: 0.7 }}>
            Start Chat
          </button>
        </div>
      </div>
    </div>
  )
}
