import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('O5A Serwist Configuration Tests', () => {
  it('should explicitly block caching of HTML document requests', () => {
    const swContent = fs.readFileSync(path.resolve(__dirname, '../src/app/sw.ts'), 'utf-8');
    
    // Assert that we have the NetworkOnly rule for documents to prevent cross-user HTML leakage
    expect(swContent).toContain('request.destination === "document"');
    expect(swContent).toContain('new NetworkOnly()');
  });

  it('should explicitly block caching of non-GET mutations', () => {
    const swContent = fs.readFileSync(path.resolve(__dirname, '../src/app/sw.ts'), 'utf-8');
    
    expect(swContent).toContain('request.method !== "GET"');
  });

  it('should explicitly block caching of API, Auth, and Supabase data', () => {
    const swContent = fs.readFileSync(path.resolve(__dirname, '../src/app/sw.ts'), 'utf-8');
    
    expect(swContent).toContain('url.pathname.startsWith("/api/")');
    expect(swContent).toContain('url.pathname.startsWith("/auth/")');
    expect(swContent).toContain('url.origin.includes("supabase.co")');
  });

  it('should explicitly define static assets caching without using defaultCache', () => {
    const swContent = fs.readFileSync(path.resolve(__dirname, '../src/app/sw.ts'), 'utf-8');
    
    expect(swContent).not.toContain('...defaultCache');
    expect(swContent).toContain('url.pathname.startsWith("/_next/static/")');
    expect(swContent).toContain('url.pathname.startsWith("/_next/image")');
  });

  it('should have an offline fallback route configured in sw.ts', () => {
    const swContent = fs.readFileSync(path.resolve(__dirname, '../src/app/sw.ts'), 'utf-8');
    
    // Assert fallbacks block
    expect(swContent).toContain('fallbacks: {');
    expect(swContent).toContain('url: "/_offline"');
  });

  it('should use @serwist/turbopack wrapper in next.config.mjs', () => {
    const nextConfigContent = fs.readFileSync(path.resolve(__dirname, '../next.config.mjs'), 'utf-8');
    
    expect(nextConfigContent).toContain('@serwist/turbopack');
    expect(nextConfigContent).toContain('withSerwist');
  });

  it('should have the required authoritative brand assets', () => {
    const has192 = fs.existsSync(path.resolve(__dirname, '../public/icons/icon-192.png'));
    const has512 = fs.existsSync(path.resolve(__dirname, '../public/icons/icon-512.png'));
    const hasMaskable = fs.existsSync(path.resolve(__dirname, '../public/icons/icon-maskable-512.png'));
    const hasFavicon = fs.existsSync(path.resolve(__dirname, '../public/favicon.ico'));

    expect(has192).toBe(true);
    expect(has512).toBe(true);
    expect(hasMaskable).toBe(true);
    expect(hasFavicon).toBe(true);
  });
  
  it('should have the offline page implemented', () => {
    const hasOfflinePage = fs.existsSync(path.resolve(__dirname, '../src/app/_offline/page.tsx'));
    expect(hasOfflinePage).toBe(true);
  });
});

