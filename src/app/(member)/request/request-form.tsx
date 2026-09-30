'use client';

import { useState } from 'react';
import { submitRequest } from './actions';
import { ArrowRight, Info, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

type MemberData = {
  full_name?: string;
  phone?: string;
  domicile?: string;
  height_cm?: number;
  weight_kg?: number;
  shoe_size?: number;
  date_of_birth?: string;
};

type PlanData = {
  id: string;
  name: string;
  price_idr: number;
  credits: number;
  duration_months: number;
};

export default function RequestForm({
  initialData,
  plans,
  slots,
  initialMode
}: {
  initialData: MemberData;
  plans: PlanData[];
  slots: any[];
  initialMode: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestType, setRequestType] = useState<string>(initialMode);
  
  const [selectedPlan, setSelectedPlan] = useState<string | null>(plans.length > 0 ? plans[0].id : null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    formData.set('requestType', requestType);
    
    if (requestType === 'MEMBERSHIP_APPLICATION' && selectedPlan) {
      formData.set('planId', selectedPlan);
    }
    
    if ((requestType === 'CASUAL_RIDE' || requestType === 'JOY_RIDE') && selectedDate && selectedTime) {
      formData.set('preferredDate', selectedDate);
      formData.set('preferredTime', selectedTime);
    }

    try {
      const result = await submitRequest(formData);
      if (result?.error) {
        setError(result.error);
        setIsSubmitting(false);
      } else if (result?.success) {
        router.push(`/request/success?id=${result.requestId}&type=${result.requestType}`);
      }
    } catch (err) {
      setError('Terjadi kesalahan. Silakan coba lagi.');
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #e0dfda',
    background: 'var(--white)', fontSize: '15px', fontFamily: 'var(--font-sans)', color: 'var(--ink)',
    outline: 'none', transition: 'border-color 0.2s',
  };

  const labelStyle = {
    display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--muted)',
    marginBottom: '8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px'
  };
  
  // Extract unique dates for scheduler
  const availableDates = Array.from(new Set(slots.map(s => s.slot_date))).sort();
  const availableTimes = selectedDate ? Array.from(new Set(slots.filter(s => s.slot_date === selectedDate).map(s => s.start_time))).sort() : [];

  return (
    <div suppressHydrationWarning style={{ background: 'var(--paper)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 10, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <button onClick={() => router.back()} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e0dfda' }}>
          <ChevronLeft size={20} color="var(--ink)" />
        </button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--ink)', margin: 0 }}>
            Request Services
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* 1. Personal Information */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>1</div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-sans)', margin: 0, color: 'var(--ink)' }}>Personal Information</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input name="fullName" type="text" required defaultValue={initialData.full_name} style={inputStyle} placeholder="Your full name" />
            </div>
            
            <div>
              <label style={labelStyle}>WhatsApp Number</label>
              <input name="phone" type="tel" required defaultValue={initialData.phone === '-' ? '' : initialData.phone} style={inputStyle} placeholder="0812..." />
            </div>

            <div>
              <label style={labelStyle}>Date of Birth</label>
              <input name="dateOfBirth" type="date" required defaultValue={initialData.date_of_birth} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Domicile</label>
              <input name="domicile" type="text" required defaultValue={initialData.domicile} style={inputStyle} placeholder="City of residence" />
            </div>
          </div>
        </section>

        {/* 2. Riding Profile */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>2</div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-sans)', margin: 0, color: 'var(--ink)' }}>Riding Profile</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Height (cm)</label>
                <input name="heightCm" type="number" required defaultValue={initialData.height_cm} style={inputStyle} placeholder="170" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Weight (kg)</label>
                <input name="weightKg" type="number" required defaultValue={initialData.weight_kg} style={inputStyle} placeholder="60" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Shoe Size (EUR)</label>
              <input name="shoeSize" type="number" required defaultValue={initialData.shoe_size} style={inputStyle} placeholder="42" />
            </div>
          </div>
        </section>

        {/* 3. Request Type */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>3</div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-sans)', margin: 0, color: 'var(--ink)' }}>What are you looking for?</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { id: 'CASUAL_RIDE', title: 'Casual Ride', desc: 'Sesi berkuda sekali jalan tanpa komitmen.' },
              { id: 'JOY_RIDE', title: 'Joy Ride', desc: 'Riding santai mengelilingi area stable.' },
              { id: 'MEMBERSHIP_APPLICATION', title: 'Membership Application', desc: 'Bergabung untuk akses sesi rutin dan benefit spesial.' }
            ]
            .filter(type => {
              if (initialMode === 'MEMBERSHIP_APPLICATION') return type.id === 'MEMBERSHIP_APPLICATION';
              return type.id === 'CASUAL_RIDE' || type.id === 'JOY_RIDE';
            })
            .map(type => (
              <div 
                key={type.id}
                onClick={() => setRequestType(type.id)}
                style={{ 
                  padding: '16px', borderRadius: '16px', border: `2px solid ${requestType === type.id ? 'var(--gold)' : '#e0dfda'}`,
                  background: requestType === type.id ? '#fbf8f1' : 'var(--white)',
                  display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer'
                }}
              >
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${requestType === type.id ? 'var(--gold)' : '#d0cfca'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {requestType === type.id && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--gold)' }} />}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '15px' }}>{type.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{type.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Contextual UI */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--ink)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>4</div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-sans)', margin: 0, color: 'var(--ink)' }}>
              {requestType === 'MEMBERSHIP_APPLICATION' ? 'Choose your membership' : 'Choose your preferred slot'}
            </h2>
          </div>
          
          {requestType === 'MEMBERSHIP_APPLICATION' ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              {plans.map(plan => {
                const isSelected = selectedPlan === plan.id;
                return (
                  <div 
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    style={{
                      border: `2px solid ${isSelected ? 'var(--gold)' : '#e0dfda'}`,
                      borderRadius: '16px', padding: '16px',
                      background: isSelected ? '#fbf8f1' : 'var(--white)',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--ink)' }}>{plan.name}</div>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${isSelected ? 'var(--gold)' : '#d0cfca'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--gold)' }} />}
                      </div>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 400, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: '12px' }}>
                      Rp {plan.price_idr.toLocaleString('id-ID')}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={14} color="var(--gold)"/> {plan.credits} riding sessions</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={14} color="var(--gold)"/> Valid for {plan.duration_months} months</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Preferred Date</label>
                {availableDates.length > 0 ? (
                  <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '8px' }}>
                    {availableDates.map(date => {
                      const isSelected = selectedDate === date;
                      const d = new Date(date);
                      return (
                        <div 
                          key={date} 
                          onClick={() => setSelectedDate(date)}
                          style={{ 
                            minWidth: '80px', padding: '12px 8px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer',
                            background: isSelected ? 'var(--ink)' : 'var(--white)',
                            color: isSelected ? 'var(--white)' : 'var(--ink)',
                            border: `1px solid ${isSelected ? 'var(--ink)' : '#e0dfda'}`
                          }}
                        >
                          <div style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', marginBottom: '4px' }}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: 700 }}>{d.getDate()}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '12px', fontSize: '14px', color: 'var(--muted)', textAlign: 'center' }}>
                    Belum ada jadwal yang tersedia minggu ini. Hubungi admin untuk informasi lebih lanjut.
                  </div>
                )}
              </div>
              
              {selectedDate && (
                <div>
                  <label style={labelStyle}>Preferred Time</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {availableTimes.map(time => {
                      const isSelected = selectedTime === time;
                      return (
                        <div 
                          key={time} 
                          onClick={() => setSelectedTime(time)}
                          style={{ 
                            padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer',
                            background: isSelected ? 'var(--ink)' : 'var(--white)',
                            color: isSelected ? 'var(--white)' : 'var(--ink)',
                            border: `1px solid ${isSelected ? 'var(--ink)' : '#e0dfda'}`,
                            fontSize: '14px', fontWeight: 600
                          }}
                        >
                          {time.slice(0, 5)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {error && (
          <div style={{ background: '#fce8e8', color: 'var(--red)', padding: '16px', borderRadius: '16px', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <button 
          type="submit"
          disabled={isSubmitting}
          style={{ 
            width: '100%', height: '56px', background: 'var(--ink)', color: 'var(--white)',
            border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            marginBottom: '40px'
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Request'}
          {!isSubmitting && <ArrowRight size={20} />}
        </button>

      </form>
    </div>
  );
}
