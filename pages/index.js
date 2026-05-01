export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fdf6f0 0%, #fef9f5 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12
    }}>
      <p style={{ fontFamily: "'Great Vibes', cursive", fontSize: 48, color: '#c8903a' }}>Lahiru &amp; Dushiya</p>
      <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: 12, letterSpacing: 4, color: '#aaa', textTransform: 'uppercase' }}>24 · May · 2026</p>
    </div>
  )
}
