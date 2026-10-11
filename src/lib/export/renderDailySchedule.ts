/**
 * Renderer gambar "Rekap Jadwal Harian" BBS (HTML5 Canvas).
 * Target pembaca: groomer / tim lapangan, dibuka di HP lewat WhatsApp.
 *
 * Taruh di: src/lib/export/renderDailySchedule.ts
 * Pure function: tidak menyentuh React / DOM selain membuat canvas.
 */

export type DailyParticipant = {
  name: string;
  horseName?: string | null;
  hasPhotographer?: boolean;
};

export type DailySlot = {
  startTime: string; // "07:00"
  endTime: string; // "08:00"
  capacity: number;
  isOpen: boolean;
  closedReason?: string | null;
  participants: DailyParticipant[];
};

export type DailyScheduleInput = {
  dateLabel: string; // "Minggu, 11 Oktober 2026"
  slots: DailySlot[];
  generatedAt?: string; // "10:34"
};

type Ctx = CanvasRenderingContext2D;
type CanvasFactory = (w: number, h: number) => HTMLCanvasElement;

const W = 1080;
const SCALE = 2;
const PAD = 56;

const C = {
  bg: '#F6F3EC',
  card: '#FFFFFF',
  ink: '#1B1B18',
  muted: '#8A877D',
  line: '#E4DFD3',
  green: '#2F6B4F',
  greenSoft: '#E6F0EA',
  amber: '#B7791F',
  amberSoft: '#F7ECD6',
  red: '#B23A3A',
  redSoft: '#F6E3E1',
  chip: '#EDE9DE',
};

const FONT = 'Manrope, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/* ───────────── Ikon (path Lucide, viewBox 24x24, stroke) ───────────── */

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const ICONS = {
  clock: [circle(12, 12, 10), 'M12 6v6l4 2'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    circle(9, 7, 4),
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  camera: [
    'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z',
    circle(12, 13, 3),
  ],
  xcircle: [circle(12, 12, 10), 'm15 9-6 6', 'm9 9 6 6'],
} as const;

type IconName = keyof typeof ICONS;

function drawIcon(ctx: Ctx, name: IconName, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  const k = size / 24;
  ctx.scale(k, k);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of ICONS[name]) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/* ───────────── Helper gambar ───────────── */

function setSpacing(ctx: Ctx, value: string) {
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = value;
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function font(ctx: Ctx, weight: number, size: number, family = FONT) {
  ctx.font = `${weight} ${size}px ${family}`;
}

/** Potong teks supaya muat satu baris, tambah "…" bila perlu. */
function fit(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function sectionLabel(ctx: Ctx, text: string, y: number, icon?: IconName): number {
  let x = PAD;
  if (icon) {
    drawIcon(ctx, icon, x, y - 20, 24, C.muted);
    x += 36;
  }
  font(ctx, 700, 20);
  setSpacing(ctx, '2.5px');
  ctx.fillStyle = C.muted;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text.toUpperCase(), x, y);
  const textW = ctx.measureText(text.toUpperCase()).width;
  setSpacing(ctx, '0px');
  ctx.fillStyle = C.line;
  ctx.fillRect(x + textW + 20, y - 8, W - PAD - (x + textW + 20), 2);
  return y + 28;
}

type Group<T> = { start: string; end: string; items: T[] };

/** Gabung slot berurutan (end == start berikutnya) yang punya key sama. */
function mergeRanges<T extends DailySlot>(slots: T[], key: (s: T) => string): Group<T>[] {
  const out: Group<T>[] = [];
  for (const s of slots) {
    const last = out[out.length - 1];
    if (last && last.end === s.startTime && key(last.items[0]) === key(s)) {
      last.end = s.endTime;
      last.items.push(s);
    } else {
      out.push({ start: s.startTime, end: s.endTime, items: [s] });
    }
  }
  return out;
}

/* ───────────── Layout + gambar (dipakai 2x: ukur & render) ───────────── */

function paint(ctx: Ctx, data: DailyScheduleInput): number {
  const slots = [...data.slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const booked = slots.filter(s => s.participants.length > 0);
  const closed = slots.filter(s => s.participants.length === 0 && !s.isOpen);
  const empty = slots.filter(s => s.participants.length === 0 && s.isOpen);

  const riderCount = booked.reduce((n, s) => n + s.participants.length, 0);
  const photoCount = booked.reduce((n, s) => n + s.participants.filter(p => p.hasPhotographer).length, 0);
  const totalCap = slots.filter(s => s.isOpen).reduce((n, s) => n + s.capacity, 0);

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, 100000);
  ctx.textBaseline = 'alphabetic';

  /* Header */
  let y = PAD + 18;
  font(ctx, 700, 20);
  setSpacing(ctx, '3px');
  ctx.fillStyle = C.muted;
  ctx.fillText('BBS RIDING CLUB', PAD, y);
  setSpacing(ctx, '0px');

  y += 64;
  font(ctx, 800, 54);
  ctx.fillStyle = C.ink;
  ctx.fillText(fit(ctx, data.dateLabel, W - PAD * 2), PAD, y);

  y += 56;
  if (riderCount === 0) {
    font(ctx, 600, 26);
    ctx.fillStyle = C.muted;
    ctx.fillText('Belum ada rider terdaftar', PAD, y);
  } else {
    const stats: { icon: IconName; text: string; color: string }[] = [
      { icon: 'clock', text: `${booked.length} sesi`, color: C.ink },
      { icon: 'users', text: `${riderCount} rider`, color: C.ink },
    ];
    if (photoCount > 0) stats.push({ icon: 'camera', text: `${photoCount} fotografer`, color: C.green });
    if (slots.some(s => !s.isOpen)) {
      stats.push({ icon: 'xcircle', text: `${slots.filter(s => !s.isOpen).length} ditutup`, color: C.red });
    }
    let x = PAD;
    font(ctx, 700, 26);
    for (const st of stats) {
      drawIcon(ctx, st.icon, x, y - 24, 30, st.color);
      ctx.fillStyle = st.color;
      ctx.fillText(st.text, x + 42, y);
      x += 42 + ctx.measureText(st.text).width + 40;
    }
  }

  /* Perlu disiapkan */
  y += 72;
  y = sectionLabel(ctx, 'Perlu disiapkan', y, 'clock');

  if (booked.length === 0) {
    y += 8;
    rrect(ctx, PAD, y, W - PAD * 2, 96, 20);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    font(ctx, 600, 26);
    ctx.fillStyle = C.muted;
    ctx.fillText('Tidak ada sesi dengan rider hari ini', PAD + 32, y + 58);
    y += 96;
  }

  const cardX = PAD;
  const cardW = W - PAD * 2;
  const timeColW = 210;
  const rowH = 78;
  const rowGap = 14;

  for (const slot of booked) {
    y += 20;
    const n = slot.participants.length;
    const rowsH = n * rowH + (n - 1) * rowGap;
    const cardH = Math.max(rowsH, 128) + 56;
    const over = n > slot.capacity;
    const accent = !slot.isOpen ? C.red : over || n >= slot.capacity ? C.amber : C.green;

    // kartu
    rrect(ctx, cardX, y, cardW, cardH, 22);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.save();
    rrect(ctx, cardX, y, cardW, cardH, 22);
    ctx.clip();
    ctx.fillStyle = accent;
    ctx.fillRect(cardX, y, 8, cardH);
    ctx.restore();
    rrect(ctx, cardX, y, cardW, cardH, 22);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // kolom waktu
    const tx = cardX + 36;
    font(ctx, 800, 46, MONO);
    ctx.fillStyle = C.ink;
    ctx.fillText(slot.startTime, tx, y + 28 + 40);
    font(ctx, 500, 22, MONO);
    ctx.fillStyle = C.muted;
    ctx.fillText(`s/d ${slot.endTime}`, tx, y + 28 + 74);

    // titik kapasitas
    const dots = Math.max(slot.capacity, n);
    for (let i = 0; i < dots; i++) {
      const cx = tx + 9 + i * 26;
      const cy = y + 28 + 104;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      if (i < n) {
        ctx.fillStyle = i >= slot.capacity ? C.amber : accent;
        ctx.fill();
      } else {
        ctx.strokeStyle = C.muted;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    font(ctx, 700, 20);
    ctx.fillStyle = over ? C.amber : C.muted;
    ctx.fillText(`${n}/${slot.capacity}`, tx + 9 + dots * 26 + 4, y + 28 + 110);

    if (!slot.isOpen) {
      font(ctx, 700, 18);
      setSpacing(ctx, '1.5px');
      ctx.fillStyle = C.red;
      ctx.fillText('DITUTUP', tx, y + cardH - 14);
      setSpacing(ctx, '0px');
    }

    // divider kolom waktu
    ctx.fillStyle = C.line;
    ctx.fillRect(cardX + timeColW + 20, y + 24, 2, cardH - 48);

    // baris rider
    const rx = cardX + timeColW + 56;
    const rRight = cardX + cardW - 32;
    slot.participants.forEach((p, i) => {
      const ry = y + 28 + i * (rowH + rowGap);
      const pillW = p.hasPhotographer ? 196 : 0;
      const textMax = rRight - rx - (pillW ? pillW + 20 : 0);

      // Rider name as primary headline
      font(ctx, 800, 34);
      ctx.fillStyle = C.ink;
      ctx.fillText(fit(ctx, p.name, textMax), rx, ry + 34);

      // Subtitle with session duration (60 Menit)
      font(ctx, 600, 22);
      ctx.fillStyle = C.muted;
      ctx.fillText('Sesi Berkuda · 60 Menit', rx, ry + 68);

      if (p.hasPhotographer) {
        const px = rRight - pillW;
        const py = ry + 8;
        rrect(ctx, px, py, pillW, 48, 24);
        ctx.fillStyle = C.greenSoft;
        ctx.fill();
        drawIcon(ctx, 'camera', px + 18, py + 11, 26, C.green);
        font(ctx, 700, 22);
        ctx.fillStyle = C.green;
        ctx.fillText('Fotografer', px + 54, py + 32);
      }

      if (i < n - 1) {
        ctx.fillStyle = C.line;
        ctx.fillRect(rx, ry + rowH + rowGap / 2 - 1, rRight - rx, 1.5);
      }
    });

    y += cardH;
  }

  /* Ditutup */
  if (closed.length > 0) {
    y += 56;
    y = sectionLabel(ctx, 'Ditutup', y, 'xcircle');
    const groups = mergeRanges(closed, s => s.closedReason ?? '');
    for (const g of groups) {
      y += 16;
      rrect(ctx, PAD, y, W - PAD * 2, 84, 20);
      ctx.fillStyle = C.redSoft;
      ctx.fill();
      drawIcon(ctx, 'xcircle', PAD + 28, y + 24, 36, C.red);
      font(ctx, 800, 32, MONO);
      ctx.fillStyle = C.ink;
      const range = `${g.start} - ${g.end}`;
      ctx.fillText(range, PAD + 84, y + 54);
      const reason = g.items[0].closedReason?.trim();
      if (reason) {
        const rw = ctx.measureText(range).width;
        font(ctx, 600, 26);
        ctx.fillStyle = C.red;
        ctx.fillText(fit(ctx, reason, W - PAD * 2 - 84 - rw - 80), PAD + 84 + rw + 28, y + 54);
      }
      y += 84;
    }
  }

  /* Slot kosong */
  if (empty.length > 0 && booked.length + closed.length > 0) {
    y += 56;
    y = sectionLabel(ctx, 'Slot kosong', y);
    const groups = mergeRanges(empty, () => 'empty');
    font(ctx, 600, 24, MONO);
    let cx = PAD;
    y += 12;
    const chipH = 52;
    for (const g of groups) {
      const label = `${g.start} - ${g.end}`;
      const cw = ctx.measureText(label).width + 40;
      if (cx + cw > W - PAD) {
        cx = PAD;
        y += chipH + 14;
      }
      rrect(ctx, cx, y, cw, chipH, 14);
      ctx.fillStyle = C.chip;
      ctx.fill();
      ctx.fillStyle = C.muted;
      ctx.fillText(label, cx + 20, y + 34);
      cx += cw + 14;
    }
    y += chipH;
  }

  if (slots.length === 0) {
    y += 24;
    font(ctx, 600, 26);
    ctx.fillStyle = C.muted;
    ctx.fillText('Belum ada slot yang dijadwalkan', PAD, y + 30);
    y += 40;
  }

  /* Footer */
  y += 56;
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, y, W - PAD * 2, 2);
  y += 52;
  font(ctx, 800, 28);
  ctx.fillStyle = C.ink;
  ctx.fillText(`Terisi ${riderCount}/${totalCap} slot`, PAD, y);
  y += 36;
  font(ctx, 500, 20);
  ctx.fillStyle = C.muted;
  ctx.fillText(`BBS Riding Club${data.generatedAt ? `  ·  dibuat ${data.generatedAt}` : ''}`, PAD, y);

  return y + PAD;
}

/* ───────────── API publik ───────────── */

export function renderDailySchedule(data: DailyScheduleInput, createCanvas?: CanvasFactory): HTMLCanvasElement {
  const make: CanvasFactory =
    createCanvas ??
    ((w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    });

  // Pass 1: ukur tinggi
  const probe = make(W, 10);
  const pctx = probe.getContext('2d');
  if (!pctx) throw new Error('Canvas 2D tidak tersedia');
  const height = Math.ceil(paint(pctx, data));

  // Pass 2: render sebenarnya
  const canvas = make(W * SCALE, height * SCALE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');
  ctx.scale(SCALE, SCALE);
  paint(ctx, data);
  return canvas;
}
