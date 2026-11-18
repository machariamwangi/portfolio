import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeHtml, parsePost } from '../scripts/content.mjs';
import { diagramSvg } from '../scripts/diagrams.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPosts } from '../scripts/content.mjs';
import { articleSections, categoryFromTopic, filterPosts, homePosts, relatedPosts } from '../src/components/editorial-model.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postDirectory = path.join(root, 'src', 'content', 'posts');

const now = new Date('2026-11-18T12:00:00.000Z');
const metadata = {
  title: 'An editorial fixture', slug: 'editorial-fixture', date: '2026-11-18',
  description: 'A synthetic article used to verify rendering.', category: 'DevOps & Jira',
  tags: ['Testing'], draft: false,
};
const flow = {
  kind: 'flow', title: 'Observe, decide, verify',
  steps: ['Observe the service', 'Choose an action', 'Verify the result'],
  caption: 'Each action is followed by verification.',
};
const diagramImage = '![The service feedback loop](/images/diagrams/editorial-fixture.svg)';
function post(fields = {}, body = '## A useful heading\n\nA useful paragraph.') {
  const source = `---\n${JSON.stringify({ ...metadata, ...fields })}\n---\n\n${body}\n`;
  const result = parsePost(source, 'editorial-fixture.md', now);
  assert.ok(result, 'The synthetic fixture must be published');
  return result;
}
const occurrences = (value, needle) => value.split(needle).length - 1;


test('heading anchors are unique across heading levels and TOC titles preserve inline text', () => {
  const article = post({}, '## Café and `git`\n\n### Café and git\n\n## Café and git\n\n## [Read the docs](https://example.com) & **verify**');
  const headings = [...article.body.matchAll(/<h[1-6] id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(headings).size, headings.length);
  assert.deepEqual(article.toc.map(item => item.title), ['Café and git', 'Café and git', 'Read the docs & verify']);
  for (const item of article.toc) {
    assert.match(item.id, /^section-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(occurrences(article.body, `id="${item.id}"`), 1);
  }
});


test('unknown fenced languages and hostile labels cannot inject executable markup', () => {
  const article = post({}, '```unknown"onclick="alert(1)\n<script>alert("unsafe")</script>\n```');
  assert.doesNotMatch(article.body, /<script\b/i);
  assert.doesNotMatch(article.body, /\s(?:onclick|onfocus)=/i);
  assert.match(article.body, /&lt;script&gt;/);
  assert.match(article.body, /data-copy-code/);
  assert.match(article.body, /<pre tabindex="0"><code/);
});

test('supported fenced languages render highlighted code without enabling embedded HTML', () => {
  const article = post({}, '```cs\nvar message = "<script>alert(1)</script>";\n```');
  assert.match(article.body, /class="hljs language-csharp"/);
  assert.match(article.body, /hljs-keyword/);
  assert.doesNotMatch(article.body, /<script\b/i);
  assert.match(article.body, /&lt;script&gt;/);
});

test('diagram metadata rejects structures that the renderer cannot draw', () => {
  const invalid = [
    { ...flow, kind: 'unknown' },
    { ...flow, steps: ['Only', 'Two'] },
    { ...flow, steps: Array(7).fill('Too many') },
    { ...flow, steps: ['One', 2, 'Three'] },
    { ...flow, steps: ['One', '   ', 'Three'] },
    { ...flow, kind: 'branch' },
  ];
  for (const diagram of invalid) {
    assert.throws(() => post({ diagram }), /diagram/i);
  }
});

test('flow, branch and cycle SVGs contain accessible text and the required connections', () => {
  const shapes = [
    { ...flow, expectedEdges: 2 },
    { ...flow, kind: 'branch', steps: ['Assess', 'Repair now', 'Roll back', 'Rejoin', 'Verify'], expectedEdges: 5 },
    { ...flow, kind: 'cycle', expectedEdges: 3 },
  ];
  for (const shape of shapes) {
    const svg = diagramSvg(post({ diagram: shape }));
    assert.match(svg, /^<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /role="img" aria-labelledby="title desc"/);
    assert.ok(svg.includes(`<title id="title">${escapeHtml(shape.title)}</title>`));
    assert.ok(svg.includes(escapeHtml(shape.caption)));
    for (const step of shape.steps) assert.ok(svg.includes(escapeHtml(step)));
    const connections = svg.match(/<g fill="none"[^>]*>([\s\S]*?)<\/g>/)?.[1];
    assert.ok(connections);
    assert.equal((connections.match(/<path\b/g) || []).length, shape.expectedEdges, shape.kind);
    if (shape.kind === 'cycle') assert.match(connections, /stroke-dasharray/);
  }
});

test('SVG titles, labels and captions escape author-supplied markup', () => {
  const diagram = {
    ...flow,
    title: '</title><script>alert(1)</script>',
    steps: ['<image onload="run()">', 'A & B', '"Quoted"'],
    caption: '</desc><script>alert(2)</script>',
  };
  const svg = diagramSvg(post({ diagram }));
  assert.doesNotMatch(svg, /<(?:script|image)\b/i);
  assert.equal(occurrences(svg, '<title '), 1);
  assert.equal(occurrences(svg, '<desc '), 1);
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(svg.includes('A &amp; B'));
  assert.ok(svg.includes('&quot;Quoted&quot;'));
});


test('only the exact standalone article image becomes a React diagram section', () => {
  const body = ['## Before', 'Ordinary text before the diagram.', '![Another article](/images/diagrams/another-article.svg)', '![A similar path](/images/diagrams/editorial-fixtureXsvg)', diagramImage, 'Ordinary text after the diagram.'].join('\n\n');
  const article = post({ diagram: flow }, body);
  const sections = articleSections(article);
  assert.deepEqual(sections.filter(section => section.kind === 'diagram'), [{ kind: 'diagram', src: '/images/diagrams/editorial-fixture.svg', alt: 'The service feedback loop' }]);
  const html = sections.filter(section => section.kind === 'markdown').map(section => section.html).join('');
  assert.match(html, /<p><img src="\/images\/diagrams\/another-article\.svg"/);
  assert.match(html, /<p><img src="\/images\/diagrams\/editorial-fixtureXsvg"/);
  assert.equal(occurrences(html, 'Ordinary text before the diagram.'), 1);
  assert.equal(occurrences(html, 'Ordinary text after the diagram.'), 1);
  assert.deepEqual(sections.map(section => section.kind), ['markdown', 'diagram', 'markdown']);
});

test('diagram alt text is decoded for React without interpreting it as markup', () => {
  const article = post({ diagram: flow }, '![A & B "quoted" <unsafe>](/images/diagrams/editorial-fixture.svg)');
  const image = articleSections(article).find(section => section.kind === 'diagram');
  assert.equal(image.alt, 'A & B "quoted" <unsafe>');
  assert.equal(image.src, '/images/diagrams/editorial-fixture.svg');
});

test('section splitting leaves replacement tokens and author captions unchanged', () => {
  const caption = "Price $1, full $&, literal $$, <unsafe>.";
  const article = post({ diagram: { ...flow, caption } }, 'Before marker.\n\n' + diagramImage + '\n\nAfter marker.');
  const original = structuredClone(article);
  const sections = articleSections(article);
  assert.deepEqual(article, original);
  assert.equal(article.diagram.caption, caption);
  assert.equal(sections.filter(section => section.kind === 'diagram').length, 1);
  assert.equal(occurrences(sections.map(section => section.html || '').join(''), 'Before marker.'), 1);
  assert.equal(occurrences(sections.map(section => section.html || '').join(''), 'After marker.'), 1);
});

test('inline images and images without diagram metadata remain ordinary markdown', () => {
  for (const article of [post({ diagram: flow }, 'An inline illustration: ' + diagramImage), post({}, diagramImage)]) {
    assert.deepEqual(articleSections(article), [{ kind: 'markdown', html: article.body }]);
  }
});

test('home selections do not repeat the featured story and support summary-only records', () => {
  const articles = [
    { slug: 'delivery', category: 'Delivery & CI', featured: true },
    { slug: 'operations', category: 'DevOps & Jira' },
    { slug: 'dotnet', category: 'C# & .NET' }, { slug: 'git', category: 'Git & Teams' },
  ];
  const original = structuredClone(articles);
  const { featured, latest } = homePosts(articles);
  assert.equal(featured.slug, 'delivery');
  assert.deepEqual(latest.map(article => article.slug), ['operations', 'dotnet', 'git']);
  assert.deepEqual(articles, original);
  assert.deepEqual(homePosts([]), { featured: undefined, latest: [] });
});

test('writing search combines topic, case-insensitive terms, descriptions and tags', () => {
  const articles = [
    { slug: 'async', title: 'Async cancellation', category: 'C# & .NET', description: 'Cooperative deadlines', tags: ['Production'] },
    { slug: 'release', title: 'Production delivery', category: 'Delivery & CI', description: 'Deploying async workers', tags: ['Docker'] },
  ];
  assert.deepEqual(filterPosts(articles, 'C# & .NET', '  ASYNC production ').map(article => article.slug), ['async']);
  assert.deepEqual(filterPosts(articles, 'All', 'docker async').map(article => article.slug), ['release']);
  assert.equal(filterPosts(articles, 'C# & .NET', 'docker').length, 0);
  assert.equal(filterPosts(articles, 'All', ' \n ').length, 2);
  assert.equal(categoryFromTopic('delivery'), 'Delivery & CI');
  assert.equal(categoryFromTopic('unknown'), 'All');
  assert.equal(categoryFromTopic(undefined), 'All');
});

test('related articles exclude the current story and other collections', () => {
  const article = { slug: 'current', category: 'C# & .NET' };
  const items = [article, { slug: 'other', category: 'Git & Teams' }, ...['a', 'b', 'c', 'd'].map(slug => ({ slug, category: 'C# & .NET' }))];
  assert.deepEqual(relatedPosts(article, items).map(item => item.slug), ['a', 'b', 'c']);
});

// npm run check exports Next before these assertions; verify the real React output.
test('exported React homepage has distinct previews and the writing library contains every published article', async () => {
  const articles = await readPosts(postDirectory);
  const [home, writing] = await Promise.all(['index.html', 'writing/index.html'].map(file => fs.readFile(path.join(root, 'out', file), 'utf8')));
  const notebook = home.match(/<section class="notebook-section"[\s\S]*?<\/section>/)?.[0];
  assert.ok(notebook);
  const links = [...notebook.matchAll(/<h3><a[^>]*href="([^"]+)"/g)].map(match => match[1]);
  assert.equal(links.length, Math.min(3, articles.length - 1));
  assert.equal(new Set(links).size, links.length);
  assert.ok(!links.includes(homePosts(articles).featured.url));
  assert.equal((writing.match(/<article class="blog-card editorial-card"/g) || []).length, articles.length);
  for (const article of articles) assert.ok(writing.includes('href="' + article.url + '"'));
  assert.match(writing, /id="post-search"/);
  assert.match(writing, /id="post-count" aria-live="polite"/);
  assert.match(writing, /data-reset-posts/);
});

test('exported React articles retain credits, unique heading targets and accessible diagram downloads', async () => {
  const articles = await readPosts(postDirectory);
  for (const article of articles) {
    const html = await fs.readFile(path.join(root, 'out', 'writing', article.slug, 'index.html'), 'utf8');
    assert.match(html, /id="article-body"/);
    assert.match(html, /id="reading-progress"/);
    assert.match(html, /class="mobile-toc"/);
    assert.match(html, /class="markdown-fragment"/);
    for (const item of article.toc) {
      assert.equal(occurrences(html, 'id="' + item.id + '"'), 1, article.slug + ': unique heading ID');
      assert.ok(html.includes('href="#' + item.id + '"'), article.slug + ': TOC heading link');
    }
    if (article.coverCredit) {
      assert.match(html, /<figcaption class="photo-credit">Photo by/);
      assert.ok(html.includes('href="' + escapeHtml(article.coverCredit.source) + '"'));
      assert.ok(html.includes('href="' + escapeHtml(article.coverCredit.licenseUrl) + '"'));
      assert.ok(html.includes(escapeHtml(article.coverCredit.author)));
    }
    if (article.diagram) {
      assert.match(html, /class="article-diagram technical-diagram"/);
      assert.match(html, /class="diagram-viewport"[^>]*tabindex="0"[^>]*role="region"/);
      assert.ok(html.includes('href="/images/diagrams/' + article.slug + '.drawio"'));
      assert.match(html, /Read the flow as text/);
    }
  }
});
