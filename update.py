import re

with open('src/app/(member)/home/home-client.tsx', 'r') as f:
    content = f.read()

# Add getRelativeDays function
new_func = """function getRelativeDays(dateStr: string) {
  const diff = new Date(`${dateStr}T00:00:00`).getTime() - new Date().setHours(0,0,0,0);
  const days = Math.round(diff / (1000 * 3600 * 24));
  if (days === 0) return 'TODAY';
  if (days === 1) return 'TOMORROW';
  return `IN ${days} DAYS`;
}

export function HomeClient"""
content = content.replace("export function HomeClient", new_func)

# Add image loaded states and style
states = """  const [nextImgLoaded, setNextImgLoaded] = useState(false);
  const [quoteImgLoaded, setQuoteImgLoaded] = useState(false);
  const [ticketImgLoaded, setTicketImgLoaded] = useState(false);

  const firstName"""
content = content.replace("  const firstName", states)

styles = """    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--paper)' }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 150% 0 }
          100% { background-position: -50% 0 }
        }
      `}</style>"""
content = content.replace("    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--paper)' }}>", styles)

# Update Next Ride Card
old_next_card = """              {/* Overlay horse image (subtle) */}
              <div style={{ position: 'absolute', right: '-20%', bottom: 0, height: '120%', width: '70%', opacity: 0.15, mixBlendMode: 'multiply', pointerEvents: 'none' }}>
                <img src="/images/horse-8.png" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'left' }} alt="" />
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink)', opacity: 0.8, marginBottom: '8px' }}>
                      YOUR NEXT SESSION
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600, opacity: 0.9 }}>
                      {fmtDate(nextBooking.date).shortLabel}
                    </div>
                  </div>
                  <div style={{ background: '#7c9a75', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '12px', letterSpacing: '0.5px' }}>
                    {nextBooking.status}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                  <div style={{ font: '52px/0.95 var(--font-display)', display: 'flex', flexDirection: 'column' }}>
                    <span>{nextBooking.startTime.slice(0, 5)} —</span>
                    <span>{nextBooking.endTime.slice(0, 5)}</span>
                  </div>

                  {/* Arrow Button */}
                  <button
                    onClick={() => setIsModalOpen(true)}
                    style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--ink)', color: 'var(--white)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,0,0,0.15)', flexShrink: 0, marginBottom: '4px' }}
                  >
                    <ArrowRight size={24} strokeWidth={2} />
                  </button>
                </div>

                <div style={{ fontSize: '11px', color: '#5f5542', fontWeight: 600, fontStyle: 'italic' }}>
                  * Cancel/reschedule 24 hours before your session starts.
                </div>
              </div>"""

new_next_card = """              {/* Overlay horse image (subtle) */}
              <div style={{ position: 'absolute', right: '-15%', bottom: 0, height: '115%', width: '65%', mixBlendMode: 'multiply', pointerEvents: 'none' }}>
                {!nextImgLoaded && (
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.35) 45%,rgba(255,255,255,0) 60%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}></div>
                )}
                <img src="/images/horse-8.png" onLoad={() => setNextImgLoaded(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'left', opacity: nextImgLoaded ? 0.16 : 0, transition: 'opacity 0.5s ease' }} alt="" />
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <span style={{ display: 'inline-block', fontSize: '8.5px', fontWeight: 800, letterSpacing: '0.6px', color: '#5a4214', background: 'rgba(255,255,255,0.5)', padding: '4px 9px', borderRadius: '99px', marginBottom: '9px' }}>
                  {getRelativeDays(nextBooking.date)}
                </span>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink)', opacity: 0.75, marginBottom: '6px' }}>
                      YOUR NEXT SESSION
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, opacity: 0.9 }}>
                      {fmtDate(nextBooking.date).shortLabel}
                    </div>
                  </div>
                  <div style={{ background: 'var(--green, #7c9a75)', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '5px 11px', borderRadius: '12px', letterSpacing: '0.4px' }}>
                    {nextBooking.status}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                  <div style={{ font: '48px/0.95 var(--font-display)', display: 'flex', flexDirection: 'column' }}>
                    <span>{nextBooking.startTime.slice(0, 5)} —</span>
                    <span>{nextBooking.endTime.slice(0, 5)}</span>
                  </div>

                  {/* Arrow Button */}
                  <button
                    onClick={() => setIsModalOpen(true)}
                    style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--ink)', color: 'var(--white)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,0,0,0.15)', flexShrink: 0 }}
                  >
                    <ArrowRight size={20} strokeWidth={2} />
                  </button>
                </div>

                <div style={{ fontSize: '10px', color: '#5f5542', fontWeight: 600, fontStyle: 'italic' }}>
                  * Cancel/reschedule 24 hours before your session starts.
                </div>
              </div>"""
content = content.replace(old_next_card, new_next_card)

# Update Quick Grid
old_quick_grid = """      {/* ── Quick Grid (3 Items) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '24px' }}>
        <Link href="/schedule" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'var(--ink)' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '24px', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <Calendar size={28} strokeWidth={1.5} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Book a Ride</span>
        </Link>
        <Link href="/bookings" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'var(--ink)' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '24px', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <Ticket size={28} strokeWidth={1.5} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>My Rides</span>
        </Link>
        <Link href="/membership" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'var(--ink)' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '24px', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <CreditCard size={28} strokeWidth={1.5} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Membership</span>
        </Link>
      </div>"""

new_quick_grid = """      {/* ── Quick Grid (3 Items) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '26px 24px' }}>
        <Link href="/schedule" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', textDecoration: 'none', color: 'var(--ink)', cursor: 'pointer' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '20px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <Calendar size={22} strokeWidth={1.5} />
          </div>
          <span style={{ fontSize: '10px', fontWeight: 600 }}>Book a Ride</span>
        </Link>
        <Link href="/bookings" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', textDecoration: 'none', color: 'var(--ink)', cursor: 'pointer' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '20px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <Ticket size={22} strokeWidth={1.5} />
          </div>
          <span style={{ fontSize: '10px', fontWeight: 600 }}>My Rides</span>
        </Link>
        <Link href="/membership" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', textDecoration: 'none', color: 'var(--ink)', cursor: 'pointer' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '20px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <CreditCard size={22} strokeWidth={1.5} />
          </div>
          <span style={{ fontSize: '10px', fontWeight: 600 }}>Membership</span>
        </Link>
      </div>"""
content = content.replace(old_quick_grid, new_quick_grid)

# Update Quote Card
old_quote_card = """        <div style={{
          position: 'relative',
          borderRadius: '24px',
          overflow: 'hidden',
          background: 'var(--ink)',
          padding: '32px 24px',
          minHeight: '160px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <img src="/images/horse-riding-showcase.jpg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} alt="Background" />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ font: '32px/1.1 var(--font-display)', margin: '0 0 16px 0', color: 'var(--white)' }}>
              "A better you<br />rides here."
            </h2>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', color: 'var(--gold)' }}>
              BORNEO BERKUDA STABLE
            </div>
          </div>
        </div>"""

new_quote_card = """        <div style={{
          position: 'relative',
          borderRadius: '22px',
          overflow: 'hidden',
          background: 'var(--ink)',
          padding: '26px 20px',
          minHeight: '130px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            {!quoteImgLoaded && (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.06) 45%,rgba(255,255,255,0) 60%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}></div>
            )}
            <img src="/images/horse-riding-showcase.jpg" onLoad={() => setQuoteImgLoaded(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: quoteImgLoaded ? 0.4 : 0, transition: 'opacity 0.5s ease' }} alt="Background" />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ font: '26px/1.12 var(--font-display)', margin: '0 0 12px 0', color: '#fff' }}>
              "A better you<br />rides here."
            </h2>
            <div style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '1.8px', color: '#b9974f' }}>
              BORNEO BERKUDA STABLE
            </div>
          </div>
        </div>"""
content = content.replace(old_quote_card, new_quote_card)

# Update Riding Pass Modal
old_ticket_body = """          {/* Ticket Body */}
          <div style={{ padding: '0 24px', flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: '32px' }}>
            <div className="ticket-card" style={{ background: '#f9f6ef', borderRadius: '16px', position: 'relative', flex: 1, padding: '24px', overflow: 'hidden', border: '1px solid #efeade' }}>

              {/* Background drawing */}
              <div style={{ position: 'absolute', right: '-30%', top: '10%', height: '110%', opacity: 0.15, pointerEvents: 'none' }}>
                <img src="/images/horse-7.png" style={{ height: '100%', objectFit: 'contain' }} alt="" />
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                  <div>
                    <h3 style={{ font: '24px var(--font-display)', margin: 0, color: 'var(--ink)' }}>BBS</h3>
                    <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginTop: '2px' }}>Borneo Berkuda Stable</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ background: '#7c9a75', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '6px 12px', borderRadius: '12px', letterSpacing: '0.5px' }}>
                      {nextBooking.status}
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase' }}>PASS #{nextBooking.id.substring(0, 8).toUpperCase()}</div>
                  </div>
                </div>

                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {DAYS_FULL[new Date(`${nextBooking.date}T00:00:00`).getDay()]}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', marginBottom: '24px', borderBottom: '1px solid #e2dcd0', paddingBottom: '4px', display: 'inline-block' }}>
                  {new Date(`${nextBooking.date}T00:00:00`).getDate()} {MONTHS_FULL[new Date(`${nextBooking.date}T00:00:00`).getMonth()].toUpperCase()} {new Date(`${nextBooking.date}T00:00:00`).getFullYear()}
                </div>

                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: 600, color: '#5f5542', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#ebd2a4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MapPin size={10} color="#5a4214" /></div>
                    Jl. Soekarno Hatta Km. 10
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#ebd2a4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={10} color="#5a4214" /></div>
                    {firstName}
                  </div>
                </div>

                <div style={{ font: '48px/1 var(--font-display)', color: 'var(--ink)', marginBottom: '40px' }}>
                  {nextBooking.startTime.slice(0, 5)} — {nextBooking.endTime.slice(0, 5)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Membership</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>{tier}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Session Time</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>{nextBooking.startTime.slice(0, 5)} — {nextBooking.endTime.slice(0, 5)} WITA</div>
                  </div>
                </div>

                {/* Dashed line */}
                <div style={{ borderTop: '2px dashed #e2dcd0', margin: '32px 0 24px', position: 'relative' }}>
                  {/* Left cutout */}
                  <div style={{ position: 'absolute', left: '-32px', top: '-10px', width: '20px', height: '20px', background: 'var(--white)', borderRadius: '50%' }}></div>
                  {/* Right cutout */}
                  <div style={{ position: 'absolute', right: '-32px', top: '-10px', width: '20px', height: '20px', background: 'var(--white)', borderRadius: '50%' }}></div>
                </div>

                {/* Barcode Mock */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', height: '40px', background: 'repeating-linear-gradient(90deg, var(--ink) 0, var(--ink) 2px, transparent 2px, transparent 4px, var(--ink) 4px, var(--ink) 8px, transparent 8px, transparent 12px, var(--ink) 12px, var(--ink) 14px, transparent 14px, transparent 18px)', opacity: 0.8, marginBottom: '8px' }}></div>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', color: 'var(--ink)', textTransform: 'uppercase' }}>Good Horses Brighter People</div>
                </div>

              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
              <button className="primary" style={{ width: '100%', height: '56px', fontSize: '15px' }}>
                Reschedule
              </button>
              <button className="primary" style={{ width: '100%', height: '56px', fontSize: '15px', background: '#faeae9', color: '#c06c64' }}>
                Cancel Session
              </button>
            </div>
          </div>"""

new_ticket_body = """          {/* Ticket Body */}
          <div style={{ padding: '0 24px', flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: '32px' }}>
            <div style={{ position: 'relative', display: 'flex', borderRadius: '22px', overflow: 'hidden', boxShadow: '0 12px 30px rgba(35,31,22,0.1)', border: '1px solid #efeade' }}>
              
              <div style={{ flex: 1, background: '#f9f6ef', padding: '22px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: '-35%', top: '8%', height: '105%', width: '75%', pointerEvents: 'none' }}>
                  {!ticketImgLoaded && (
                    <div style={{ position: 'absolute', right: 0, top: 0, width: '75%', height: '100%', background: 'linear-gradient(100deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.04) 45%,rgba(0,0,0,0) 60%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}></div>
                  )}
                  <img src="/images/horse-7.png" onLoad={() => setTicketImgLoaded(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'right', opacity: ticketImgLoaded ? 0.13 : 0, transition: 'opacity 0.5s ease' }} alt="" />
                </div>

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
                    <div>
                      <h3 style={{ font: '22px var(--font-display)', margin: 0 }}>BBS</h3>
                      <div style={{ fontSize: '7.5px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2px', color: 'var(--muted)' }}>Borneo Berkuda Stable</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '7px' }}>
                      <div style={{ background: 'var(--green, #7c9a75)', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '5px 11px', borderRadius: '12px', letterSpacing: '0.4px' }}>
                        {nextBooking.status}
                      </div>
                      <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase' }}>PASS #{nextBooking.id.substring(0, 8).toUpperCase()}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '3px' }}>
                    {DAYS_FULL[new Date(`${nextBooking.date}T00:00:00`).getDay()]}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, borderBottom: '1px solid #e2dcd0', paddingBottom: '4px', display: 'inline-block', marginBottom: '20px' }}>
                    {new Date(`${nextBooking.date}T00:00:00`).getDate()} {MONTHS_FULL[new Date(`${nextBooking.date}T00:00:00`).getMonth()].toUpperCase()} {new Date(`${nextBooking.date}T00:00:00`).getFullYear()}
                  </div>
                  
                  <div style={{ font: '44px/1 var(--font-display)', marginBottom: '22px' }}>
                    {nextBooking.startTime.slice(0, 5)} — {nextBooking.endTime.slice(0, 5)}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Membership</span>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>{tier}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Arena</span>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>Arena 01</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Rider</span>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>{firstName}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Groom on duty</span>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>Ridwan</span>
                    </div>
                  </div>

                  {/* Tear */}
                  <div style={{ height: '26px', margin: '18px -22px', position: 'relative', background: 'radial-gradient(circle at 13px 0,transparent 12px,transparent 12.5px,#efeade 13px) repeat-x', backgroundSize: '26px 100%', backgroundPosition: '22px 0' }}>
                    <div style={{ content: '""', position: 'absolute', left: '22px', right: '22px', top: '12px', borderTop: '2px dashed #ddd5c4' }}></div>
                  </div>

                  {/* Barcode */}
                  <div style={{ height: '36px', background: 'repeating-linear-gradient(90deg,#181817 0,#181817 2px,transparent 2px,transparent 4px,#181817 4px,#181817 8px,transparent 8px,transparent 12px,#181817 12px,#181817 14px,transparent 14px,transparent 18px)', opacity: 0.85, marginBottom: '8px' }}></div>
                  <div style={{ textAlign: 'center', fontSize: '8.5px', fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase' }}>Good Horses Brighter People</div>
                </div>
              </div>
              
              {/* Stub */}
              <div style={{ width: '44px', background: '#f2ede0', borderLeft: '2px dashed #ddd5c4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '8.5px', fontWeight: 700, letterSpacing: '2px', color: '#a89b7a', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>BBS · GOOD HORSES BRIGHTER PEOPLE</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', marginTop: '20px' }}>
              <button style={{ width: '100%', height: '52px', border: 0, borderRadius: '999px', background: '#171717', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                Reschedule
              </button>
              <button style={{ width: '100%', height: '52px', border: 0, borderRadius: '999px', background: 'var(--redSoft, #faeae9)', color: 'var(--red, #c06c64)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                Cancel Session
              </button>
            </div>
          </div>"""

content = content.replace(old_ticket_body, new_ticket_body)

with open('src/app/(member)/home/home-client.tsx', 'w') as f:
    f.write(content)

