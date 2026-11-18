import { escapeHtml as e } from './content.mjs';

function wrap(text, limit = 36) {
  const lines = [''];
  for (const word of text.split(/\s+/).flatMap(word => word.length > limit ? word.match(new RegExp(`.{1,${limit}}`, 'g')) : [word])) {
    if (lines.at(-1).length + word.length + 1 > limit && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] += `${lines.at(-1) ? ' ' : ''}${word}`;
  }
  return lines;
}

export function diagramSvg(post) {
  const { title, steps, caption, kind } = post.diagram;
  const branch = kind === 'branch';
  const titleLines = wrap(title, 35);
  const top = 54 + titleLines.length * 28 + 26;
  const nodeHeight = Math.max(82, ...steps.map(step => wrap(step, branch ? 22 : 33).length * 24 + 28));
  const stride = nodeHeight + 40;
  const positions = branch
    ? [{ x: 150, y: top, w: 260 }, { x: 24, y: top + stride, w: 246 }, { x: 290, y: top + stride, w: 246 }, { x: 150, y: top + stride * 2, w: 260 }, { x: 150, y: top + stride * 3, w: 260 }]
    : steps.map((_, i) => ({ x: 70, y: top + i * stride, w: 420 }));
  const height = positions.at(-1).y + nodeHeight + 34;
  const connector = (from, to) => {
    const a = positions[from], b = positions[to];
    const ax = a.x + a.w / 2, bx = b.x + b.w / 2;
    return `<path d="M${ax} ${a.y + nodeHeight} V${a.y + nodeHeight + 20} H${bx} V${b.y - 9}"/>`;
  };
  const edges = branch ? [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]] : steps.slice(1).map((_, i) => [i, i + 1]);
  const nodes = positions.map((p, i) => {
    const lines = wrap(steps[i], branch ? 22 : 33);
    const start = p.y + nodeHeight / 2 + 5 - (lines.length - 1) * 12;
    return `<g><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${nodeHeight}" rx="14" fill="${i === 0 ? '#d9f0e9' : i === steps.length - 1 ? '#e7e2f5' : '#ffffff'}" stroke="${i === 0 ? '#75aaa0' : '#d4dbd7'}"/><text x="${p.x + p.w / 2}" y="${start}" text-anchor="middle" font-size="${branch ? 17 : 20}" font-weight="600" fill="#173d39">${lines.map((line, j) => `<tspan x="${p.x + p.w / 2}" dy="${j ? 24 : 0}">${e(line)}</tspan>`).join('')}</text>${!branch ? `<circle cx="43" cy="${p.y + nodeHeight / 2}" r="13" fill="#16796c"/><text x="43" y="${p.y + nodeHeight / 2 + 5}" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">${i + 1}</text>` : ''}</g>`;
  }).join('');
  const last = positions.at(-1), first = positions[0];
  const loop = kind === 'cycle' ? `<path d="M${last.x + last.w} ${last.y + nodeHeight / 2} H524 V${first.y + nodeHeight / 2} H${first.x + first.w + 9}" stroke-dasharray="5 5"/><text x="520" y="${(last.y + first.y) / 2}" transform="rotate(-90 520 ${(last.y + first.y) / 2})" text-anchor="middle" fill="#47665d" stroke="none" font-size="13">Learn and repeat</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="${height}" viewBox="0 0 560 ${height}" role="img" aria-labelledby="title desc"><title id="title">${e(title)}</title><desc id="desc">${e(steps.join(branch ? '; ' : ' → '))}. ${e(caption)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="#52887e"/></marker></defs><rect width="560" height="${height}" rx="22" fill="#f1f5ef"/><g font-family="system-ui,-apple-system,Segoe UI,sans-serif"><text x="28" y="32" fill="#548174" font-size="11" font-weight="700" letter-spacing="2">THE FLOW · ELIJAH MWANGI</text><text x="28" y="65" fill="#173d39" font-size="24" font-weight="700">${titleLines.map((line, i) => `<tspan x="28" dy="${i ? 28 : 0}">${e(line)}</tspan>`).join('')}</text><g fill="none" stroke="#52887e" stroke-width="2" marker-end="url(#arrow)">${edges.map(([a, b]) => connector(a, b)).join('')}${loop}</g>${nodes}</g></svg>`;
}
