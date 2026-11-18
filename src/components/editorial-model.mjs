export const topics = [
  {
    name: 'C# & .NET',
    slug: 'dotnet',
    title: 'Build with .NET',
    description: 'Modern C#, dependable APIs, and the details that matter in production.',
    number: '01',
  },
  {
    name: 'Delivery & CI',
    slug: 'delivery',
    title: 'Ship with confidence',
    description: 'CircleCI pipelines, containers, cloud identity, and safer releases.',
    number: '02',
  },
  {
    name: 'DevOps & Jira',
    slug: 'operations',
    title: 'Make teamwork work',
    description: 'From the first Jira board to delivery habits and running a service.',
    number: '03',
  },
  {
    name: 'Git & Teams',
    slug: 'git',
    title: 'Go deeper with Git',
    description: 'Find regressions, recover work, and make every review a little easier.',
    number: '04',
  },
];

export const dateLabel = (date) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Nairobi',
  }).format(new Date(date));

export function categoryFromTopic(value) {
  return topics.find((topic) => topic.slug === value)?.name || 'All';
}

export function searchText(post) {
  return [post.title, post.category, post.description, ...(post.tags || [])].join(' ').toLocaleLowerCase();
}

export function filterPosts(posts, category = 'All', query = '') {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return posts.filter(
    (post) =>
      (category === 'All' || post.category === category) &&
      terms.every((term) => searchText(post).includes(term))
  );
}

export function homePosts(posts) {
  const featured = posts.find((post) => post.featured) || posts[0];
  const candidates = [
    posts.find((post) => post.category === 'Delivery & CI'),
    posts.find((post) => post.category === 'DevOps & Jira'),
    ...posts,
  ];
  const latest = [
    ...new Map(
      candidates.filter((post) => post && post.slug !== featured?.slug).map((post) => [post.slug, post])
    ).values(),
  ].slice(0, 3);
  return { featured, latest };
}

export const relatedPosts = (post, posts) =>
  posts.filter((item) => item.slug !== post.slug && item.category === post.category).slice(0, 3);

function decodeAttribute(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, key) => {
    if (!key.startsWith('#')) return entities[key.toLowerCase()] || entity;
    const point = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\uFFFD';
  });
}

// Input must be the HTML-disabled MarkdownIt output produced by scripts/content.mjs.
// Only the exact standalone image for this article becomes an interactive figure.
export function articleSections(post) {
  const body = post.body || '';
  if (!post.diagram || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug))
    return [{ kind: 'markdown', html: body }];
  const src = `/images/diagrams/${post.slug}.svg`;
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<p>(<img\\b[^>]*\\bsrc="${escaped}"[^>]*>)<\\/p>`).exec(body);
  if (!match) return [{ kind: 'markdown', html: body }];
  const alt = decodeAttribute(
    match[1].match(/\balt="([^"]*)"/)?.[1] || post.diagram.title || 'Article diagram'
  );
  return [
    { kind: 'markdown', html: body.slice(0, match.index) },
    { kind: 'diagram', src, alt },
    { kind: 'markdown', html: body.slice(match.index + match[0].length) },
  ].filter((section) => section.kind === 'diagram' || section.html);
}
