import { useEffect, useMemo, useRef } from 'react';
import Globe, { type GlobeInstance } from 'globe.gl';
import { MeshPhongMaterial, Vector2, Color } from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Home, Shipment } from '../lib/types';
import { currentPosition, deliveredOpacity, hubs, legs, type Leg } from '../lib/route';
import { interpolate } from '../lib/geo';
import { C, rgba } from '../lib/palette';

interface ArcDatum {
  key: string;
  shipmentId: string;
  startLat: number; startLng: number; endLat: number; endLng: number;
  color: string | string[];
  stroke: number;
  dashLength: number; dashGap: number; dashInitialGap: number; animate: number;
  label: string;
}

interface PointDatum { lat: number; lng: number; color: string; radius: number; alt: number; label?: string; shipmentId?: string }

interface Props {
  shipments: Shipment[];
  home: Home;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  now: Date;
}

function arcsFor(s: Shipment, home: Home, now: Date, focus: number): ArcDatum[] {
  const ls = legs(s, home);
  const out: ArcDatum[] = [];
  const base = (l: Leg, suffix: string) => ({
    key: `${s.id}-${l.index}-${suffix}`,
    shipmentId: s.id,
    startLat: l.from.lat, startLng: l.from.lng, endLat: l.to.lat, endLng: l.to.lng,
    label: `${l.from.code ?? l.from.city} → ${l.to.code ?? l.to.city}`,
  });
  const solid = { dashLength: 1, dashGap: 0, dashInitialGap: 0, animate: 0 };

  for (const l of ls) {
    switch (s.status) {
      case 'DELIVERED': {
        const a = deliveredOpacity(s.deliveredAt, now) * focus;
        out.push({ ...base(l, 'd'), ...solid, color: [rgba(C.teal, a * 0.55), rgba(C.teal, a)], stroke: 0.32 });
        break;
      }
      case 'EXCEPTION':
      case 'RETURNED':
        out.push({
          ...base(l, 'x'), ...(l.state === 'done' ? solid : { dashLength: 0.04, dashGap: 0.03, dashInitialGap: 0, animate: 0 }),
          color: rgba(C.alert, (l.state === 'done' ? 0.75 : 0.3) * focus), stroke: 0.36,
        });
        break;
      case 'OUT_FOR_DELIVERY':
        out.push({ ...base(l, 'o'), ...solid, color: [rgba(C.amber, 0.9 * focus), rgba(C.gold, focus)], stroke: 0.42 });
        out.push({
          ...base(l, 'oc'), dashLength: 0.12, dashGap: 0.88, dashInitialGap: 0, animate: 1400,
          color: [rgba(C.spark, 0), rgba(C.spark, focus)], stroke: 0.58,
        });
        break;
      default: {
        if (l.state === 'done') {
          out.push({ ...base(l, 't'), ...solid, color: [rgba(C.amber, 0.45 * focus), rgba(C.gold, 0.7 * focus)], stroke: 0.36 });
        } else {
          // faint track + comet
          out.push({ ...base(l, 'tr'), ...solid, color: rgba(C.amber, 0.16 * focus), stroke: 0.26 });
          out.push({
            ...base(l, 'tc'), dashLength: 0.28, dashGap: 1.6, dashInitialGap: 0, animate: 3200,
            color: [rgba(C.amber, 0), rgba(C.gold, 0.9 * focus), rgba(C.spark, focus)], stroke: 0.55,
          });
        }
      }
    }
  }
  return out;
}

export default function GlobeView({ shipments, home, selectedId, onSelect, now }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeInstance | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // init once
  useEffect(() => {
    if (!el.current) return;
    const g = new Globe(el.current, { animateIn: true, rendererConfig: { antialias: true, alpha: false } })
      .backgroundColor(C.void)
      .showAtmosphere(true)
      .atmosphereColor('#3358B8')
      .atmosphereAltitude(0.11)
      .globeMaterial(new MeshPhongMaterial({ color: new Color('#070B18'), emissive: new Color('#03050C'), shininess: 2 }))
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.5)
      .hexPolygonUseDots(true)
      .hexPolygonColor(() => C.land)
      .arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng')
      .arcColor('color')
      .arcStroke('stroke')
      .arcDashLength('dashLength').arcDashGap('dashGap').arcDashInitialGap('dashInitialGap').arcDashAnimateTime('animate')
      .arcAltitudeAutoScale(0.38)
      .arcCurveResolution(96)
      .arcsTransitionDuration(0)
      .arcLabel('label')
      .onArcClick((a: object) => onSelectRef.current((a as ArcDatum).shipmentId))
      .pointLat('lat').pointLng('lng').pointColor('color').pointRadius('radius').pointAltitude('alt')
      .pointResolution(16)
      .pointsTransitionDuration(0)
      .pointLabel('label')
      .onPointClick((p: object) => { const id = (p as PointDatum).shipmentId; if (id) onSelectRef.current(id); })
      .ringColor(() => (t: number) => rgba(C.gold, (1 - t) * 0.8))
      .ringMaxRadius(3.2)
      .ringPropagationSpeed(1.4)
      .ringRepeatPeriod(1300)
      .onGlobeClick(() => onSelectRef.current(null))
      .pointOfView({ lat: 32, lng: -98, altitude: window.innerWidth < 768 ? 3.4 : 2.4 });

    // globe.gl's clear colour bypasses colour management and gets sRGB-encoded twice by OutputPass;
    // a colour-managed scene.background renders #05070D exactly.
    g.scene().background = new Color(C.void);

    // NASA night-lights underlay (default on; ?night=0 turns it off), dimmed so arcs stay the brightest thing.
    // TODO(settings): expose as a toggle in the Settings panel.
    if (new URLSearchParams(location.search).get('night') !== '0') {
      g.globeImageUrl('/textures/earth-night.jpg');
      const m = g.globeMaterial() as MeshPhongMaterial;
      m.color = new Color('#6A6F86');
    }

    const ctl = g.controls();
    ctl.autoRotate = true;
    ctl.autoRotateSpeed = 0.25;
    ctl.enableDamping = true;

    const bloom = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), 1.1, 0.35, 0.55);
    g.postProcessingComposer().addPass(bloom);
    g.postProcessingComposer().addPass(new OutputPass());
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    fetch('/data/countries-110m.geojson')
      .then((r) => r.json())
      .then((geo) => g.hexPolygonsData(geo.features.filter((f: { properties: { n: string } }) => f.properties.n !== 'Antarctica')));

    const resize = () => {
      const w = el.current!.clientWidth;
      g.width(w); g.height(el.current!.clientHeight);
      // keep the globe centred in the space right of the Manifest on desktop
      g.globeOffset(w >= 768 ? [216, 0] : [0, -window.innerHeight * 0.2]);
    };
    resize();
    window.addEventListener('resize', resize);
    globe.current = g;
    return () => { window.removeEventListener('resize', resize); g._destructor?.(); globe.current = null; };
  }, []);

  const arcs = useMemo(
    () => shipments.flatMap((s) => arcsFor(s, home, now, selectedId && selectedId !== s.id ? 0.22 : 1)),
    [shipments, home, now, selectedId],
  );

  const points = useMemo<PointDatum[]>(() => {
    const hubCount = new Map<string, PointDatum & { n: number }>();
    for (const s of shipments) for (const h of hubs(s, home)) {
      const k = h.geoKey ?? `${h.lat.toFixed(2)},${h.lng.toFixed(2)}`;
      const cur = hubCount.get(k);
      if (cur) cur.n++; else hubCount.set(k, { lat: h.lat, lng: h.lng, color: '', radius: 0, alt: 0.004, label: h.city, n: 1 });
    }
    const hubPts = [...hubCount.values()].map((h) => ({
      ...h, color: rgba(C.gold, Math.min(0.9, 0.35 + h.n * 0.15)), radius: 0.22 + Math.min(0.3, h.n * 0.06),
      label: `${h.label} · ${h.n} parcel${h.n > 1 ? 's' : ''}`,
    }));
    const sparks: PointDatum[] = shipments
      .filter((s) => s.status === 'IN_TRANSIT' || s.status === 'EXCEPTION')
      .flatMap((s) => {
        const p = currentPosition(s, home);
        if (!p) return [];
        const dim = selectedId && selectedId !== s.id ? 0.3 : 1;
        return [{ lat: p.lat, lng: p.lng, alt: 0.012, radius: 0.32, shipmentId: s.id,
          color: rgba(s.status === 'EXCEPTION' ? C.alert : C.spark, dim), label: s.label }];
      });
    const pillar: PointDatum = { lat: home.lat, lng: home.lng, alt: 0.07, radius: 0.1, color: C.gold, label: `Home · ${home.label}` };
    return [...hubPts, ...sparks, pillar];
  }, [shipments, home, selectedId]);

  useEffect(() => { globe.current?.arcsData(arcs); }, [arcs]);
  useEffect(() => { globe.current?.pointsData(points); }, [points]);
  useEffect(() => { globe.current?.ringsData([{ lat: home.lat, lng: home.lng }]); }, [home]);

  // camera
  useEffect(() => {
    const g = globe.current;
    if (!g) return;
    const ctl = g.controls();
    if (!selectedId) { ctl.autoRotate = true; return; }
    ctl.autoRotate = false;
    const s = shipments.find((x) => x.id === selectedId);
    if (!s) return;
    const ls = legs(s, home);
    if (!ls.length) return;
    const mid = interpolate(ls[0].from, ls[ls.length - 1].to, 0.5);
    const span = ls.reduce((n, l) => n + l.km, 0);
    g.pointOfView({ lat: mid.lat, lng: mid.lng, altitude: Math.min(2.6, Math.max(0.9, span / 6000)) }, 1400);
  }, [selectedId, shipments, home]);

  return <div ref={el} className="absolute inset-0" data-testid="globe" />;
}
