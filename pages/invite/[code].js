import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

/* ─── Intersection observer hook ─── */
function useVisible(threshold = 0.2) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

/* ─── Background music hook ───
   Starts as soon as the page loads. Loops softly at low volume.
   Browser autoplay policy: audio needs a user gesture on some browsers.
   We try silent autoplay first; if blocked we show a subtle mute/unmute button. */
function useBackgroundMusic() {
  const audioRef = useRef(null)
  const [muted, setMuted] = useState(false)
  const [started, setStarted] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const audio = new Audio('/music/background.mp3')
    audio.loop = true
    audio.volume = 0.35
    audioRef.current = audio

    const tryPlay = () => {
      audio.play()
        .then(() => { setStarted(true); setBlocked(false) })
        .catch(() => { setBlocked(true) })
    }

    // Try immediately
    tryPlay()

    // Also try on first user interaction if blocked
    const onInteract = () => {
      if (!started) { tryPlay(); window.removeEventListener('click', onInteract) }
    }
    window.addEventListener('click', onInteract)

    return () => {
      audio.pause()
      window.removeEventListener('click', onInteract)
    }
  }, [])

  const toggleMute = () => {
    if (!audioRef.current) return
    audioRef.current.muted = !audioRef.current.muted
    setMuted(m => !m)
    // If it was blocked, also try playing now
    if (blocked) {
      audioRef.current.play().then(() => { setStarted(true); setBlocked(false) }).catch(() => {})
    }
  }

  return { muted, blocked, toggleMute }
}

/* ─── Float-in animation wrapper ───
   Children float up softly from slight blur when they enter the viewport,
   with a configurable delay for staggered sequences. */
function FloatIn({ children, delay = 0, style = {} }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.15 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(22px) scale(0.98)',
      filter: visible ? 'blur(0px)' : 'blur(3px)',
      transition: `opacity 0.9s ${delay}s cubic-bezier(0.22,1,0.36,1),
                   transform 0.9s ${delay}s cubic-bezier(0.22,1,0.36,1),
                   filter 0.9s ${delay}s ease`,
      ...style
    }}>
      {children}
    </div>
  )
}

export default function InvitePage() {
  const router = useRouter()
  const { code } = router.query
  const [guest, setGuest] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const videoRef = useRef(null)
  const { muted, blocked, toggleMute } = useBackgroundMusic()

  const [videoOpacity, setVideoOpacity] = useState(1)
  const [videoDone, setVideoDone] = useState(false)

  useEffect(() => {
    if (!code) return
    fetch(`/api/guest?code=${code}`)
      .then(r => r.json())
      .then(d => { if (d.name) setGuest(d); else setNotFound(true) })
      .catch(() => setNotFound(true))
  }, [code])

  /* Autoplay as soon as video is ready */
  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    const tryPlay = () => vid.play().catch(() => {})
    vid.addEventListener('canplay', tryPlay, { once: true })
    // if already ready
    if (vid.readyState >= 3) tryPlay()
    return () => vid.removeEventListener('canplay', tryPlay)
  }, [guest]) // re-run once guest loads and video mounts

  /* Poll currentTime: start fading at 5s, finish at 8s, hide at 8s */
  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    let raf
    const tick = () => {
      const t = vid.currentTime
      if (t >= 5) {
        // linear fade: 0% opacity at 8s, 100% at 5s
        const progress = Math.min((t - 5) / 3, 1) // 0 → 1 over 3 seconds
        setVideoOpacity(1 - progress)
        if (progress >= 1) {
          setVideoDone(true)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [guest])

  const handleVideoEnd = () => setVideoDone(true)

  if (!guest && !notFound) return <Loader />
  if (notFound) return <NotFound />

  return (
    <>
      <Head>
        <title>Lahiru &amp; Dushiya Wedding — 24 May 2026</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />

        {/* ── Open Graph — WhatsApp, Facebook, iMessage all read these ── */}
        <meta property="og:type"        content="website" />
        <meta property="og:title"       content="Lahiru & Dushiya are getting married! 🪷" />
        <meta property="og:description" content="You're cordially invited to celebrate the marriage of Lahiru & Dushiya · Sunday, 24 May 2026 · Crown Regency, Badulla" />
        <meta property="og:image"       content="https://YOUR-DOMAIN.vercel.app/og-image.jpg" />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt"   content="Wedding invitation for Lahiru and Dushiya" />

        {/* ── Twitter / WhatsApp fallback ── */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content="Lahiru & Dushiya are getting married! 🪷" />
        <meta name="twitter:description" content="Sunday, 24 May 2026 · Crown Regency, Badulla" />
        <meta name="twitter:image"       content="https://YOUR-DOMAIN.vercel.app/og-image.jpg" />
      </Head>

      {/* ── LAYER STACK ──
          Bottom: invitation content (always rendered, visible through fading video)
          Top:    video overlay — fades out from 5s → 8s, then removed
      */}
      <div style={{ position: 'relative', minHeight: '100vh' }}>

        {/* ── INVITATION CONTENT (always in DOM, sits behind video) ── */}
        <main style={{
          ...S.main,
          // Content is visible underneath from 5s as video fades
          opacity: videoDone ? 1 : 1, // always 1; video overlay dims it visually
        }}>

          {/* ── SECTION 1: INVITATION CARD ── */}
          <section style={S.cardSection}>
            <WatercolourBg />
            <div style={S.cardInner}>

              <FloatIn delay={0.1}>
                <p style={S.dear}>Dear {guest.name},</p>
              </FloatIn>

              <FloatIn delay={0.25}>
                <p style={S.cordially}>You are cordially invited to celebrate</p>
                <p style={S.theMarriage}>the marriage of</p>
              </FloatIn>

              <FloatIn delay={0.45} style={{ marginBottom: 32 }}>
                <div style={S.namesWrap}>
                  <span style={S.nameBride}>Lahiru</span>
                  <span style={S.ampersand}>&amp;</span>
                  <span style={S.nameGroom}>Dushiya</span>
                </div>
              </FloatIn>

              <FloatIn delay={0.65}>
                <div style={S.dateLine}>
                  <span>Sunday</span>
                  <span style={S.dateSep}>|</span>
                  <span>24</span>
                  <span style={S.dateSep}>|</span>
                  <span>May</span>
                </div>
                <p style={S.timeRange}>From 9.30 am to 4.00 pm</p>
              </FloatIn>

              <FloatIn delay={0.8}>
                <div style={S.venueLine}>
                  <p style={S.venueName}>Crown Regency</p>
                  <p style={S.venueAddress}>Peelipotha Gama Road, Badulla</p>
                </div>
              </FloatIn>

              <FloatIn delay={0.95}>
                <p style={S.ceremony}>Mangalya Dharanam ceremony at 10.30 AM</p>
                <p style={S.reception}>Reception to follow</p>
              </FloatIn>

            </div>
          </section>

          <LocationSection />
          <TimelineSection />
          <ContactSection guest={guest} />

          <footer style={S.footer}>
            <FloatIn>
              <p style={S.footerNames}>Lahiru &amp; Dushiya</p>
              <p style={S.footerDate}>24 · May · 2026</p>
            </FloatIn>
          </footer>
        </main>

        {/* ── MUTE / UNMUTE BUTTON — fixed bottom right ── */}
        <button onClick={toggleMute} style={S.muteBtn} title={muted ? 'Unmute music' : 'Mute music'}>
          {muted ? '🔇' : '🎵'}
        </button>

        {/* ── VIDEO OVERLAY — sits on top, fades out ── */}
        {!videoDone && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            pointerEvents: videoOpacity < 0.05 ? 'none' : 'auto',
            opacity: videoOpacity,
            transition: 'opacity 0.1s linear',
          }}>
            {/* Watercolour background behind the white-bg video */}
            <WatercolourBgVideo />

            {/* The video — white background becomes transparent via multiply */}
            <video
              ref={videoRef}
              onEnded={handleVideoEnd}
              playsInline
              muted
              style={S.video}
            >
              <source src="/videos/temple-door.webm" type="video/webm" />
              <source src="/videos/temple-door.mp4" type="video/mp4" />
            </video>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.06);} }
        .reveal { opacity:0; transform:translateY(28px); transition: opacity 0.8s ease, transform 0.8s ease; }
        .reveal.visible { opacity:1; transform:translateY(0); }
        .timeline-dot { transition: transform 0.3s; }
        .timeline-dot:hover { transform: scale(1.15); }
      `}</style>
    </>
  )
}

/* ── Watercolour background behind the video overlay ──
   This is what shows through the white parts of the video via multiply blend */
function WatercolourBgVideo() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      background: 'linear-gradient(160deg, #fffaf7 0%, #fdf4ee 50%, #fff8f2 100%)',
      overflow: 'hidden',
    }}>
      {[
        { top: -60, left: -60, size: 340, hue: '340deg', sat: '65%', light: '83%', opacity: 0.5, rotate: 15 },
        { top: -30, right: -70, size: 300, hue: '200deg', sat: '50%', light: '78%', opacity: 0.42, rotate: -20 },
        { bottom: -80, left: -40, size: 320, hue: '20deg',  sat: '60%', light: '80%', opacity: 0.45, rotate: 30 },
        { bottom: -50, right: -80, size: 280, hue: '180deg', sat: '45%', light: '76%', opacity: 0.36, rotate: -10 },
        { top: '38%', left: -100, size: 240, hue: '350deg', sat: '55%', light: '86%', opacity: 0.32, rotate: 45 },
        { top: '28%', right: -90, size: 260, hue: '210deg', sat: '48%', light: '80%', opacity: 0.34, rotate: -35 },
      ].map(({ size, hue, sat, light, opacity, rotate, ...pos }, i) => (
        <div key={i} style={{
          position: 'absolute', width: size, height: size,
          borderRadius: '60% 40% 55% 45% / 45% 55% 40% 60%',
          background: `radial-gradient(ellipse at 40% 40%, hsl(${hue},${sat},${light}) 0%, hsl(${hue},${sat},93%) 60%, transparent 100%)`,
          opacity, transform: `rotate(${rotate}deg)`, filter: 'blur(18px)', ...pos
        }} />
      ))}
    </div>
  )
}

/* ── Watercolour CSS background ── */
function WatercolourBg() {
  const flowers = [
    { top: -40, left: -60, size: 280, hue: '340deg', sat: '60%', light: '85%', opacity: 0.35, rotate: 15 },
    { top: -20, right: -50, size: 240, hue: '200deg', sat: '45%', light: '80%', opacity: 0.28, rotate: -20 },
    { bottom: -60, left: -30, size: 260, hue: '20deg', sat: '55%', light: '82%', opacity: 0.3, rotate: 30 },
    { bottom: -40, right: -60, size: 220, hue: '180deg', sat: '40%', light: '78%', opacity: 0.25, rotate: -10 },
    { top: '40%', left: -80, size: 180, hue: '350deg', sat: '50%', light: '88%', opacity: 0.2, rotate: 45 },
    { top: '30%', right: -70, size: 200, hue: '210deg', sat: '42%', light: '82%', opacity: 0.22, rotate: -35 },
  ]
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {flowers.map((f, i) => {
        const { size, hue, sat, light, opacity, rotate, ...pos } = f
        return (
          <div key={i} style={{
            position: 'absolute',
            width: size, height: size,
            borderRadius: '60% 40% 55% 45% / 45% 55% 40% 60%',
            background: `radial-gradient(ellipse at 40% 40%, hsl(${hue},${sat},${light}) 0%, hsl(${hue},${sat},92%) 60%, transparent 100%)`,
            opacity,
            transform: `rotate(${rotate}deg)`,
            filter: 'blur(12px)',
            ...pos
          }} />
        )
      })}
      {/* Leaf silhouettes */}
      {[
        { top: 60, right: 20, rotate: 40 },
        { top: 120, left: 30, rotate: -20 },
        { bottom: 80, right: 40, rotate: 60 },
        { bottom: 140, left: 20, rotate: -50 },
      ].map((l, i) => (
        <div key={i} style={{
          position: 'absolute', width: 60, height: 100,
          borderRadius: '50% 50% 50% 50% / 30% 30% 70% 70%',
          background: `hsl(${150 + i * 20}deg, 30%, 78%)`,
          opacity: 0.18, transform: `rotate(${l.rotate}deg)`,
          filter: 'blur(4px)', ...{ top: l.top, left: l.left, right: l.right, bottom: l.bottom }
        }} />
      ))}
    </div>
  )
}

/* ── Location Section ── */
function LocationSection() {
  const MAPS_URL = 'https://www.google.com/maps/search/Crown+Regency+Badulla+Peelipotha+Gama+Road'
  return (
    <section style={S.section}>
      <FloatIn style={{ textAlign: 'center' }}>
        <div style={S.sectionTag}>📍 Location</div>
        <h2 style={S.sectionTitle}>Crown Regency</h2>
        <p style={S.sectionSub}>Peelipotha Gama Road, Badulla</p>
        <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" style={S.mapsBtn}>
          Open in Google Maps ›
        </a>
      </FloatIn>
    </section>
  )
}

/* ── Timeline Section ── */
function TimelineSection() {
  const events = [
    { time: '9:30 AM onwards', label: '',                  icon: '🌸', highlight: false },
    { time: '10:30 AM',        label: 'Mangalya Dharanam', icon: '🪷', highlight: true  },
    { time: '12:00 PM',        label: 'Lunch',             icon: '🍽️', highlight: false },
    { time: '4:00 PM',         label: 'Departure',        icon: '✨', highlight: false },
  ]
  return (
    <section style={{ ...S.section, background: 'linear-gradient(180deg, #fff 0%, #fdf8f4 100%)' }}>
      <FloatIn style={{ textAlign: 'center' }}>
        <div style={S.sectionTag}>🕐 Schedule</div>
        <h2 style={S.sectionTitle}>Order of the Day</h2>
        <p style={S.sectionSub}>Sunday, 24th May 2026</p>
      </FloatIn>
      <div style={S.timeline}>
        <div style={S.timelineLine} />
        {events.map((ev, i) => (
          <FloatIn key={i} delay={i * 0.15}>
            <TimelineItem ev={ev} i={i} />
          </FloatIn>
        ))}
      </div>
    </section>
  )
}

function TimelineItem({ ev, i }) {
  const isLeft = i % 2 === 0
  return (
    <div style={{ ...S.timelineRow, flexDirection: isLeft ? 'row' : 'row-reverse' }}>
      <div style={{
        ...S.timelineCard,
        ...(ev.highlight ? S.timelineCardHL : {}),
        textAlign: isLeft ? 'right' : 'left',
      }}>
        <p style={S.timelineTime}>{ev.time}</p>
        {ev.label ? <p style={{ ...S.timelineLabel, ...(ev.highlight ? { color: '#c8903a' } : {}) }}>{ev.label}</p> : null}
      </div>
      <div className="timeline-dot" style={{ ...S.timelineDot, ...(ev.highlight ? S.timelineDotHL : {}) }}>
        <span style={{ fontSize: ev.highlight ? 18 : 14 }}>{ev.icon}</span>
      </div>
      <div style={{ flex: 1 }} />
    </div>
  )
}

/* ── Contact / WhatsApp Section ── */
function ContactSection({ guest }) {
  const waUrl = `https://wa.me/${guest.contactNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${guest.contactName}, I received the wedding invitation for Lahiru & Dushiya's wedding on 24th May 2026. `)}`
  return (
    <section style={{ ...S.section, background: '#fdf6f0', paddingBottom: 60 }}>
      <FloatIn style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <div style={S.sectionTag}>💌 Contact</div>
        <h2 style={S.sectionTitle}>Need Help?</h2>
        <p style={S.sectionSub}>
          For any queries, please reach out to <strong style={{ color: '#3a2a1a' }}>{guest.contactName}</strong>
        </p>
        <div style={S.contactCard}>
          <div style={S.contactAvatar}>{guest.contactName.charAt(0)}</div>
          <div>
            <p style={S.contactName}>{guest.contactName}</p>
            <p style={S.contactNum}>{guest.contactNumber}</p>
          </div>
        </div>
        <a href={waUrl} target="_blank" rel="noopener noreferrer" style={S.waBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Message {guest.contactName} on WhatsApp
        </a>
        <p style={{ fontSize: 12, color: '#bbb', marginTop: 16, letterSpacing: 1 }}>
          We look forward to celebrating with you 🪷
        </p>
      </FloatIn>
    </section>
  )
}

/* ── Loading & Not Found ── */
function Loader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f4' }}>
      <p style={{ fontFamily: "'Great Vibes', cursive", fontSize: 42, color: '#c8903a', animation: 'pulse 1.5s ease-in-out infinite' }}>
        Lahiru &amp; Dushiya
      </p>
    </div>
  )
}

function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: '#fdf8f4' }}>
      <p style={{ fontFamily: "'Great Vibes', cursive", fontSize: 36, color: '#c8903a' }}>Invitation Not Found</p>
      <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: 13, color: '#aaa' }}>Please check your invitation link.</p>
    </div>
  )
}

/* ─────── STYLES ─────── */
const S = {
  video: {
    position: 'absolute', inset: 0, zIndex: 1,
    width: '100%', height: '100%',
    objectFit: 'cover',
    mixBlendMode: 'multiply',
    /* White pixels in video → fully transparent (multiply with any colour = that colour)
       Dark/coloured pixels (temple, doors) → show on top of watercolour bg */
  },
  main: { width: '100%', overflowX: 'hidden' },

  /* Card */
  cardSection: {
    position: 'relative',
    minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '80px 24px',
    background: 'linear-gradient(160deg, #fffaf7 0%, #fff8f2 100%)',
    overflow: 'hidden',
  },
  cardInner: {
    position: 'relative', zIndex: 1,
    maxWidth: 420, width: '100%',
    textAlign: 'center',
    animation: 'fadeUp 1s ease both',
  },
  dear: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 15, fontWeight: 400,
    color: '#5a3a1a', marginBottom: 10,
    letterSpacing: 0.5,
  },
  cordially: {
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic', fontSize: 18,
    color: '#7a5a2a', marginBottom: 4,
  },
  theMarriage: {
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic', fontSize: 18,
    color: '#7a5a2a', marginBottom: 28,
  },
  namesWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 0, marginBottom: 32,
  },
  nameBride: {
    fontFamily: "'Great Vibes', cursive",
    fontSize: 72, lineHeight: 1.1,
    color: '#c8903a',
    textShadow: '0 2px 20px rgba(200,144,58,0.2)',
  },
  ampersand: {
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic', fontSize: 28,
    color: '#3a2a1a', lineHeight: 1.2,
  },
  nameGroom: {
    fontFamily: "'Great Vibes', cursive",
    fontSize: 78, lineHeight: 1.05,
    color: '#c8903a',
    textShadow: '0 2px 20px rgba(200,144,58,0.2)',
  },
  dateLine: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 20, fontWeight: 400,
    color: '#3a2a1a', marginBottom: 6,
    letterSpacing: 1,
  },
  dateSep: { color: '#c8903a', fontWeight: 300 },
  timeRange: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 13, color: '#888',
    letterSpacing: 1, marginBottom: 28,
  },
  venueLine: { marginBottom: 20 },
  venueName: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 26, fontWeight: 600,
    color: '#3a2a1a', marginBottom: 2,
    letterSpacing: 1,
  },
  venueAddress: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 13, color: '#888', letterSpacing: 0.5,
  },
  ceremony: {
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic', fontSize: 16,
    color: '#c8903a', marginBottom: 8,
    letterSpacing: 0.5,
  },
  reception: {
    fontFamily: "'Great Vibes', cursive",
    fontSize: 36, color: '#3a2a1a',
  },

  /* Sections */
  section: {
    padding: '80px 24px',
    background: '#fff',
  },
  sectionTag: {
    display: 'inline-block',
    fontFamily: "'Raleway', sans-serif",
    fontSize: 11, letterSpacing: 4, textTransform: 'uppercase',
    color: '#c8903a', marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 38, fontWeight: 400,
    color: '#3a2a1a', marginBottom: 8,
  },
  sectionSub: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 14, color: '#999',
    letterSpacing: 0.5, marginBottom: 36,
  },

  mapsBtn: {
    display: 'inline-block',
    padding: '14px 36px',
    background: 'linear-gradient(135deg, #c8903a, #e0a84a)',
    color: '#fff', borderRadius: 60,
    fontFamily: "'Raleway', sans-serif",
    fontSize: 14, fontWeight: 500, letterSpacing: 1,
    textDecoration: 'none',
    boxShadow: '0 8px 24px rgba(200,144,58,0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },

  /* Timeline */
  timeline: {
    position: 'relative',
    maxWidth: 560, margin: '0 auto',
    padding: '20px 0',
  },
  timelineLine: {
    position: 'absolute',
    left: '50%', top: 0, bottom: 0,
    width: 1,
    background: 'linear-gradient(to bottom, transparent, rgba(200,144,58,0.3) 10%, rgba(200,144,58,0.3) 90%, transparent)',
    transform: 'translateX(-50%)',
  },
  timelineRow: {
    display: 'flex', alignItems: 'center',
    gap: 0, marginBottom: 40,
    position: 'relative',
  },
  timelineCard: {
    flex: 1, padding: '16px 20px',
    background: '#fff',
    border: '1px solid rgba(200,144,58,0.15)',
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  },
  timelineCardHL: {
    background: 'linear-gradient(135deg, #fff8ee, #fef4e0)',
    border: '1px solid rgba(200,144,58,0.35)',
    boxShadow: '0 4px 24px rgba(200,144,58,0.12)',
  },
  timelineTime: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 11, letterSpacing: 2,
    color: '#c8903a', textTransform: 'uppercase',
    marginBottom: 4,
  },
  timelineLabel: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 18, fontWeight: 600,
    color: '#3a2a1a', marginBottom: 2,
  },
  timelineDot: {
    width: 48, height: 48, borderRadius: '50%',
    background: '#fff',
    border: '2px solid rgba(200,144,58,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, zIndex: 1,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  timelineDotHL: {
    background: 'linear-gradient(135deg, #c8903a, #e0a84a)',
    border: '2px solid #c8903a',
    boxShadow: '0 4px 20px rgba(200,144,58,0.35)',
  },

  /* Contact */
  contactCard: {
    display: 'flex', alignItems: 'center', gap: 16,
    background: '#fff', borderRadius: 16,
    border: '1px solid rgba(200,144,58,0.2)',
    padding: '20px 24px',
    maxWidth: 340, margin: '28px auto',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
    textAlign: 'left',
  },
  contactAvatar: {
    width: 52, height: 52, borderRadius: '50%',
    background: 'linear-gradient(135deg, #c8903a, #e0a84a)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, fontWeight: 600, color: '#fff',
    fontFamily: "'Raleway', sans-serif",
    flexShrink: 0,
  },
  contactName: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 20, fontWeight: 600, color: '#3a2a1a', marginBottom: 2,
  },
  contactNum: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 14, color: '#888',
  },
  waBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: '16px 32px',
    background: '#25D366',
    color: '#fff', borderRadius: 60,
    fontFamily: "'Raleway', sans-serif",
    fontSize: 15, fontWeight: 500,
    textDecoration: 'none',
    boxShadow: '0 8px 28px rgba(37,211,102,0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },

  muteBtn: {
    position: 'fixed', bottom: 24, right: 24, zIndex: 200,
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(200,144,58,0.3)',
    backdropFilter: 'blur(10px)',
    fontSize: 18, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s',
  },

  /* Footer */
  footer: {
    padding: '40px 24px',
    background: '#3a2a1a',
    textAlign: 'center',
  },
  footerNames: {
    fontFamily: "'Great Vibes', cursive",
    fontSize: 40, color: '#c8903a', marginBottom: 8,
  },
  footerDate: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 12, color: 'rgba(255,255,255,0.4)',
    letterSpacing: 4,
  },
}
