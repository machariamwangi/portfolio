import fs from 'node:fs/promises';
import path from 'node:path';
import { readPosts } from '../../scripts/content.mjs';
import { articleDiagrams } from '../../scripts/article-diagrams.mjs';

const content = path.join(process.cwd(), 'src', 'content');

export const profileSections = {
  about: ['About me', (profile) => `Meet ${profile.name}, a software engineer in ${profile.location}.`],
  tools: ['Tools', () => 'The languages, frameworks, and tools I work with.'],
  'my-career': [
    'Career milestones',
    () => 'Selected roles and experiences from my software engineering journey.',
  ],
  contact: [
    'Contact',
    (profile) => `Get in touch with ${profile.name} about software projects and collaboration.`,
  ],
  www: ['On the web', () => 'Find me on GitHub, LinkedIn, or by email.'],
};

export function describePages(profile) {
  return [
    { url: '/', title: '', description: profile.intro },
    {
      url: '/building/',
      title: 'Building',
      description:
        'A showcase of my work across commerce, education, enterprise software, security, and finance.',
    },
    {
      url: '/writing/',
      title: 'The engineering notebook',
      description: 'Practical guides to C#, .NET, CircleCI, DevOps, Jira, and Git.',
    },
    ...Object.entries(profileSections).map(([slug, [title, describe]]) => ({
      url: `/${slug}/`,
      title,
      description: describe(profile),
    })),
  ];
}

async function loadContent() {
  const [profile, projects, posts] = await Promise.all([
    fs.readFile(path.join(content, 'profile.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(content, 'projects.json'), 'utf8').then(JSON.parse),
    readPosts(path.join(content, 'posts')),
  ]);
  const pages = describePages(profile);
  const articles = posts.map((post) => ({ ...post, diagramGraph: articleDiagrams[post.slug] || null }));
  const summaries = posts.map(({ body, toc, diagram, ...summary }) => summary);
  return { profile, projects, articles, summaries, pages };
}

// Static generation reuses parsed Markdown within each worker. Development reads fresh CMS saves.
let productionData;
export function getPortfolio() {
  if (process.env.NODE_ENV === 'production') return (productionData ??= loadContent());
  return loadContent();
}

export function pageMetadata(pages, url) {
  const { title, description } = pages.find((page) => page.url === url);
  return { title, description, current: url };
}
