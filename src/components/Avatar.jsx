import { useState, useEffect } from 'react'

export default function Avatar({ user, src, alt, size = 40, style = {} }) {
  const [imgError, setImgError] = useState(false)

  // Extract URL aggressively to handle different shapes of user objects (Supabase auth user vs profiles table)
  const avatarUrl = src
    || user?.avatar_url
    || user?.user_metadata?.avatar_url
    || user?.user_metadata?.picture
    || user?.raw_user_meta_data?.avatar_url
    || user?.raw_user_meta_data?.picture
    || user?.picture
    || user?.avatar
    || user?.img

  // Reset error state if the URL changes
  useEffect(() => {
    setImgError(false)
  }, [avatarUrl])

  const name = alt || user?.full_name || user?.name || user?.user_metadata?.full_name || user?.n || user?.email || '?'
  
  const initials = name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const defaultStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
    ...style
  }

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={(e) => {
          console.warn('Avatar failed to load:', avatarUrl);
          setImgError(true);
        }}
        style={defaultStyle}
      />
    )
  }

  // Fallback to initials if image fails or doesn't exist
  return (
    <div style={{
      ...defaultStyle,
      background: 'linear-gradient(135deg, var(--gold, #ff6b35), var(--purple, #2d1b4e))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: typeof size === 'number' ? size * 0.4 : '1rem',
      color: '#fff',
    }}>
      {initials || '?'}
    </div>
  )
}
