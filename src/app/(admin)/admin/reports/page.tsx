'use client';

import React, { useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState('Bulan ini');

  return (
    <section className="screen active" data-page="reports">
      <div className="appbar">
        <div className="titles">
          <h2>Laporan</h2>
          <span>Ringkasan performa stable</span>
        </div>
        <button className="iconbtn" onClick={() => alert('Buka Report Builder')}>
          <Plus size={20} />
        </button>
      </div>

      <div className="tabs" data-tabgroup>
        {['Minggu ini', 'Bulan ini', 'Kustom'].map(tab => (
          <button 
            key={tab} 
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="attention">
        <span className="eyebrow">
          {activeTab === 'Minggu ini' ? 'Minggu 4, Sep 2026' : activeTab === 'Bulan ini' ? 'September 2026' : 'Kustom Range'}
        </span>
        <div className="big">
          {activeTab === 'Minggu ini' ? '43' : '126'} sesi berjalan
        </div>
        <div className="breakdown">
          <span className="tagline">{activeTab === 'Minggu ini' ? '40' : '112'} selesai</span>
          <span className="tagline">{activeTab === 'Minggu ini' ? '2' : '8'} batal</span>
          <span className="tagline">{activeTab === 'Minggu ini' ? '1' : '6'} no-show</span>
        </div>
      </div>

      <div className="statgrid" style={{ marginTop: '10px' }}>
        <div className="stat">
          <strong>{activeTab === 'Minggu ini' ? '92%' : '89%'}</strong>
          <span>Kehadiran</span>
          <em className="up">▲ 4%</em>
        </div>
        <div className="stat">
          <strong>{activeTab === 'Minggu ini' ? '81%' : '74%'}</strong>
          <span>Pemakaian slot</span>
          <em className="up">▲ 6%</em>
        </div>
        <div className="stat">
          <strong>{activeTab === 'Minggu ini' ? '12jt' : '42jt'}</strong>
          <span>Pendapatan (Rp)</span>
          <em className="up">▲ 12%</em>
        </div>
      </div>

      <div className="card" style={{ marginTop: '10px' }}>
        <div className="cardhead">
          <b>Tren 4 minggu</b>
          <span className="hint">Jumlah sesi</span>
        </div>
        <div className="chart" data-bargroup>
          <div className="bar"><b>24</b><i style={{ height: '44px' }}></i><span>M1</span></div>
          <div className="bar"><b>31</b><i style={{ height: '58px' }}></i><span>M2</span></div>
          <div className="bar"><b>28</b><i style={{ height: '52px' }}></i><span>M3</span></div>
          <div className="bar on"><b>43</b><i style={{ height: '82px' }}></i><span>M4</span></div>
        </div>
        <p className="helper" style={{ margin: '12px 0 0' }}>
          Minggu ke-4 naik 54% dibanding minggu pertama — dorongan dari paket Gold baru.
        </p>
      </div>

      <div className="sectionhead">
        <b>Rincian</b><span className="hint">Ketuk untuk detail</span>
      </div>
      <div className="rowlist">
        <div className="row" onClick={() => alert('Laporan Kuda')}>
          <div className="lead"><b>4</b><span>KUDA</span></div>
          <div className="rowmain">
            <b>Pemakaian kuda</b>
            <span>Bima paling sibuk · 26 sesi</span>
          </div>
          <ChevronRight size={16} color="var(--muted)" />
        </div>
        <div className="row" onClick={() => alert('Laporan Member')}>
          <div className="lead"><b>8</b><span>MEMBER</span></div>
          <div className="rowmain">
            <b>Aktivitas member</b>
            <span>Gold menyumbang 68% sesi</span>
          </div>
          <ChevronRight size={16} color="var(--muted)" />
        </div>
        <div className="row" onClick={() => alert('Laporan Issues')}>
          <div className="lead"><b>6</b><span>ISSUE</span></div>
          <div className="rowmain">
            <b>No-show & pembatalan</b>
            <span>Paling sering di slot 07:00</span>
          </div>
          <ChevronRight size={16} color="var(--muted)" />
        </div>
      </div>

      <button className="btn" style={{ marginTop: '14px' }} onClick={() => alert('Buka Report Builder')}>
        Buat laporan →
      </button>
      
      <div style={{ height: '100px' }} />
    </section>
  );
}
