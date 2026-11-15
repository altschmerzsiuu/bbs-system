'use client';

import React, { useMemo } from 'react';

/**
 * Self-contained ISO/IEC 18004 QR Code SVG Generator (ECC Level L, Byte Mode, Versions 1-10).
 * Zero external runtime dependencies; scannable by all iOS/Android native cameras.
 */

// Capacities (data codewords) for ECC Level L, Versions 1..10
const VERSION_TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const VERSION_EC_CODEWORDS_PER_BLOCK = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
const VERSION_NUM_BLOCKS = [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4];

const ALIGNMENT_POSITIONS: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

// GF(256) with primitive polynomial 0x11D
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    for (let j = 0; j < ecLen; j++) {
      rem[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return rem;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);

  // Pick smallest version (1..10) that fits bytes in Byte mode (4 bits mode + 8/16 bits len)
  let version = 1;
  for (; version <= 10; version++) {
    const totalCw = VERSION_TOTAL_CODEWORDS[version];
    const ecCw = VERSION_EC_CODEWORDS_PER_BLOCK[version] * VERSION_NUM_BLOCKS[version];
    const dataCwCap = totalCw - ecCw;
    const headerBytes = version <= 9 ? 2 : 3; // 4-bit mode + 8/16-bit count + 4-bit terminator
    if (bytes.length + headerBytes <= dataCwCap) break;
  }
  if (version > 10) version = 10;

  const totalCw = VERSION_TOTAL_CODEWORDS[version];
  const ecCwPerBlock = VERSION_EC_CODEWORDS_PER_BLOCK[version];
  const numBlocks = VERSION_NUM_BLOCKS[version];
  const dataCwCap = totalCw - ecCwPerBlock * numBlocks;

  // Build bit stream
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Mode indicator: Byte mode = 0100
  pushBits(0b0100, 4);
  // Character count indicator
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (let i = 0; i < bytes.length && Math.ceil(bits.length / 8) < dataCwCap; i++) {
    pushBits(bytes[i], 8);
  }

  // Terminator (up to 4 zero bits)
  const maxBits = dataCwCap * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) {
    bits.push(0);
  }
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataCw = new Uint8Array(dataCwCap);
  for (let i = 0; i < bits.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    dataCw[i] = b;
  }
  const padBytes = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < dataCwCap; i++, p ^= 1) {
    dataCw[i] = padBytes[p];
  }

  // Split into blocks & compute EC
  const blocksData: Uint8Array[] = [];
  const blocksEc: Uint8Array[] = [];
  const shortBlockLen = Math.floor(dataCwCap / numBlocks);
  const numShortBlocks = numBlocks - (dataCwCap % numBlocks);
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const blockLen = shortBlockLen + (b < numShortBlocks ? 0 : 1);
    const block = dataCw.slice(offset, offset + blockLen);
    offset += blockLen;
    blocksData.push(block);
    blocksEc.push(rsComputeRemainder(block, ecCwPerBlock));
  }

  // Interleave data and EC codewords
  const finalCw: number[] = [];
  const maxDataBlockLen = shortBlockLen + 1;
  for (let i = 0; i < maxDataBlockLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < blocksData[b].length) {
        finalCw.push(blocksData[b][i]);
      }
    }
  }
  for (let i = 0; i < ecCwPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCw.push(blocksEc[b][i]);
    }
  }

  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = dark;
      isFunction[r][c] = true;
    }
  };

  // Finder patterns + separators
  const drawFinder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(r, c, inOuter && (onBorder || inInner));
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const alignCoords = ALIGNMENT_POSITIONS[version];
  for (const rCenter of alignCoords) {
    for (const cCenter of alignCoords) {
      const overlapsFinder =
        (rCenter <= 8 && cCenter <= 8) ||
        (rCenter <= 8 && cCenter >= size - 9) ||
        (rCenter >= size - 9 && cCenter <= 8);
      if (overlapsFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunctionModule(rCenter + dr, cCenter + dc, dark);
        }
      }
    }
  }

  // Dark module & reserve format info areas
  setFunctionModule(size - 8, 8, true);
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8][i]) setFunctionModule(8, i, false);
    if (!isFunction[i][8]) setFunctionModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][size - 1 - i]) setFunctionModule(8, size - 1 - i, false);
    if (!isFunction[size - 1 - i][8]) setFunctionModule(size - 1 - i, 8, false);
  }

  // Place data bits in zigzag
  let bitIdx = 0;
  const totalBits = finalCw.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const r = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((finalCw[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          // Apply Mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) dark = !dark;
          modules[r][c] = dark;
        }
      }
    }
  }

  // Write Format Information for ECC Level L (01) + Mask 0 (000) -> precomputed BCH bits = 0x77c4
  const formatBits = 0x77c4;
  const getFormatBit = (i: number) => ((formatBits >>> i) & 1) === 1;

  for (let i = 0; i <= 5; i++) setFunctionModule(8, i, getFormatBit(14 - i));
  setFunctionModule(8, 7, getFormatBit(8));
  setFunctionModule(8, 8, getFormatBit(7));
  setFunctionModule(7, 8, getFormatBit(6));
  for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, getFormatBit(14 - i));

  for (let i = 0; i < 8; i++) setFunctionModule(8, size - 1 - i, getFormatBit(i));
  for (let i = 8; i < 15; i++) setFunctionModule(size - 15 + i, 8, getFormatBit(i));
  setFunctionModule(size - 8, 8, true);

  return modules;
}

export function QrCodeSvg({
  value,
  size = 148,
  fgColor = '#181817',
  bgColor = '#FFFFFF',
}: {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
}) {
  const matrix = useMemo(() => encodeQrMatrix(value || 'BBS'), [value]);
  const margin = 3;
  const totalUnits = matrix.length + margin * 2;

  const pathData = useMemo(() => {
    let d = '';
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix.length; c++) {
        if (matrix[r][c]) {
          d += `M${c + margin},${r + margin}h1v1h-1z`;
        }
      }
    }
    return d;
  }, [matrix]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${totalUnits} ${totalUnits}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR Code: ${value}`}
      style={{
        display: 'block',
        borderRadius: '14px',
        background: bgColor,
        boxShadow: '0 4px 14px rgba(24, 24, 23, 0.08)',
        border: '1px solid #E5DEC9',
      }}
    >
      <rect width={totalUnits} height={totalUnits} fill={bgColor} />
      <path d={pathData} fill={fgColor} />
    </svg>
  );
}
