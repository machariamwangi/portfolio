import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { before, test } from 'node:test';
import matter from 'gray-matter';
import { escapeHtml, readPosts } from '../scripts/content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDirectory = path.join(root, 'src', 'content');
const postDirectory = path.join(contentDirectory, 'posts');
const output = path.join(root, 'out');
const read = filename => fs.readFile(path.join(output, filename), 'utf8');

let projects;
let publishedPosts;
let generatedFiles;

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(filename));
    else files.push(filename);
  }
  return files;
}

before(async () => {
  // npm run check builds the same static Next.js export that is deployed.
  projects = JSON.parse(await fs.readFile(path.join(contentDirectory, 'projects.json'), 'utf8'));
  publishedPosts = await readPosts(postDirectory);
  generatedFiles = await walk(output);
});

test('the build includes each project with its detail route and any supplied destination URL', async () => {
  const listing = await read('building/index.html');
  assert.ok(projects.some(project => project.slug === 'mentor-management-system'));
  for (const project of projects) {
    const route = `/building/${project.slug}/`;
    assert.ok(listing.includes(`href="${route}"`), `${project.title} must appear in the project listing`);
    const detail = await read(`building/${project.slug}/index.html`);
    assert.ok(detail.includes(`<h1>${escapeHtml(project.title)}</h1>`), `${project.title} must have a detail page`);
    if (project.url) {
      assert.ok(detail.includes(`href="${escapeHtml(project.url)}"`), `${project.title} must retain its supplied destination`);
    } else {
      assert.ok(!detail.includes('Visit project'), `${project.title} must omit the external visit action`);
      assert.ok(!listing.includes(`aria-label="Visit ${escapeHtml(project.title)} website"`));
    }
    if (project.contribution) assert.ok(detail.includes(escapeHtml(project.contribution)));
    if (project.image) assert.ok(detail.includes(`src="${project.image}"`), `${project.title} must display its selected screenshot`);
    for (const view of project.gallery || []) {
      assert.ok(detail.includes(`src="${view.image}"`) && detail.includes(`href="${view.image}"`));
      assert.ok(detail.includes(`alt="${escapeHtml(view.alt)}"`) && detail.includes(escapeHtml(view.caption)));
    }
  }
});

test('generated HTML links and image/script references resolve to local pages or assets', async () => {
  const checked = new Set();
  for (const filename of generatedFiles.filter(filename => filename.endsWith('.html'))) {
    const document = await fs.readFile(filename, 'utf8');
    const relative = path.relative(output, filename).split(path.sep).join('/');
    const documentUrl = new URL(relative, 'https://portfolio.test/');
    for (const match of document.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/g)) {
      const reference = match[1].replace(/&amp;/g, '&');
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) continue;
      const url = new URL(reference, documentUrl);
      if (url.origin !== documentUrl.origin || checked.has(url.pathname)) continue;
      checked.add(url.pathname);
      let target = path.join(output, decodeURIComponent(url.pathname));
      let info;
      try { info = await fs.stat(target); }
      catch { assert.fail(`${relative} references missing local resource ${reference}`); }
      if (info.isDirectory()) {
        target = path.join(target, 'index.html');
        try { info = await fs.stat(target); }
        catch { assert.fail(`${relative} links to a directory with no index: ${reference}`); }
      }
      assert.ok(info.isFile(), `${reference} must resolve to a file`);
    }
  }
  assert.ok(checked.size >= 20, 'The audit must cover the generated navigation, projects, and assets');
});

test('drafts are absent from pages, search, feed, sitemap, and article routes', async () => {
  const surfaces = await Promise.all(['index.html', 'writing/index.html', 'search.json', 'feed.xml', 'sitemap.xml'].map(read));
  const search = JSON.parse(await read('search.json'));
  for (const name of (await fs.readdir(postDirectory)).filter(name => name.endsWith('.md'))) {
    const source = await fs.readFile(path.join(postDirectory, name), 'utf8');
    const { data } = matter(source);
    const privatePost = data.draft !== false || new Date(data.date) > new Date();
    if (!privatePost) continue;
    const slug = data.slug || path.basename(name, '.md');
    for (const surface of surfaces) {
      assert.ok(!surface.includes(`/writing/${slug}/`), `Draft route ${slug} must not be discoverable`);
      if (data.title) assert.ok(!surface.includes(escapeHtml(data.title)), `Draft title ${data.title} must remain private`);
    }
    assert.ok(!search.some(item => item.url === `/writing/${slug}/`));
    await assert.rejects(fs.access(path.join(output, 'writing', slug, 'index.html')), { code: 'ENOENT' });
  }

  assert.equal(search.filter(item => item.type === 'Article').length, publishedPosts.length);
});

test('source content and Markdown drafts are never copied to the public output', async () => {
  await assert.rejects(fs.access(path.join(output, 'content')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(output, 'src', 'content')), { code: 'ENOENT' });
  assert.deepEqual(generatedFiles.filter(filename => filename.endsWith('.md')), []);
  for (const filename of ['profile.json', 'projects.json', 'welcome.md']) {
    assert.ok(!generatedFiles.some(generated => path.basename(generated) === filename), `${filename} must not be published as a source file`);
  }
});

test('sitemap and RSS contain only generated routes and published articles', async () => {
  const sitemap = await read('sitemap.xml');
  const feed = await read('feed.xml');
  assert.match(sitemap, /^<\?xml[^>]*>\s*<urlset\b/);
  assert.match(sitemap, /<\/urlset>$/);
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1].replace(/&amp;/g, '&')));
  const search = JSON.parse(await read('search.json'));
  assert.deepEqual(new Set(locations.map(url => url.pathname)), new Set(search.map(entry => entry.url)));
  assert.equal(new Set(locations.map(url => url.href)).size, locations.length, 'Sitemap entries must be unique');
  for (const url of locations) {
    assert.ok(['http:', 'https:'].includes(url.protocol));
    const document = path.join(output, decodeURIComponent(url.pathname), 'index.html');
    assert.ok((await fs.stat(document)).isFile(), `Sitemap route must exist: ${url.pathname}`);
  }
  assert.match(feed, /^<\?xml[^>]*>\s*<rss\b/);
  assert.match(feed, /<channel>.*<\/channel><\/rss>$/s);
  const items = [...feed.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(match => match[1]);
  assert.equal(items.length, publishedPosts.length);
  for (const post of publishedPosts) {
    assert.ok(items.some(item => item.includes(`<title>${escapeHtml(post.title)}</title>`) && item.includes(post.url)), `RSS must include ${post.title}`);
  }
});
