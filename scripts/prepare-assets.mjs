import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { escapeHtml } from './content.mjs';
import { graphSvg, drawioXml } from './diagram-graph.mjs';
import { diagramSvg } from './diagrams.mjs';
import { getPortfolio } from '../src/lib/site-data.mjs';

const publicDir = path.resolve('public');
const diagramDir = path.join(publicDir, 'images', 'diagrams');
const origin = (process.env.SITE_URL || 'https://elijahmwangi.net').replace(/\/$/, '');

export async function prepareAssets() {
  const { profile, projects, articles, pages } = await getPortfolio();
  const search = pages.map((page) => ({ ...page, title: page.title || profile.name, type: 'Page' }));
  const seenProjects = new Set();
  for (const project of projects) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug) || seenProjects.has(project.slug))
      throw new Error(`Invalid or duplicate project slug: ${project.slug}`);
    seenProjects.add(project.slug);
    if (project.url != null && new URL(project.url).protocol !== 'https:') throw new Error('Project links must use HTTPS');
    if (project.image) await fs.access(path.join(publicDir, project.image));
    for (const view of project.gallery || []) {
      await fs.access(path.join(publicDir, view.image));
    }
    search.push({
      title: project.title,
      description: project.description,
      url: `/building/${project.slug}/`,
      type: 'Project',
    });
  }

  const covers = new Set();
  const generated = new Set();
  await fs.mkdir(diagramDir, { recursive: true });
  for (const post of articles) {
    search.push({ title: post.title, description: post.description, url: post.url, type: 'Article' });
    if (post.cover) {
      if (covers.has(post.cover)) throw new Error(`Repeated cover on ${post.slug}`);
      covers.add(post.cover);
      await fs.access(path.join(publicDir, post.cover));
    }
    if (post.coverSmall) await fs.access(path.join(publicDir, post.coverSmall));
    if (!post.diagram) continue;
    const graph = post.diagramGraph;
    const svg = post.slug + '.svg';
    await fs.writeFile(path.join(diagramDir, svg), graph ? graphSvg(post, graph) : diagramSvg(post));
    generated.add(svg);
    if (graph) {
      const diagram = post.slug + '.drawio';
      await fs.writeFile(path.join(diagramDir, diagram), drawioXml(post, graph));
      generated.add(diagram);
    }
  }
  // This folder holds generated diagrams only. Unpublishing an article must remove its exports.
  for (const name of await fs.readdir(diagramDir)) {
    if (/^[a-z0-9-]+\.(svg|drawio)$/.test(name) && !generated.has(name))
      await fs.unlink(path.join(diagramDir, name));
  }

  const xml = '<?xml version="1.0" encoding="UTF-8"?>';
  const sitemap = search.map(({ url }) => `<url><loc>${escapeHtml(origin + url)}</loc></url>`).join('');
  const feedItems = articles
    .map((post) => {
      const link = escapeHtml(origin + post.url);
      return `<item><title>${escapeHtml(
        post.title
      )}</title><link>${link}</link><guid>${link}</guid><pubDate>${new Date(
        post.date
      ).toUTCString()}</pubDate><description>${escapeHtml(post.description)}</description></item>`;
    })
    .join('');
  await Promise.all([
    fs.writeFile(path.join(publicDir, 'search.json'), JSON.stringify(search)),
    fs.writeFile(
      path.join(publicDir, 'sitemap.xml'),
      `${xml}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap}</urlset>`
    ),
    fs.writeFile(
      path.join(publicDir, 'robots.txt'),
      `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${origin}/sitemap.xml\n`
    ),
    fs.writeFile(
      path.join(publicDir, 'feed.xml'),
      `${xml}<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeHtml(
        profile.name
      )} — Writing</title><link>${origin}/writing/</link><description>Notes on software and building.</description><language>en</language><atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml"/>${feedItems}</channel></rss>`
    ),
  ]);
  console.log(
    `Prepared search, feeds, and diagrams for ${projects.length} projects and ${articles.length} articles.`
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await prepareAssets();
