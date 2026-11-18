import { escapeHtml as escape } from './content.mjs';

const tones = {
  green: { fill: '#e3f1e8', stroke: '#6e9f85' },
  blue: { fill: '#e4edf8', stroke: '#7c9bbd' },
  amber: { fill: '#fff2d7', stroke: '#bd984c' },
  red: { fill: '#fbe6e2', stroke: '#bf8275' }
};
const sides = ['top', 'right', 'bottom', 'left'];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const xml = value => escape(value).replace(/\n/g, '&#10;');

export function validateGraph(graph) {
  if (!graph || !finite(graph.width) || !finite(graph.height) || graph.width < 300 || graph.height < 200 || graph.width > 4000 || graph.height > 5000) throw new Error('Invalid graph dimensions');
  if (typeof graph.title !== 'string' || !graph.title.trim() || typeof graph.subtitle !== 'string') throw new Error('Invalid graph title or subtitle');
  if (!Array.isArray(graph.nodes) || graph.nodes.length < 2 || !Array.isArray(graph.edges) || !graph.edges.length) throw new Error('A graph requires nodes and edges');
  const ids = new Set();
  for (const node of graph.nodes) {
    if (typeof node.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(node.id) || ids.has(node.id)) throw new Error('Invalid or duplicate graph node ID');
    ids.add(node.id);
    if (typeof node.label !== 'string' || !node.label.trim() || node.label.length > 200) throw new Error('Invalid graph node label');
    if (!['process', 'decision', 'store', 'terminal', 'document'].includes(node.shape) || !Object.hasOwn(tones, node.tone)) throw new Error('Invalid graph shape or tone');
    if (![node.x,node.y,node.w,node.h].every(finite) || node.x < 0 || node.y < 0 || node.w < 60 || node.h < 30 || node.x + node.w > graph.width || node.y + node.h > graph.height) throw new Error('Graph node outside canvas');
  }
  for (const edge of graph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) throw new Error('Invalid graph edge endpoint');
    if (typeof edge.label !== 'string' || edge.label.length > 100) throw new Error('Invalid graph edge label');
    if ((edge.fromSide && !sides.includes(edge.fromSide)) || (edge.toSide && !sides.includes(edge.toSide))) throw new Error('Invalid graph connector side');
    if (edge.route && !['left','right'].includes(edge.route)) throw new Error('Invalid graph route');
    if (edge.labelAt && (!Array.isArray(edge.labelAt) || edge.labelAt.length !== 2 || !edge.labelAt.every(finite) || edge.labelAt[0] < 0 || edge.labelAt[0] > graph.width || edge.labelAt[1] < 0 || edge.labelAt[1] > graph.height)) throw new Error('Invalid graph label position');
    if (edge.via && (!Array.isArray(edge.via) || edge.via.some(point => !Array.isArray(point) || point.length !== 2 || !point.every(finite) || point[0] < 0 || point[0] > graph.width || point[1] < 0 || point[1] > graph.height))) throw new Error('Invalid graph waypoint');
  }
  return graph;
}

function point(node, side) {
  return side === 'top' ? [node.x + node.w/2,node.y] : side === 'bottom' ? [node.x + node.w/2,node.y + node.h] : side === 'left' ? [node.x,node.y + node.h/2] : [node.x + node.w,node.y + node.h/2];
}

export function graphConnections(graph) {
  validateGraph(graph);
  const nodes = new Map(graph.nodes.map(node => [node.id,node]));
  return graph.edges.map(edge => {
    const a = nodes.get(edge.from), b = nodes.get(edge.to);
    const sameRow = Math.abs((a.y+a.h/2)-(b.y+b.h/2)) < 2;
    let fromSide = edge.fromSide || (sameRow ? b.x > a.x ? 'right' : 'left' : b.y > a.y ? 'bottom' : 'top');
    let toSide = edge.toSide || (sameRow ? b.x > a.x ? 'left' : 'right' : b.y > a.y ? 'top' : 'bottom');
    if (edge.route) fromSide = toSide = edge.route;
    const start = point(a,fromSide), end = point(b,toSide);
    let middle;
    if (edge.via) middle = edge.via;
    else if (edge.route) {
      const x = edge.route === 'left' ? 19 : graph.width - 19;
      middle = [[x,start[1]],[x,end[1]]];
    } else if (start[0] === end[0] || start[1] === end[1]) middle = [];
    else if (['left','right'].includes(fromSide) && ['top','bottom'].includes(toSide)) middle = [[end[0],start[1]]];
    else if (['top','bottom'].includes(fromSide) && ['left','right'].includes(toSide)) middle = [[start[0],end[1]]];
    else if (['top','bottom'].includes(fromSide)) {
      const y = (start[1]+end[1])/2;
      middle = [[start[0],y],[end[0],y]];
    } else {
      const x = (start[0]+end[0])/2;
      middle = [[x,start[1]],[x,end[1]]];
    }
    const points = [start,...middle,end].filter((p,i,all) => !i || p[0] !== all[i-1][0] || p[1] !== all[i-1][1]);
    if (points.length < 2) throw new Error('Invalid graph connector: endpoints overlap');
    // Place edge labels on horizontal segments when available. Loop labels are
    // kept near the source instead of overlapping the long return line.
    const segments = points.slice(1).map((p,i) => ({ a:points[i], b:p, horizontal:p[1]===points[i][1], length:Math.abs(p[0]-points[i][0])+Math.abs(p[1]-points[i][1]) }));
    const segment = segments.filter(s => s.horizontal && s.length > 40).sort((a,b)=>b.length-a.length)[0] || segments.sort((a,b)=>b.length-a.length)[0];
    const labelPoint = edge.labelAt || [(segment.a[0]+segment.b[0])/2,(segment.a[1]+segment.b[1])/2];
    return { ...edge, fromSide, toSide, points, labelPoint };
  });
}

function lines(text, limit) {
  return text.split('\n').flatMap(paragraph => {
    const result = [''];
    for (const word of paragraph.split(/\s+/).flatMap(word => word.length > limit ? word.match(new RegExp(`.{1,${limit}}`,'g')) : [word])) {
      if (result.at(-1) && result.at(-1).length + word.length + 1 > limit) result.push(word);
      else result[result.length-1] += `${result.at(-1) ? ' ' : ''}${word}`;
    }
    return result;
  });
}

function nodeShape(node) {
  const {x,y,w,h,shape} = node;
  if (shape === 'decision') return `<path d="M${x+w/2} ${y} L${x+w} ${y+h/2} L${x+w/2} ${y+h} L${x} ${y+h/2} Z"/>`;
  if (shape === 'store') return `<path d="M${x} ${y+13} C${x} ${y-4} ${x+w} ${y-4} ${x+w} ${y+13} V${y+h-13} C${x+w} ${y+h+4} ${x} ${y+h+4} ${x} ${y+h-13} Z"/><path d="M${x} ${y+13} C${x} ${y+30} ${x+w} ${y+30} ${x+w} ${y+13}" fill="none"/>`;
  if (shape === 'document') return `<path d="M${x} ${y} H${x+w-17} L${x+w} ${y+17} V${y+h} H${x} Z"/><path d="M${x+w-17} ${y} V${y+17} H${x+w}" fill="none"/>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${shape==='terminal'?h/2:6}"/>`;
}

export function graphSvg(post, graph) {
  const edges = graphConnections(graph);
  const description = graph.edges.map(edge => `${graph.nodes.find(n=>n.id===edge.from).label.replace(/\n/g,' ')} → ${graph.nodes.find(n=>n.id===edge.to).label.replace(/\n/g,' ')}${edge.label ? ` (${edge.label})` : ''}`).join('; ');
  const nodes = graph.nodes.map(node => {
    const tone = tones[node.tone], label = lines(node.label, node.shape === 'decision' ? 19 : 22);
    const font = Math.min(17,Math.floor((node.h-18)/label.length/1.2));
    const y = node.y + node.h/2 - (label.length-1)*font*.65 + font*.35 + (node.shape === 'store' ? 5 : 0);
    return `<g fill="${tone.fill}" stroke="${tone.stroke}" stroke-width="1.4">${nodeShape(node)}</g><text x="${node.x+node.w/2}" y="${y}" fill="#25473d" font-size="${font}" font-weight="500" text-anchor="middle">${label.map((line,i)=>`<tspan x="${node.x+node.w/2}" dy="${i?font*1.3:0}">${escape(line)}</tspan>`).join('')}</text>`;
  }).join('');
  const paths = edges.map(edge => `<path d="${edge.points.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' ')}"${edge.dashed?' stroke-dasharray="6 4"':''}/>`).join('');
  const labels = edges.filter(edge=>edge.label).map(edge => {
    const [x,y] = edge.labelPoint, label = lines(edge.label,20), w = Math.max(...label.map(s=>s.length))*7+14, h = label.length*16+6;
    return `<g><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="4" fill="#fff"/><text x="${x}" y="${y-(label.length-1)*8+4}" fill="#566c62" font-size="12" text-anchor="middle">${label.map((line,i)=>`<tspan x="${x}" dy="${i?16:0}">${escape(line)}</tspan>`).join('')}</text></g>`;
  }).join('');
  const subtitle = lines(graph.subtitle,94);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${graph.width}" height="${graph.height}" viewBox="0 0 ${graph.width} ${graph.height}" role="img" aria-labelledby="title desc"><title id="title">${escape(graph.title)}</title><desc id="desc">${escape(description)}. ${escape(post.diagram?.caption||'')}</desc><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#dce4dc"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10 3 5Z" fill="#638474"/></marker></defs><rect width="100%" height="100%" fill="#fff"/><rect x="15" y="95" width="${graph.width-30}" height="${graph.height-110}" fill="url(#grid)"/><g font-family="Arial,Helvetica,sans-serif"><text x="28" y="24" fill="#698576" font-size="10" font-weight="700" letter-spacing="1.7">ENGINEERING NOTEBOOK / FLOW</text><text x="28" y="54" fill="#25473d" font-size="24" font-weight="700">${escape(graph.title)}</text><text x="28" y="77" fill="#687c70" font-size="12">${subtitle.map((line,i)=>`<tspan x="28" dy="${i?16:0}">${escape(line)}</tspan>`).join('')}</text><g fill="none" stroke="#638474" stroke-width="1.7" stroke-linejoin="round" marker-end="url(#arrow)">${paths}</g>${nodes}${labels}</g></svg>`;
}

export function drawioXml(post, graph) {
  const connections = graphConnections(graph);
  const shape = { process:'rounded=1;', decision:'rhombus;perimeter=rhombusPerimeter;', store:'shape=cylinder;', terminal:'rounded=1;arcSize=50;', document:'shape=note;' };
  const pointStyle = { top:'0.5;Y=0', right:'1;Y=0.5', bottom:'0.5;Y=1', left:'0;Y=0.5' };
  const cells = graph.nodes.map(node => `<mxCell id="node-${node.id}" value="${xml(node.label)}" vertex="1" parent="1" style="${shape[node.shape]}whiteSpace=wrap;html=0;fillColor=${tones[node.tone].fill};strokeColor=${tones[node.tone].stroke};fontColor=#25473d;fontFamily=Arial;fontSize=17;spacing=8;"><mxGeometry x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" as="geometry"/></mxCell>`).join('');
  const edges = connections.map((edge,i) => {
    const start = pointStyle[edge.fromSide].replace(';Y=',';exitY='), end = pointStyle[edge.toSide].replace(';Y=',';entryY=');
    return `<mxCell id="edge-${i}" value="${xml(edge.label)}" edge="1" parent="1" source="node-${edge.from}" target="node-${edge.to}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;endArrow=classic;endFill=1;strokeColor=#638474;fontColor=#566c62;fontSize=12;labelBackgroundColor=#ffffff;exitX=${start};entryX=${end};${edge.dashed?'dashed=1;':''}"><mxGeometry relative="1" as="geometry">${edge.points.length>2?`<Array as="points">${edge.points.slice(1,-1).map(p=>`<mxPoint x="${p[0]}" y="${p[1]}"/>`).join('')}</Array>`:''}</mxGeometry></mxCell>`;
  }).join('');
  const titleCell = `<mxCell id="graph-title" value="${xml(graph.title)}" vertex="1" parent="1" style="text;html=0;align=left;verticalAlign=middle;whiteSpace=wrap;fontSize=24;fontStyle=1;fontColor=#25473d;"><mxGeometry x="28" y="20" width="${graph.width-56}" height="40" as="geometry"/></mxCell>`;
  const subtitleCell = `<mxCell id="graph-subtitle" value="${xml(graph.subtitle)}" vertex="1" parent="1" style="text;html=0;align=left;whiteSpace=wrap;fontSize=12;fontColor=#687c70;"><mxGeometry x="28" y="62" width="${graph.width-56}" height="32" as="geometry"/></mxCell>`;
  return `<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net"><diagram id="${xml(post.slug)}" name="${xml(graph.title)}"><mxGraphModel dx="0" dy="0" grid="1" gridSize="20" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${graph.width}" pageHeight="${graph.height}" math="0" shadow="0" background="#ffffff"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${titleCell}${subtitleCell}${cells}${edges}</root></mxGraphModel></diagram></mxfile>`;
}
