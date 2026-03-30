import { createPortal } from 'react-dom'

export default function ConfirmLockModal({ onConfirm, onCancel }) {
  return createPortal(
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.7)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fade-in 0.2s ease-out',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '340px',
          width: '90%',
          textAlign: 'center',
          border: '1px solid var(--border-glass)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'scale-in 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.15rem' }}>
          Lock Prediction?
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          Your answers cannot be changed after locking.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            style={{ flex: 1, justifyContent: 'center', padding: '0.7rem' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center', padding: '0.7rem' }}
          >
            Lock Prediction
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
