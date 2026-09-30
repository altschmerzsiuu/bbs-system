'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { User, Bell, HelpCircle, ChevronDown, ChevronRight, Edit3, Loader2, Award, HeartPulse } from 'lucide-react';
import { updateProfile, uploadAvatar } from './actions';

export function ProfileSettings({ initialUser, initialMember, initialAvatarUrl, tierName }: { initialUser: any, initialMember: any, initialAvatarUrl: string, tierName: string }) {
  const [openSection, setOpenSection] = useState<string | null>('personal');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pushEnabled, setPushEnabled] = useState(true); // Example toggle state for firebase

  const toggleSection = (section: string) => {
    if (openSection === section) setOpenSection(null);
    else setOpenSection(section);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    const formData = new FormData(e.currentTarget);
    const res = await updateProfile(formData);
    
    setLoading(false);
    if (res.ok) {
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('Error updating profile: ' + res.message);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await uploadAvatar(formData);
    if (res.ok && res.url) {
      setAvatarUrl(res.url);
    } else {
      alert('Failed to upload image');
    }
    setUploading(false);
  };

  const handleTogglePush = () => {
    // In a real app, this would call an API to update notification preferences in DB and Firebase
    setPushEnabled(!pushEnabled);
  };

  const SETTINGS = [
    { id: 'personal', label: 'Personal Information', Icon: User },
    { id: 'emergency', label: 'Emergency Contact', Icon: HeartPulse },
    { id: 'notifications', label: 'Notifications', Icon: Bell },
    { id: 'help', label: 'Help & FAQ', Icon: HelpCircle },
  ];

  return (
    <>
      {/* Avatar Section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ position: 'relative', width: '128px', height: '128px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '120px', height: '120px', borderRadius: '50%', overflow: 'hidden', border: '4px solid #fff', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
            {uploading ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7f5', color: 'var(--ink)' }}>
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : avatarUrl ? (
              <Image src={avatarUrl} alt="Profile" width={120} height={120} style={{ width: '100%', height: '100%', objectFit: 'cover' }} priority />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8e4dc' }}>
                <User size={48} color="#a09d94" strokeWidth={1.5} />
              </div>
            )}
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            style={{ position: 'absolute', bottom: '4px', right: '4px', width: '32px', height: '32px', borderRadius: '50%', background: '#b59349', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 8px rgba(181, 147, 73, 0.4)' }}
          >
            <Edit3 size={14} strokeWidth={2.5} />
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*"
          onChange={handleAvatarChange}
        />
      </div>

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', margin: '0 0 4px 0', color: 'var(--ink)', textAlign: 'center' }}>
        {initialUser?.full_name || 'Member BBS'}
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 16px', fontWeight: 500, textAlign: 'center' }}>
        {initialUser?.email}
      </p>

      {/* Membership Badge */}
      {tierName.toUpperCase() !== 'BASIC' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
          <div style={{ background: tierName.toUpperCase() === 'GOLD' ? 'linear-gradient(135deg, #eaddbd 0%, #d0b070 100%)' : 'linear-gradient(135deg, #e0e0e0, #9e9e9e)', padding: '6px 16px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '6px', color: tierName.toUpperCase() === 'GOLD' ? '#5a4214' : '#fff', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
            <Award size={14} strokeWidth={2.5} />
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px' }}>
              {tierName.toUpperCase()} MEMBER
            </span>
          </div>
        </div>
      )}

      {/* Accordion List */}
      <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #efeade', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', marginBottom: '24px', marginTop: '32px', width: '100%' }}>
        {SETTINGS.map(({ id, label, Icon }, index) => {
          const isOpen = openSection === id;
          return (
            <div key={id}>
              <div 
                onClick={() => toggleSection(id)}
                style={{ display: 'flex', alignItems: 'center', padding: '20px', borderBottom: (index < SETTINGS.length - 1 || isOpen) ? '1px solid #efeade' : 'none', cursor: 'pointer', background: isOpen ? '#fcfbfa' : '#fff' }}
              >
                <Icon size={20} strokeWidth={2} color="var(--ink)" style={{ opacity: 0.7, marginRight: '16px' }} />
                <span style={{ flex: 1, fontSize: '15px', fontWeight: 500, color: 'var(--ink)' }}>{label}</span>
                {isOpen ? <ChevronDown size={18} strokeWidth={2} color="var(--muted)" /> : <ChevronRight size={18} strokeWidth={2} color="var(--muted)" />}
              </div>

              {/* Accordion Content */}
              {isOpen && id === 'personal' && (
                <div style={{ padding: '20px', background: '#fcfbfa', borderBottom: index < SETTINGS.length - 1 ? '1px solid #efeade' : 'none' }}>
                  <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Full Name</label>
                      <input type="text" name="fullName" defaultValue={initialUser?.full_name || ''} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #efeade', fontSize: '14px', background: '#fff' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Email</label>
                      <input type="email" name="email" defaultValue={initialUser?.email || ''} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #efeade', fontSize: '14px', background: '#f5f5f5', color: 'var(--muted)' }} readOnly />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Phone Number</label>
                      <input type="text" name="phone" defaultValue={initialMember?.phone || ''} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #efeade', fontSize: '14px', background: '#fff' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Date of Birth</label>
                      <input type="date" name="dob" defaultValue={initialMember?.date_of_birth || ''} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #efeade', fontSize: '14px', background: '#fff' }} />
                    </div>
                    
                    {message && (
                      <div style={{ fontSize: '13px', color: message.includes('Error') ? 'var(--red)' : 'var(--green)', fontWeight: 500, padding: '8px', background: message.includes('Error') ? 'var(--redSoft)' : 'var(--greenSoft)', borderRadius: '8px' }}>
                        {message}
                      </div>
                    )}
                    
                    <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: '100px', background: 'var(--ink)', color: '#fff', fontSize: '14px', fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '8px', opacity: loading ? 0.7 : 1 }}>
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </form>
                </div>
              )}

              {isOpen && id === 'emergency' && (
                <div style={{ padding: '24px 20px', background: '#fcfbfa', borderBottom: index < SETTINGS.length - 1 ? '1px solid #efeade' : 'none' }}>
                  <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Emergency Name */}
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Emergency Contact Name
                      </label>
                      <input
                        type="text"
                        name="emergencyName"
                        defaultValue={initialMember?.emergency_contact_name || ''}
                        placeholder="e.g. Jane Doe"
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: '1px solid #efeade',
                          background: '#fff',
                          fontSize: '15px',
                          color: 'var(--ink)',
                          outline: 'none',
                        }}
                      />
                    </div>

                    {/* Emergency Phone */}
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Emergency Phone Number
                      </label>
                      <input
                        type="tel"
                        name="emergencyPhone"
                        defaultValue={initialMember?.emergency_contact_phone || ''}
                        placeholder="08xxxxxxxx"
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: '1px solid #efeade',
                          background: '#fff',
                          fontSize: '15px',
                          color: 'var(--ink)',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={loading}
                      style={{ 
                        marginTop: '8px',
                        width: '100%', 
                        padding: '14px', 
                        borderRadius: '24px', 
                        background: 'var(--ink)', 
                        color: 'var(--white)', 
                        border: 'none', 
                        fontSize: '15px', 
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    >
                      {loading ? <Loader2 size={18} className="spin" /> : 'Save Contact'}
                    </button>
                    {message && <p style={{ fontSize: '12px', color: 'var(--gold)', textAlign: 'center', margin: 0 }}>{message}</p>}
                  </form>
                </div>
              )}

              {isOpen && id === 'notifications' && (
                <div style={{ padding: '20px', background: '#fcfbfa', borderBottom: index < SETTINGS.length - 1 ? '1px solid #efeade' : 'none' }}>
                  <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
                    Enable push notifications to receive important updates about your schedule and membership directly on your device.
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #efeade' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Push Notifications</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Receive alerts on this device</div>
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={handleTogglePush}
                      style={{ 
                        width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                        background: pushEnabled ? '#7c9a75' : '#e0e0e0',
                        position: 'relative', transition: 'background 0.3s'
                      }}
                    >
                      <div style={{ 
                        width: '20px', height: '20px', borderRadius: '50%', background: '#fff', 
                        position: 'absolute', top: '2px', left: pushEnabled ? '22px' : '2px', 
                        transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' 
                      }} />
                    </button>
                  </div>
                </div>
              )}
              
              {isOpen && id === 'help' && (
                <div style={{ padding: '20px', background: '#fcfbfa', borderBottom: index < SETTINGS.length - 1 ? '1px solid #efeade' : 'none' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 8px', color: 'var(--ink)' }}>Need Assistance?</h4>
                  <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
                    If you have questions regarding your membership, booking schedules, or run into technical issues with the app, our admin team is ready to help.
                  </p>
                  
                  <a 
                    href="https://wa.me/6281234567890?text=Hi%20min%20BBS,%20saya%20butuh%20bantuan%20terkait%20aplikasi/booking%20saya..." 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <button style={{ width: '100%', padding: '14px', borderRadius: '100px', background: '#25D366', color: '#fff', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      Contact Admin via WhatsApp
                    </button>
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
