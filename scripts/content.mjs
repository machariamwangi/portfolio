import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import csharp from 'highlight.js/lib/languages/csharp';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import sql from 'highlight.js/lib/languages/sql';
import powershell from 'highlight.js/lib/languages/powershell';

export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });
export const slugify = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const [name, language] of Object.entries({ csharp, bash, yaml, json, xml, dockerfile, sql, powershell })) hljs.registerLanguage(name, language);
const aliases = { cs: 'csharp', 'c#': 'csharp', sh: 'bash', shell: 'bash', yml: 'yaml', csproj: 'xml', docker: 'dockerfile', ps1: 'powershell' };
markdown.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index];
  const label = token.info.trim().split(/\s+/)[0] || 'text';
  const language = aliases[label.toLowerCase()] || label.toLowerCase();
  const code = hljs.getLanguage(language) ? hljs.highlight(token.content, { language, ignoreIllegals: true }).value : escapeHtml(token.content);
  return `<div class="code-block"><div class="code-toolbar"><span>${escapeHtml(label)}</span><button type="button" data-copy-code aria-label="Copy ${escapeHtml(label)} code">Copy code</button></div><pre tabindex="0"><code class="hljs language-${escapeHtml(language)}">${code}</code></pre></div>\n`;
};
const originalImage = markdown.renderer.rules.image;
markdown.renderer.rules.image = (tokens, index, options, env, self) => {
  tokens[index].attrSet('loading', 'lazy');
  return originalImage(tokens, index, options, env, self);
};

function renderArticle(content) {
  const tokens = markdown.parse(content, {});
  const toc = [];
  const used = new Set();
  tokens.forEach((token, index) => {
    if (token.type !== 'heading_open') return;
    const inline = tokens[index + 1];
    const title = (inline?.children || []).filter(child => child.type === 'text' || child.type === 'code_inline').map(child => child.content).join('');
    const base = `section-${slugify(title) || 'untitled'}`;
    let id = base, suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    token.attrSet('id', id);
    if (token.tag === 'h2') toc.push({ id, title });
  });
  return { body: markdown.renderer.render(tokens, markdown.options, {}), toc };
}

export function parsePost(source, filename, now = new Date()) {
  const { data, content } = matter(source);
  // Publishing must be deliberate. Old, malformed or missing draft flags stay private.
  if (data.draft !== false) return null;
  if (typeof data.title !== 'string' || !data.title.trim()) throw new Error(`${filename}: published posts need a title`);
  if (!(data.date instanceof Date) && (typeof data.date !== 'string' || !data.date.trim())) throw new Error(`${filename}: invalid publication date`);
  const date = new Date(data.date);
  if (Number.isNaN(date.getTime())) throw new Error(`${filename}: invalid publication date`);
  const dateOnly = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date);
  if (dateOnly && date.toISOString().slice(0, 10) !== data.date) throw new Error(`${filename}: invalid calendar date`);
  // The date-only editor uses Nairobi calendar days, including the hours before UTC midnight.
  const calendarDate = dateOnly || (data.date instanceof Date && date.toISOString().endsWith('T00:00:00.000Z'));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (calendarDate ? date.toISOString().slice(0, 10) > today : date > now) return null;
  const slug = data.slug || path.basename(filename, '.md');
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${filename}: use a lowercase, hyphenated slug`);
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const cover = typeof data.cover === 'string' && /^\/images\/[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp|svg)$/.test(data.cover) ? data.cover : '';
  const coverSmall = typeof data.coverSmall === 'string' && /^\/images\/[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp)$/.test(data.coverSmall) ? data.coverSmall : '';
  const coverFocus = typeof data.coverFocus === 'number' && data.coverFocus >= 0 && data.coverFocus <= 100 ? data.coverFocus : 50;
  let coverCredit = null;
  if (data.coverCredit) {
    const credit = data.coverCredit;
    const safeLink = value => {
      if (typeof value !== 'string') return false;
      try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
      catch { return false; }
    };
    if (!credit.author?.trim?.() || !credit.license?.trim?.() || !safeLink(credit.source) || !safeLink(credit.licenseUrl)) throw new Error(`${filename}: photo credits need an author, source HTTPS URL, license, and license HTTPS URL`);
    coverCredit = { author: credit.author.trim(), source: credit.source, license: credit.license.trim(), licenseUrl: credit.licenseUrl };
  }
  let diagram = null;
  if (data.diagram) {
    const d = data.diagram;
    if (!['flow', 'branch', 'cycle'].includes(d.kind) || !Array.isArray(d.steps) || d.steps.length < 3 || d.steps.length > 6 || d.steps.some(step => typeof step !== 'string' || !step.trim() || step.length > 100)) throw new Error(`${filename}: invalid diagram metadata`);
    if (d.kind === 'branch' && d.steps.length !== 5) throw new Error(`${filename}: branch diagrams require five steps`);
    diagram = { kind: d.kind, title: String(d.title || data.title), steps: d.steps, caption: String(d.caption || '') };
  }
  const updated = data.updated ? new Date(data.updated) : date;
  if (Number.isNaN(updated.getTime())) throw new Error(`${filename}: invalid updated date`);
  return { title: data.title.trim(), slug, date: date.toISOString(), updated: updated.toISOString(), description: String(data.description || ''), tags, minutes: Math.max(1, Math.ceil(words / 220)), words, ...renderArticle(content), url: `/writing/${slug}/`, category: String(data.category || 'Notes'), cover, coverSmall, coverFocus, coverAlt: String(data.coverAlt || ''), coverCredit, featured: data.featured === true, order: Number.isFinite(data.order) ? data.order : 100, diagram };
}

export async function readPosts(directory, now = new Date()) {
  const names = await fs.readdir(directory);
  const posts = (await Promise.all(names.filter(name => name.endsWith('.md')).map(async name => parsePost(await fs.readFile(path.join(directory, name), 'utf8'), name, now)))).filter(Boolean);
  const slugs = new Set();
  for (const post of posts) {
    if (slugs.has(post.slug)) throw new Error(`Duplicate post slug: ${post.slug}`);
    slugs.add(post.slug);
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order || a.title.localeCompare(b.title));
}
