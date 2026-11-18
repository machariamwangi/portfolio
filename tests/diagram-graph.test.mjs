import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeHtml } from '../scripts/content.mjs';
import { graphSvg, drawioXml, validateGraph, graphConnections } from '../scripts/diagram-graph.mjs';

const post = { slug: 'graph-fixture', diagram: { caption: 'Inspect the evidence before continuing.' } };
const node = (id, x, y, shape = 'process', tone = 'green') => ({ id, label: `Step ${id}`, x, y, w: 190, h: shape === 'decision' ? 100 : 80, shape, tone });
function graphFixture() {
  return {
    title: 'A decision with a feedback loop', subtitle: 'A synthetic graph exercises branching, merging and recovery.',
    width: 780, height: 740,
    nodes: [node('start', 290, 110, 'terminal'), node('decision', 290, 250, 'decision', 'amber'), node('repair', 40, 420, 'process', 'red'), node('store', 540, 420, 'store', 'blue'), node('evidence', 290, 580, 'document')],
    edges: [
      { from: 'start', to: 'decision', label: '' },
      { from: 'decision', to: 'repair', label: 'No', fromSide: 'left', toSide: 'top' },
      { from: 'decision', to: 'store', label: 'Yes' },
      { from: 'repair', to: 'evidence', label: 'Recheck', via: [[135, 540], [385, 540]] },
      { from: 'store', to: 'evidence', label: 'Verify' },
      { from: 'evidence', to: 'start', label: 'Learn', route: 'left', dashed: true },
    ],
  };
}
const mutate = change => { const graph = graphFixture(); change(graph); return graph; };
const sidePoint = (value, side) => ({
  top: [value.x + value.w / 2, value.y], right: [value.x + value.w, value.y + value.h / 2],
  bottom: [value.x + value.w / 2, value.y + value.h], left: [value.x, value.y + value.h / 2],
})[side];
const attrs = source => Object.fromEntries([...source.matchAll(/([A-Za-z][\w-]*)="([^"]*)"/g)].map(match => [match[1], match[2]]));
const cells = xml => [...xml.matchAll(/<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g)].map(match => ({ ...attrs(match[1]), content: match[2] || '' }));
const xmlEscape = value => escapeHtml(value).replace(/\n/g, '&#10;');

test('valid branching graph supports every authored node shape without mutation', () => {
  const graph = graphFixture(), before = structuredClone(graph);
  assert.doesNotThrow(() => validateGraph(graph));
  assert.equal(graphConnections(graph).length, graph.edges.length);
  assert.match(graphSvg(post, graph), /^<svg\b/);
  assert.match(drawioXml(post, graph), /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.deepEqual(graph, before);
});

test('invalid graph structure and node geometry are rejected before rendering', async t => {
  const cases = [
    ['missing graph', null],
    ['non-finite canvas', mutate(g => { g.width = Infinity; })],
    ['undersized canvas', mutate(g => { g.height = 100; })],
    ['oversized canvas', mutate(g => { g.width = 5000; })],
    ['missing title', mutate(g => { delete g.title; })],
    ['empty title', mutate(g => { g.title = '  '; })],
    ['non-text subtitle', mutate(g => { g.subtitle = 4; })],
    ['missing nodes', mutate(g => { g.nodes = []; })],
    ['missing edges', mutate(g => { g.edges = []; })],
    ['duplicate node IDs', mutate(g => { g.nodes[1].id = g.nodes[0].id; })],
    ['unsafe node ID', mutate(g => { g.nodes[0].id = 'a" onclick="run()'; })],
    ['empty node label', mutate(g => { g.nodes[0].label = ' '; })],
    ['non-text node label', mutate(g => { g.nodes[0].label = []; })],
    ['excessive node label', mutate(g => { g.nodes[0].label = 'x'.repeat(201); })],
    ['unknown shape', mutate(g => { g.nodes[0].shape = 'script'; })],
    ['unknown tone', mutate(g => { g.nodes[0].tone = '__proto__'; })],
    ['non-numeric coordinate', mutate(g => { g.nodes[0].x = '290'; })],
    ['NaN coordinate', mutate(g => { g.nodes[0].y = NaN; })],
    ['negative coordinate', mutate(g => { g.nodes[0].x = -1; })],
    ['node outside canvas', mutate(g => { g.nodes[0].x = 700; })],
    ['unusable node width', mutate(g => { g.nodes[0].w = 10; })],
  ];
  for (const [name, graph] of cases) await t.test(name, () => {
    assert.throws(() => validateGraph(graph));
    assert.throws(() => graphSvg(post, graph));
    assert.throws(() => drawioXml(post, graph));
  });
});

test('node IDs must be strings even when coercion would produce a valid-looking ID', () => {
  for (const invalid of [undefined, null, true, false]) {
    const graph = mutate(g => { g.nodes[0].id = invalid; g.edges[0].from = invalid; g.edges.at(-1).to = invalid; });
    assert.throws(() => validateGraph(graph), /ID|id/i, `Reject ${String(invalid)} as a node ID`);
  }
});

test('invalid edge endpoints, routing sides and explicit waypoints are rejected', async t => {
  const cases = [
    ['missing source', { from: 'missing' }], ['missing target', { to: 'missing' }],
    ['self connector', { from: 'start', to: 'start' }], ['non-text label', { label: 0 }],
    ['long label', { label: 'x'.repeat(101) }], ['invalid source side', { fromSide: 'middle' }],
    ['invalid target side', { toSide: 'middle' }], ['invalid outer route', { route: 'top' }],
    ['invalid waypoint collection', { via: '100,100' }], ['incomplete waypoint', { via: [[100]] }],
    ['non-finite waypoint', { via: [[100, NaN]] }], ['negative waypoint', { via: [[-1, 100]] }],
    ['waypoint outside canvas', { via: [[800, 100]] }],
  ];
  for (const [name, patch] of cases) await t.test(name, () => {
    assert.throws(() => graphConnections(mutate(g => Object.assign(g.edges[0], patch))));
  });
});

test('explicit label coordinates are finite pairs inside the canvas, never markup', () => {
  const valid = mutate(g => { g.edges[1].labelAt = [250, 350]; });
  assert.doesNotThrow(() => validateGraph(valid));
  assert.deepEqual(graphConnections(valid)[1].labelPoint, [250, 350]);
  for (const labelAt of ['100,100', [], [100], [100, 100, 100], [NaN, 100], [100, Infinity], [-1, 100], [100, 800], ['200" onload="alert(1)', 200]]) {
    const graph = mutate(g => { g.edges[1].labelAt = labelAt; });
    assert.throws(() => validateGraph(graph), /label|coordinate|point/i);
    assert.throws(() => graphSvg(post, graph));
  }
});

test('connector endpoints attach to the selected node boundaries with finite orthogonal segments', () => {
  const graph = graphFixture(), connections = graphConnections(graph);
  for (const connection of connections) {
    const from = graph.nodes.find(value => value.id === connection.from), to = graph.nodes.find(value => value.id === connection.to);
    assert.deepEqual(connection.points[0], sidePoint(from, connection.fromSide));
    assert.deepEqual(connection.points.at(-1), sidePoint(to, connection.toSide));
    assert.ok(connection.points.length >= 2);
    for (const point of connection.points) assert.ok(point.length === 2 && point.every(Number.isFinite));
    for (let i = 1; i < connection.points.length; i++) {
      const a = connection.points[i - 1], b = connection.points[i];
      assert.ok(a[0] === b[0] || a[1] === b[1], `${connection.from} → ${connection.to} must be orthogonal`);
      assert.notDeepEqual(a, b, 'Consecutive duplicate points must not create zero-length segments');
    }
  }
  assert.equal(connections[1].fromSide, 'left');
  assert.equal(connections[1].toSide, 'top');
  assert.deepEqual(connections[3].points.slice(1, -1), graph.edges[3].via);
  assert.equal(connections.at(-1).fromSide, 'left');
  assert.equal(connections.at(-1).toSide, 'left');
  assert.ok(connections.at(-1).points.slice(1, -1).every(point => point[0] < 40));
});

test('touching nodes have a controlled connector result or an explanatory rejection', () => {
  const graph = { ...graphFixture(), nodes: [node('one', 290, 110), node('two', 290, 190)], edges: [{ from: 'one', to: 'two', label: 'Continue' }] };
  let connections;
  try {
    connections = graphConnections(graph);
  } catch (error) {
    assert.match(error.message, /zero.?length|coincident|touch|overlap|connector/i, 'Reject coincident endpoints explicitly, rather than crashing on an undefined segment');
    return;
  }
  assert.equal(connections.length, 1);
  assert.ok(connections[0].labelPoint.every(Number.isFinite));
  assert.doesNotMatch(graphSvg(post, graph), /(?:NaN|Infinity|undefined)/);
});

test('SVG uses graph connector points, accessible descriptions and unique internal IDs', () => {
  const graph = graphFixture(), svg = graphSvg(post, graph);
  assert.match(svg, /role="img" aria-labelledby="title desc"/);
  assert.ok(svg.includes(`<title id="title">${escapeHtml(graph.title)}</title>`));
  assert.ok(svg.includes(escapeHtml(post.diagram.caption)));
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('title') && ids.includes('desc') && ids.includes('arrow'));
  for (const connection of graphConnections(graph)) {
    const path = connection.points.map((point, index) => `${index ? 'L' : 'M'}${point[0]} ${point[1]}`).join(' ');
    assert.ok(svg.includes(`d="${path}"`), `Missing rendered connector from ${connection.from} to ${connection.to}`);
  }
  assert.match(svg, /stroke-dasharray="6 4"/);
});

test('SVG and draw.io text escape markup without enabling HTML or scripting', () => {
  const title = '<script>alert("title")</script> & \'review\'';
  const graph = mutate(g => {
    g.title = title; g.subtitle = '<iframe src="bad"> & review';
    g.nodes[0].label = 'A <svg onload="x"> & B\nSecond line';
    g.edges[0].label = '<script> & "';
  });
  const hostilePost = { slug: 'fixture"/><script>bad</script>', diagram: { caption: '<script>caption</script> & review' } };
  const svg = graphSvg(hostilePost, graph), xml = drawioXml(hostilePost, graph);
  for (const output of [svg, xml]) {
    assert.doesNotMatch(output, /<(?:script|iframe|foreignObject|object|embed)\b/i);
    assert.doesNotMatch(output, /\son(?:load|click|error)="/i);
    assert.doesNotMatch(output, /html=1/);
  }
  assert.ok(svg.includes(`<title id="title">${escapeHtml(title)}</title>`));
  assert.ok(svg.includes(escapeHtml(hostilePost.diagram.caption)));
  assert.ok(xml.includes(`id="${xmlEscape(hostilePost.slug)}"`));
  assert.ok(xml.includes(`value="${xmlEscape(graph.nodes[0].label)}"`));
  assert.ok(xml.includes(`value="${xmlEscape(graph.edges[0].label)}"`));
  assert.match(xml, /&#10;Second line/);
});

test('draw.io export contains native editable cells with unique IDs and valid parents/endpoints', () => {
  const graph = graphFixture(), xml = drawioXml(post, graph), parsed = cells(xml);
  assert.match(xml, /<mxfile\b[^>]*host="app\.diagrams\.net"/);
  assert.match(xml, /<diagram id="graph-fixture"/);
  assert.match(xml, /<mxGraphModel\b[^>]*pageWidth="780"[^>]*pageHeight="740"/);
  assert.match(xml, /<root>.*<\/root><\/mxGraphModel><\/diagram><\/mxfile>$/s);
  const byId = new Map(parsed.map(cell => [cell.id, cell]));
  assert.equal(byId.size, parsed.length, 'Every mxCell ID is unique');
  assert.equal(parsed.length, 4 + graph.nodes.length + graph.edges.length);
  assert.ok(byId.has('0'));
  assert.equal(byId.get('1').parent, '0');
  for (const cell of parsed.filter(value => !['0', '1'].includes(value.id))) {
    assert.equal(cell.parent, '1');
    assert.match(cell.style, /(?:^|;)html=0;/);
    assert.match(cell.content, /<mxGeometry\b/);
  }
  for (const value of graph.nodes) {
    const cell = byId.get(`node-${value.id}`);
    assert.equal(cell.vertex, '1');
    assert.equal(cell.value, xmlEscape(value.label));
    const geometry = attrs(cell.content.match(/<mxGeometry\b([^>]*)/)[1]);
    assert.deepEqual([geometry.x, geometry.y, geometry.width, geometry.height].map(Number), [value.x, value.y, value.w, value.h]);
  }
  for (const [index, connection] of graphConnections(graph).entries()) {
    const cell = byId.get(`edge-${index}`);
    assert.equal(cell.edge, '1');
    assert.equal(cell.source, `node-${connection.from}`);
    assert.equal(cell.target, `node-${connection.to}`);
    assert.ok(byId.has(cell.source) && byId.has(cell.target));
    assert.match(cell.style, /endArrow=classic;/);
    const ports = { top: [0.5, 0], right: [1, 0.5], bottom: [0.5, 1], left: [0, 0.5] };
    const style = Object.fromEntries(cell.style.split(';').filter(part => part.includes('=')).map(part => part.split('=')));
    assert.deepEqual([Number(style.exitX), Number(style.exitY)], ports[connection.fromSide]);
    assert.deepEqual([Number(style.entryX), Number(style.entryY)], ports[connection.toSide]);
    assert.match(cell.content, /<mxGeometry relative="1" as="geometry">/);
    const points = [...cell.content.matchAll(/<mxPoint\b([^>]*)\/>/g)].map(match => { const point = attrs(match[1]); return [Number(point.x), Number(point.y)]; });
    assert.deepEqual(points, connection.points.slice(1, -1));
  }
});
