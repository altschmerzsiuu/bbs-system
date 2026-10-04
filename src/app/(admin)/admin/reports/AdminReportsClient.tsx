'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, TrendingUp } from 'lucide-react';

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
        <div style={{ width: 36 }} />
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
