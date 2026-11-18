import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parsePost, readPosts } from '../scripts/content.mjs';

const now = new Date('2026-11-17T12:00:00.000Z');
const metadata = { title: 'Useful software', slug: 'useful-software', date: '2026-01-10', description: 'A short note.', tags: ['Engineering'], draft: false };
const postSource = (data = metadata, body = '## A practical note\n\nBuild something useful.') => `---\n${JSON.stringify(data)}\n---\n\n${body}\n`;

async function temporaryPosts(t) {
  const root = path.resolve(os.tmpdir());
  const directory = await fs.mkdtemp(path.join(root, 'portfolio-content-test-'));
  t.after(async () => {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), root, 'Cleanup must stay directly inside the temporary directory');
    assert.ok(path.basename(resolved).startsWith('portfolio-content-test-'), 'Cleanup must target this test fixture');
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return directory;
}

test('posts stay private unless the draft flag is explicitly boolean false', () => {
  const { draft, ...withoutDraft } = metadata;
  assert.equal(parsePost(postSource(withoutDraft), 'missing-flag.md', now), null);
  for (const value of [true, 'false', 'true', null, 0, 1]) {
    assert.equal(parsePost(postSource({ ...metadata, draft: value }), 'private.md', now), null, `draft=${JSON.stringify(value)} must remain private`);
  }
});

test('explicitly published posts produce an article route and safe HTML', () => {
  const post = parsePost(postSource({ ...metadata, title: '  Useful software  ' }), 'article.md', now);
  assert.equal(post.title, 'Useful software');
  assert.equal(post.url, '/writing/useful-software/');
  assert.equal(post.date, '2026-01-10T00:00:00.000Z');
  assert.deepEqual(post.tags, ['Engineering']);
  assert.match(post.body, /<h2 id="section-a-practical-note">A practical note<\/h2>/);
  assert.ok(post.minutes >= 1);
});

test('future publication dates remain private', () => {
  assert.equal(parsePost(postSource({ ...metadata, date: '2026-11-18' }), 'scheduled.md', now), null);
});

test('date-only posts can publish after midnight in Nairobi before UTC midnight', () => {
  assert.ok(parsePost(postSource({ ...metadata, date: '2026-11-17' }), 'today.md', new Date('2026-11-16T22:00:00Z')));
});

test('published posts reject invalid title, date, and slug metadata', async (t) => {
  const cases = [
    ['missing title', { title: undefined }, /title/],
    ['blank title', { title: '   ' }, /title/],
    ['non-text title', { title: ['A title'] }, /title/],
    ['missing date', { date: undefined }, /date/],
    ['invalid date', { date: 'not-a-date' }, /date/],
    ['null date', { date: null }, /date/],
    ['invalid calendar date', { date: '2026-02-31' }, /date/],
    ['path traversal slug', { slug: '../outside' }, /slug/],
    ['uppercase slug', { slug: 'Useful-Software' }, /slug/],
    ['spaced slug', { slug: 'useful software' }, /slug/],
    ['numeric slug', { slug: 123 }, /slug/],
  ];
  for (const [name, fields, message] of cases) {
    await t.test(name, () => assert.throws(() => parsePost(postSource({ ...metadata, ...fields }), 'invalid.md', now), message));
  }
});

test('duplicate published slugs are rejected instead of overwriting an article', async (t) => {
  const directory = await temporaryPosts(t);
  await Promise.all([
    fs.writeFile(path.join(directory, 'first.md'), postSource(metadata)),
    fs.writeFile(path.join(directory, 'second.md'), postSource({ ...metadata, title: 'Another article' })),
  ]);
  await assert.rejects(readPosts(directory, now), /Duplicate post slug: useful-software/);
});

test('readPosts returns only published articles, newest first', async (t) => {
  const directory = await temporaryPosts(t);
  await Promise.all([
    fs.writeFile(path.join(directory, 'earlier.md'), postSource({ ...metadata, slug: 'earlier', date: '2025-03-10' })),
    fs.writeFile(path.join(directory, 'later.md'), postSource({ ...metadata, slug: 'later', date: '2026-07-12' })),
    fs.writeFile(path.join(directory, 'draft.md'), postSource({ ...metadata, slug: 'draft', draft: true })),
    fs.writeFile(path.join(directory, 'scheduled.md'), postSource({ ...metadata, slug: 'scheduled', date: '2099-01-01' })),
    fs.writeFile(path.join(directory, '.gitkeep'), ''),
  ]);
  assert.deepEqual((await readPosts(directory, now)).map(post => post.slug), ['later', 'earlier']);
});

test('Markdown cannot turn raw scripts or javascript links into executable markup', () => {
  const body = '<script>alert("unsafe")</script>\n\n<img src=x onerror=alert(1)>\n\n[Unsafe](javascript:alert(1))\n\n[Safe](https://example.com)';
  const post = parsePost(postSource(metadata, body), 'unsafe-content.md', now);
  assert.doesNotMatch(post.body, /<script\b/i);
  assert.doesNotMatch(post.body, /<img\b/i);
  assert.doesNotMatch(post.body, /(?:href|src)\s*=\s*["']\s*javascript:/i);
  assert.match(post.body, /&lt;script&gt;/);
  assert.match(post.body, /href="https:\/\/example\.com"/);
});

test('photo credits reject unsafe or incomplete source links', () => {
  const credit = { author: 'A photographer', source: 'https://example.com/photo', license: 'Photo license', licenseUrl: 'https://example.com/license' };
  assert.deepEqual(parsePost(postSource({ ...metadata, coverCredit: credit }), 'photo.md', now).coverCredit, credit);
  for (const unsafe of ['javascript:alert(1)', 'data:text/html,unsafe', 'https://name:secret@example.com/photo', '/relative']) {
    for (const field of ['source', 'licenseUrl']) {
      assert.throws(() => parsePost(postSource({ ...metadata, coverCredit: { ...credit, [field]: unsafe } }), 'photo.md', now), /photo credits/);
    }
  }
  assert.throws(() => parsePost(postSource({ ...metadata, coverCredit: { author: 'Only a name' } }), 'photo.md', now), /photo credits/);
});
