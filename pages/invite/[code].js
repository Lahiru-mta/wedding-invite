import { useEffect, useRef, useState, useCallback } from 'react'
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

/* ─── Chroma key canvas component ─── */
function ChromaKeyVideo({ onEnded, onStarted }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)

  /* Draw each frame with green pixels removed */
  const drawFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.paused || video.ended) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = canvas.width
    const h = canvas.height

    ctx.drawImage(video, 0, 0, w, h)

    const frame = ctx.getImageData(0, 0, w, h)
    const data = frame.data

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      /* Green screen detection:
         green channel dominant, at least 1.4x red and 1.4x blue,
         and sufficiently saturated (not grey/white) */
      const isGreen = g > 80
        && g > r * 1.4
        && g > b * 1.4
        && (g - Math.max(r, b)) > 30

      if (isGreen) {
        data[i + 3] = 0 // fully transparent
      } else if (g > r * 1.2 && g > b * 1.2 && (g - Math.max(r, b)) > 15) {
        // soft edge — semi-transparent for smoother borders
        data[i + 3] = Math.max(0, data[i + 3] - 160)
      }
    }

    ctx.putImageData(frame, 0, 0)
    rafRef.current = requestAnimationFrame(drawFrame)
  }, [])

  const startVideo = useCallback(() => {
    if (!videoRef.current || playing) return
    videoRef.current.play().then(() => {
      setPlaying(true)
      onStarted?.()
      rafRef.current = requestAnimationFrame(drawFrame)
    }).catch(() => {})
  }, [playing, drawFrame, onStarted])

  /* Auto-play after 2 s */
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(startVideo, 2000)
    return () => clearTimeout(t)
  }, [ready, startVideo])

  /* Cleanup RAF on unmount */
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  const handleVideoEnd = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    onEnded?.()
  }

  const handleCanPlay = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video && canvas) {
      canvas.width = video.videoWidth || 1080
      canvas.height = video.videoHeight || 1920
      setReady(true)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} onClick={startVideo}>
      {/* Hidden video element — source of frames */}
      <video
        ref={videoRef}
        onCanPlay={handleCanPlay}
        onEnded={handleVideoEnd}
        playsInline
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      >
        <source src="/videos/temple-door.webm" type="video/webm" />
        <source src="/videos/temple-door.mp4" type="video/mp4" />
      </video>

      {/* Canvas renders chroma-keyed frames */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
        }}
      />

      {/* Tap hint before playing */}
      {!playing && ready && (
        <div style={{ ...S.tapHint, animation: 'pulse 2s ease-in-out infinite' }}>
          <div style={S.tapCircle}>▶</div>
          <p style={S.tapText}>Tap to open your invitation</p>
        </div>
      )}

      {/* Loading while video loads */}
      {!ready && (
        <div style={S.tapHint}>
          <p style={{ ...S.tapText, animation: 'pulse 1.5s ease-in-out infinite' }}>Loading…</p>
        </div>
      )}
    </div>
  )
}

export default function InvitePage() {
  const router = useRouter()
  const { code } = router.query
  const [guest, setGuest] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [videoStarted, setVideoStarted] = useState(false)
  const [videoDone, setVideoDone] = useState(false)

  useEffect(() => {
    if (!code) return
    fetch(`/api/guest?code=${code}`)
      .then(r => r.json())
      .then(d => { if (d.name) setGuest(d); else setNotFound(true) })
      .catch(() => setNotFound(true))
  }, [code])

  const skipVideo = () => setVideoDone(true)

  if (!guest && !notFound) return <Loader />
  if (notFound) return <NotFound />

  return (
    <>
      <Head>
        <title>Lahiru &amp; Dushiya — Wedding Invitation</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>

      {/* ── VIDEO COVER with canvas chroma key ── */}
      {!videoDone && (
        <div style={S.videoCover}>
          {/* Watercolour background — shows through transparent green areas */}
          <div style={S.videoBackground} />
          <WatercolourBgVideo />

          <ChromaKeyVideo
            onStarted={() => setVideoStarted(true)}
            onEnded={() => setVideoDone(true)}
          />

          {/* Skip button */}
          {videoStarted && (
            <button onClick={skipVideo} style={S.skipBtn}>
              Skip ›
            </button>
          )}
        </div>
      )}

      {/* ── MAIN INVITATION ── */}
      {videoDone && (
        <main style={S.main}>

          {/* ── SECTION 1: INVITATION CARD ── */}
          <section style={S.cardSection}>
            {/* Watercolour flowers — CSS generated */}
            <WatercolourBg />

            <div style={S.cardInner}>
              <p style={S.dear}>Dear {guest.name},</p>
              <p style={S.cordially}>You are cordially invited to celebrate</p>
              <p style={S.theMarriage}>the marriage of</p>

              <div style={S.namesWrap}>
                <span style={S.nameBride}>Lahiru</span>
                <span style={S.ampersand}>&amp;</span>
                <span style={S.nameGroom}>Dushiya</span>
              </div>

              <div style={S.dateLine}>
                <span>Sunday</span>
                <span style={S.dateSep}>|</span>
                <span>24</span>
                <span style={S.dateSep}>|</span>
                <span>May</span>
              </div>
              <p style={S.timeRange}>From 9.30 am to 4.00 pm</p>

              <div style={S.venueLine}>
                <p style={S.venueName}>Crown Regency</p>
                <p style={S.venueAddress}>Peelipotha Gama Road, Badulla</p>
              </div>

              <p style={S.ceremony}>Mangalya Dharanam ceremony at 10.30 AM</p>
              <p style={S.reception}>Reception to follow</p>
            </div>
          </section>

          {/* ── SECTION 2: LOCATION ── */}
          <LocationSection />

          {/* ── SECTION 3: TIMELINE ── */}
          <TimelineSection />

          {/* ── SECTION 4: CONTACT / WHATSAPP ── */}
          <ContactSection guest={guest} />

          {/* Footer */}
          <footer style={S.footer}>
            <p style={S.footerNames}>Lahiru &amp; Dushiya</p>
            <p style={S.footerDate}>24 · May · 2026</p>
          </footer>
        </main>
      )}

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.06);} }
        @keyframes shimmer { 0%{background-position:200% center;} 100%{background-position:-200% center;} }
        .reveal { opacity:0; transform:translateY(28px); transition: opacity 0.8s ease, transform 0.8s ease; }
        .reveal.visible { opacity:1; transform:translateY(0); }
        .timeline-dot { transition: transform 0.3s; }
        .timeline-dot:hover { transform: scale(1.15); }
      `}</style>
    </>
  )
}

/* ── Watercolour background specifically for the video cover ── */
function WatercolourBgVideo() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none'
    }}>
      {[
        { top: -60, left: -60, size: 340, hue: '340deg', sat: '65%', light: '83%', opacity: 0.45, rotate: 15 },
        { top: -30, right: -70, size: 300, hue: '200deg', sat: '50%', light: '78%', opacity: 0.38, rotate: -20 },
        { bottom: -80, left: -40, size: 320, hue: '20deg', sat: '60%', light: '80%', opacity: 0.4, rotate: 30 },
        { bottom: -50, right: -80, size: 280, hue: '180deg', sat: '45%', light: '76%', opacity: 0.32, rotate: -10 },
        { top: '38%', left: -100, size: 240, hue: '350deg', sat: '55%', light: '86%', opacity: 0.28, rotate: 45 },
        { top: '28%', right: -90, size: 260, hue: '210deg', sat: '48%', light: '80%', opacity: 0.3, rotate: -35 },
      ].map(({ size, hue, sat, light, opacity, rotate, ...pos }, i) => (
        <div key={i} style={{
          position: 'absolute', width: size, height: size,
          borderRadius: '60% 40% 55% 45% / 45% 55% 40% 60%',
          background: `radial-gradient(ellipse at 40% 40%, hsl(${hue},${sat},${light}) 0%, hsl(${hue},${sat},92%) 60%, transparent 100%)`,
          opacity, transform: `rotate(${rotate}deg)`, filter: 'blur(16px)', ...pos
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
  const [ref, visible] = useVisible(0.2)
  const MAPS_URL = 'https://www.google.com/maps/search/Crown+Regency+Badulla+Peelipotha+Gama+Road'

  return (
    <section ref={ref} style={S.section}>
      <div className={`reveal ${visible ? 'visible' : ''}`} style={{ textAlign: 'center' }}>
        <div style={S.sectionTag}>📍 Location</div>
        <h2 style={S.sectionTitle}>Crown Regency</h2>
        <p style={S.sectionSub}>Peelipotha Gama Road, Badulla</p>

        {/* Static map preview */}
        <div style={S.mapPreview}>
          <iframe
            src="https://www.google.com/maps/embed/v1/place?key=AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY&q=Crown+Regency+Badulla"
            width="100%" height="100%" style={{ border: 0, borderRadius: 16 }}
            allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
            title="Crown Regency location"
          />
          {/* Fallback overlay if map key fails */}
          <div style={S.mapFallback}>
            <div style={S.mapPin}>📍</div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: '#5a3a1a' }}>Crown Regency</p>
            <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Peelipotha Gama Road, Badulla</p>
          </div>
        </div>

        <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" style={S.mapsBtn}>
          Open in Google Maps ›
        </a>
      </div>
    </section>
  )
}

/* ── Timeline Section ── */
function TimelineSection() {
  const [ref, visible] = useVisible(0.15)
  const events = [
    { time: '9:30 AM', label: 'Guests Arrive', icon: '🌸', desc: 'Welcome & seating' },
    { time: '10:30 AM', label: 'Mangalya Dharanam', icon: '🪷', desc: 'Sacred wedding ceremony', highlight: true },
    { time: '12:00 PM', label: 'Lunch', icon: '🍽️', desc: 'Celebratory feast' },
    { time: '4:00 PM', label: 'Farewell', icon: '✨', desc: 'End of celebrations' },
  ]

  return (
    <section ref={ref} style={{ ...S.section, background: 'linear-gradient(180deg, #fff 0%, #fdf8f4 100%)' }}>
      <div className={`reveal ${visible ? 'visible' : ''}`} style={{ textAlign: 'center' }}>
        <div style={S.sectionTag}>🕐 Schedule</div>
        <h2 style={S.sectionTitle}>Order of the Day</h2>
        <p style={S.sectionSub}>Sunday, 24th May 2026</p>
      </div>

      <div style={S.timeline}>
        {/* Vertical line */}
        <div style={S.timelineLine} />

        {events.map((ev, i) => (
          <TimelineItem key={i} ev={ev} i={i} visible={visible} />
        ))}
      </div>
    </section>
  )
}

function TimelineItem({ ev, i, visible }) {
  const isLeft = i % 2 === 0
  return (
    <div style={{
      ...S.timelineRow,
      flexDirection: isLeft ? 'row' : 'row-reverse',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.7s ${i * 0.18}s ease, transform 0.7s ${i * 0.18}s ease`,
    }}>
      {/* Content card */}
      <div style={{
        ...S.timelineCard,
        ...(ev.highlight ? S.timelineCardHL : {}),
        textAlign: isLeft ? 'right' : 'left',
      }}>
        <p style={S.timelineTime}>{ev.time}</p>
        <p style={{ ...S.timelineLabel, ...(ev.highlight ? { color: '#c8903a' } : {}) }}>{ev.label}</p>
        <p style={S.timelineDesc}>{ev.desc}</p>
      </div>

      {/* Dot */}
      <div className="timeline-dot" style={{
        ...S.timelineDot,
        ...(ev.highlight ? S.timelineDotHL : {})
      }}>
        <span style={{ fontSize: ev.highlight ? 18 : 14 }}>{ev.icon}</span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />
    </div>
  )
}

/* ── Contact / WhatsApp Section ── */
function ContactSection({ guest }) {
  const [ref, visible] = useVisible(0.2)
  const waUrl = `https://wa.me/${guest.contactNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${guest.contactName}, I received the wedding invitation for Lahiru & Dushiya's wedding on 24th May 2026. `)}`

  return (
    <section ref={ref} style={{ ...S.section, background: '#fdf6f0', paddingBottom: 60 }}>
      <div className={`reveal ${visible ? 'visible' : ''}`} style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
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
      </div>
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
  videoCover: {
    position: 'fixed', inset: 0, zIndex: 100,
    background: '#fff8f2',
    overflow: 'hidden',
  },
  videoBackground: {
    position: 'absolute', inset: 0, zIndex: 0,
    background: 'linear-gradient(160deg, #fffaf7 0%, #fff4ec 100%)',
  },
  tapHint: {
    position: 'absolute', zIndex: 2,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    animation: 'pulse 2s ease-in-out infinite',
  },
  tapCircle: {
    width: 72, height: 72, borderRadius: '50%',
    background: 'rgba(200,144,58,0.9)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, color: '#fff',
    boxShadow: '0 0 0 12px rgba(200,144,58,0.2)',
  },
  tapText: {
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic', fontSize: 18,
    color: '#5a3a1a', letterSpacing: 1,
  },
  skipBtn: {
    position: 'absolute', bottom: 32, right: 24, zIndex: 3,
    background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(200,144,58,0.4)',
    borderRadius: 40, padding: '8px 20px',
    fontFamily: "'Raleway', sans-serif", fontSize: 13, color: '#8a5a1a',
    cursor: 'pointer', backdropFilter: 'blur(8px)',
    letterSpacing: 1,
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

  /* Map */
  mapPreview: {
    width: '100%', maxWidth: 520, height: 280,
    borderRadius: 16, overflow: 'hidden',
    margin: '0 auto 28px',
    border: '1px solid rgba(200,144,58,0.2)',
    position: 'relative',
    background: '#f5f0ea',
  },
  mapFallback: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: 'linear-gradient(135deg, #fdf8f4, #f5ede2)',
    zIndex: -1,
  },
  mapPin: { fontSize: 40, marginBottom: 4 },
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
  timelineDesc: {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 12, color: '#aaa',
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
