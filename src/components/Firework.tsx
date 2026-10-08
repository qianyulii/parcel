import { useEffect, useRef } from 'react';
import { C } from '../lib/palette';

export interface Burst { id: string; lat: number; lng: number }

interface Particle { x: number; y: number; px: number; py: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Live { burst: Burst; parts: Particle[]; age: number }

const COLORS = [C.teal, C.teal, C.spark, C.gold];

/**
 * 2D canvas overlay. Sparks are stored as offsets from the burst's anchor, and the anchor is
 * re-projected every frame, so the firework stays pinned to home while the globe turns.
 */
export default function Firework({ bursts, project }: { bursts: Burst[]; project: (lat: number, lng: number) => { x: number; y: number } | null }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const live = useRef<Live[]>([]);
  const started = useRef(new Set<string>());
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const b of bursts) {
      if (started.current.has(b.id)) continue;
      started.current.add(b.id);
      const n = reduce ? 0 : 90;
      const parts: Particle[] = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
        const sp = 1.2 + Math.random() * 3.4;
        const max = 55 + Math.random() * 45;
        return { x: 0, y: 0, px: 0, py: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: max, max,
          color: COLORS[i % COLORS.length], size: 0.8 + Math.random() * 1.4 };
      });
      live.current.push({ burst: b, parts, age: 0 });
    }
  }, [bursts]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = cv.current;
      if (!c) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!live.current.length) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const L of live.current) {
        L.age++;
        const o = projectRef.current(L.burst.lat, L.burst.lng);
        if (!o) continue;
        // shock ring
        if (L.age < 50) {
          const t = L.age / 50;
          ctx.strokeStyle = `rgba(79,209,197,${(1 - t) * 0.8})`;
          ctx.lineWidth = 2 * (1 - t) + 0.5;
          ctx.beginPath(); ctx.arc(o.x, o.y, 6 + t * 70, 0, Math.PI * 2); ctx.stroke();
        }
        // flash
        if (L.age < 14) {
          const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 40);
          g.addColorStop(0, `rgba(255,243,214,${0.9 * (1 - L.age / 14)})`);
          g.addColorStop(1, 'rgba(255,243,214,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, 40, 0, Math.PI * 2); ctx.fill();
        }
        for (const p of L.parts) {
          if (p.life <= 0) continue;
          p.px = p.x; p.py = p.y;
          p.vx *= 0.955; p.vy = p.vy * 0.955 + 0.045;
          p.x += p.vx; p.y += p.vy; p.life--;
          const a = p.life / p.max;
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = a;
          ctx.lineWidth = p.size;
          ctx.beginPath(); ctx.moveTo(o.x + p.px * 2.2, o.y + p.py * 2.2); ctx.lineTo(o.x + p.x * 2.2, o.y + p.y * 2.2); ctx.stroke();
          if (Math.random() < 0.08 * a) { ctx.fillStyle = C.spark; ctx.fillRect(o.x + p.x * 2.2, o.y + p.y * 2.2, 1.4, 1.4); }
        }
        ctx.globalAlpha = 1;
      }
      live.current = live.current.filter((L) => L.age < 50 || L.parts.some((p) => p.life > 0));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={cv} className="pointer-events-none absolute inset-0 h-full w-full" />;
}
