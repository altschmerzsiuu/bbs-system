'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, TrendingUp, Download } from 'lucide-react';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';

type ReportData = {
  weekStats: { total: number; attended: number; noShow: number; cancelled: number; attendanceRate: number };
  monthStats: { total: number; attended: number; noShow: number; cancelled: number; attendanceRate: number };
  totalMembers: number;
  totalHorses: number;
  topHorse: { name: string; count: number } | null;
  weekBreakdown: { label: string; count: number }[];
  monthLabel: string;
  weekLabel: string;
};

export default function AdminReportsClient({ data }: { data: ReportData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'week' | 'month'>('month');

  const stats = activeTab === 'week' ? data.weekStats : data.monthStats;
  const periodLabel = activeTab === 'week' ? data.weekLabel : data.monthLabel;

  const maxBar = Math.max(...data.weekBreakdown.map(w => w.count), 1);

  const exportToJPG = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#1C1C1E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('BBS · Rangkuman Laporan', 60, 80);

    // Subtitle
    ctx.fillStyle = '#BDBDBD';
    ctx.font = '400 22px sans-serif';
    ctx.fillText(activeTab === 'week' ? `Minggu Ini (${periodLabel})` : `Bulan Ini (${periodLabel})`, 60, 120);

    ctx.fillStyle = '#333333';
    ctx.fillRect(60, 150, 680, 2);

    // Main Stats
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(`${stats.total} Sesi Berjalan`, 60, 220);

    ctx.fillStyle = '#81C784';
    ctx.font = '600 24px sans-serif';
    ctx.fillText(`✅ ${stats.attended} Hadir`, 60, 270);

    ctx.fillStyle = '#E57373';
    ctx.fillText(`❌ ${stats.noShow} No-Show`, 260, 270);
    ctx.fillText(`🚫 ${stats.cancelled} Batal`, 460, 270);

    ctx.fillStyle = '#333333';
    ctx.fillRect(60, 310, 680, 2);

    // Other Details
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Rincian Aktivitas', 60, 370);

    ctx.fillStyle = '#BDBDBD';
    ctx.font = '400 22px sans-serif';
    ctx.fillText(`Tingkat Kehadiran: ${stats.attendanceRate}%`, 60, 420);
    ctx.fillText(`Total Member Terdaftar: ${data.totalMembers}`, 60, 460);
    ctx.fillText(`Total Kuda Aktif: ${data.totalHorses}`, 60, 500);

    if (data.topHorse) {
      ctx.fillText(`Kuda Paling Sering Dipakai: ${data.topHorse.name} (${data.topHorse.count} sesi)`, 60, 540);
    }

    ctx.fillStyle = '#555555';
    ctx.font = '16px sans-serif';
    ctx.fillText('BBS Riding Club', 60, 650);

    // Trigger download
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `BBS-Laporan-${activeTab}-${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.custom((t) => <AlertToast title="Berhasil" description="Laporan berhasil diunduh sebagai JPG." onDismiss={() => toast.dismiss(t)} />);
  };

  return (
    <section className="screen active" data-page="reports">
      {/* Appbar */}
      <div className="appbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px' }}>
        <button
          onClick={() => router.back()}
          style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: 'var(--ink)', cursor: 'pointer' }}
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Laporan</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Ringkasan performa stable</div>
        </div>
        <button
          onClick={exportToJPG}
          style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', background: 'var(--ink)', color: '#fff', cursor: 'pointer' }}
          title="Download JPG"
        >
          <Download size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs" data-tabgroup style={{ marginBottom: '16px' }}>
        {(['week', 'month'] as const).map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'week' ? 'Minggu ini' : 'Bulan ini'}
          </button>
        ))}
      </div>

      {/* Hero stats */}
      <div className="attention">
        <span className="eyebrow">{periodLabel}</span>
        <div className="big">{stats.total} sesi berjalan</div>
        <div className="breakdown">
          <span className="tagline">{stats.attended} hadir</span>
          <span className="tagline">{stats.cancelled} batal</span>
          <span className="tagline">{stats.noShow} no-show</span>
        </div>
      </div>

      {/* Stat grid */}
      <div className="statgrid" style={{ marginTop: '12px' }}>
        <div className="stat">
          <strong>{stats.attendanceRate}%</strong>
          <span>Kehadiran</span>
          {stats.attendanceRate >= 80 ? <em className="up">▲ Baik</em> : <em className="down">▼ Perlu perhatian</em>}
        </div>
        <div className="stat">
          <strong>{data.totalMembers}</strong>
          <span>Total member</span>
        </div>
        <div className="stat">
          <strong>{data.totalHorses}</strong>
          <span>Kuda aktif</span>
        </div>
      </div>

      {/* 4-week bar chart */}
      <div className="card" style={{ marginTop: '12px' }}>
        <div className="cardhead">
          <b>Tren sesi aktif bulan ini</b>
          <span className="hint" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={13} /> per minggu
          </span>
        </div>
        <div className="chart" data-bargroup>
          {data.weekBreakdown.map((w, i) => {
            const heightPx = Math.max(Math.round((w.count / maxBar) * 90), 8);
            const isCurrentWeek = i === data.weekBreakdown.length - 1;
            return (
              <div key={w.label} className={`bar ${isCurrentWeek ? 'on' : ''}`}>
                <b>{w.count}</b>
                <i style={{ height: `${heightPx}px` }} />
                <span>{w.label}</span>
              </div>
            );
          })}
        </div>
        {data.weekBreakdown.some(w => w.count > 0) ? (
          <p className="helper" style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
            {data.weekBreakdown[3].count > data.weekBreakdown[0].count
              ? `Minggu ke-4 lebih tinggi dari minggu pertama`
              : data.weekBreakdown.every(w => w.count === 0)
              ? 'Belum ada sesi bulan ini'
              : 'Data per minggu bulan berjalan'}
          </p>
        ) : (
          <p className="helper" style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--muted)' }}>Belum ada data sesi bulan ini.</p>
        )}
      </div>

      {/* Detail rows */}
      <div className="sectionhead">
        <b>Rincian</b>
      </div>
      <div className="rowlist">
        <div className="row" style={{ cursor: 'default' }}>
          <div className="lead"><b>{data.totalHorses}</b><span>KUDA</span></div>
          <div className="rowmain">
            <b>Pemakaian kuda</b>
            <span>
              {data.topHorse
                ? `${data.topHorse.name} paling banyak dipakai · ${data.topHorse.count} sesi`
                : 'Belum ada data pemakaian kuda'}
            </span>
          </div>
        </div>
        <div className="row" style={{ cursor: 'default' }}>
          <div className="lead"><b>{data.totalMembers}</b><span>MEMBER</span></div>
          <div className="rowmain">
            <b>Aktivitas member</b>
            <span>{stats.total} sesi aktif {activeTab === 'week' ? 'minggu ini' : 'bulan ini'}</span>
          </div>
        </div>
        <div className="row" style={{ cursor: 'default' }}>
          <div className="lead">
            <b style={{ color: stats.noShow > 0 || stats.cancelled > 0 ? 'var(--red)' : 'inherit' }}>
              {stats.noShow + stats.cancelled}
            </b>
            <span>ISSUE</span>
          </div>
          <div className="rowmain">
            <b>No-show & pembatalan</b>
            <span>
              {stats.noShow} no-show · {stats.cancelled} dibatalkan
            </span>
          </div>
        </div>
      </div>

      <div style={{ height: '100px' }} />
    </section>
  );
}
