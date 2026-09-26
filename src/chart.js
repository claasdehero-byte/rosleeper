const NS = 'http://www.w3.org/2000/svg';
const W = 340;
const H = 200;
const M = { left: 34, right: 10, top: 20, bottom: 24 };

function el(name, attrs = {}, text) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

// Catmull-Rom → Bézier, Kontrollpunkte auf den Wertebereich der Nachbarn begrenzt (kein Überschwingen)
function smoothPath(pts) {
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    const clamp = (y) => Math.min(hi, Math.max(lo, y));
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: clamp(p1.y + (p2.y - p0.y) / 6) };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: clamp(p2.y - (p3.y - p1.y) / 6) };
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function drawLineChart({ from, to, yMax, yStep, series, band, marks }) {
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const x = (t) => M.left + ((t - from) / (to - from)) * plotW;
  const y = (v) => M.top + plotH - (Math.min(v, yMax) / yMax) * plotH;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'chart' });

  for (let v = 0; v <= yMax; v += yStep) {
    svg.append(el('line', { x1: M.left, x2: W - M.right, y1: y(v), y2: y(v), class: 'grid' }));
    svg.append(el('text', { x: M.left - 6, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' }, `${v / 60} h`));
  }

  const dayMs = 86_400_000;
  for (let t = from; t < to; t += dayMs) {
    const label = new Date(t + 12 * 3_600_000).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
    svg.append(el('text', { x: x(t + dayMs / 2), y: H - 6, class: 'axis', 'text-anchor': 'middle' }, label));
    if (t > from) svg.append(el('line', { x1: x(t), x2: x(t), y1: M.top, y2: M.top + plotH, class: 'daysep' }));
  }

  if (band) {
    svg.append(el('rect', { x: M.left, y: y(band.max), width: plotW, height: y(band.min) - y(band.max), class: 'band' }));
  }

  for (const mark of marks ?? []) {
    if (mark.t < from || mark.t > to) continue;
    svg.append(el('line', { x1: x(mark.t), x2: x(mark.t), y1: M.top, y2: M.top + plotH, class: 'mark' }));
    svg.append(el('text', { x: x(mark.t), y: M.top - 5, class: 'markicon', 'text-anchor': 'middle' }, mark.emoji));
  }

  let anyPoint = false;
  for (const s of series) {
    const pts = s.points.filter((p) => p.t >= from && p.t <= to).map((p) => ({ x: x(p.t), y: y(p.v) }));
    if (pts.length === 0) continue;
    anyPoint = true;
    if (s.line !== false && pts.length > 1) svg.append(el('path', { d: smoothPath(pts), class: 'curve', style: `stroke:${s.color}` }));
    for (const p of pts) {
      svg.append(
        el('circle', {
          cx: p.x, cy: p.y, r: 4,
          class: s.hollow ? 'dot hollow' : 'dot',
          style: s.hollow ? `stroke:${s.color}` : `fill:${s.color}`,
        }),
      );
    }
  }
  if (!anyPoint) {
    svg.append(el('text', { x: W / 2, y: H / 2, class: 'axis', 'text-anchor': 'middle' }, 'Noch keine Daten'));
  }
  return svg;
}
