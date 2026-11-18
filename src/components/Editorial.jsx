import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  articleSections,
  categoryFromTopic,
  dateLabel,
  filterPosts,
  relatedPosts,
  searchText,
  topics,
} from './editorial-model.mjs';

const portrait = '/images/elijah-macharia-profile.jpg';
const Arrow = () => <span aria-hidden="true">↗</span>;

export function PhotoCredit({ post }) {
  const credit = post.coverCredit;
  if (!credit) return null;
  return (
    <>
      Photo by{' '}
      <a href={credit.source} target="_blank" rel="noopener noreferrer">
        {credit.author}
      </a>{' '}
      ·{' '}
      <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">
        {credit.license}
      </a>
    </>
  );
}

function CoverImage({ post, card = false, sizes, priority = false }) {
  const source = card ? post?.coverSmall || post?.cover : post?.cover;
  return (
    <img
      src={source}
      srcSet={post?.coverSmall ? `${post.coverSmall} 768w, ${post.cover} 1536w` : undefined}
      sizes={post?.coverSmall ? sizes : undefined}
      alt={card ? '' : post?.coverAlt || ''}
      width="1536"
      height="1024"
      loading={priority ? undefined : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      style={{ objectPosition: `50% ${Number.isFinite(post?.coverFocus) ? post.coverFocus : 50}%` }}
    />
  );
}

export function BlogCard({ post }) {
  return (
    <article
      className="blog-card editorial-card"
      data-post-category={post.category}
      data-search={searchText(post)}
    >
      {post.cover && (
        <Link className="blog-cover" href={post.url} tabIndex={-1} aria-hidden="true">
          <CoverImage
            post={post}
            card
            sizes="(max-width: 600px) calc(100vw - 46px), (max-width: 850px) 45vw, 390px"
          />
          <span className="cover-index">{String(post.order).padStart(2, '0')}</span>
        </Link>
      )}
      <div className="blog-card-body">
        <div className="article-kicker">
          <span>{post.category}</span>
          <span>{post.minutes} min read</span>
        </div>
        <h3>
          <Link href={post.url}>{post.title}</Link>
        </h3>
        <p>{post.description}</p>
        <div className="blog-card-foot">
          <time dateTime={post.date}>{dateLabel(post.date)}</time>
          <Link href={post.url} aria-label={`Read ${post.title}`}>
            Read the story <Arrow />
          </Link>
        </div>
      </div>
    </article>
  );
}

function Collections({ posts }) {
  return (
    <div className="collection-grid">
      {topics.map((topic) => (
        <Link className="collection-card" key={topic.slug} href={`/writing/?topic=${topic.slug}#articles`}>
          <span className="collection-number">
            {topic.number} / {posts.filter((post) => post.category === topic.name).length} articles
          </span>
          <h3>
            {topic.title} <Arrow />
          </h3>
          <p>{topic.description}</p>
          <span className="collection-tag">{topic.name}</span>
        </Link>
      ))}
    </div>
  );
}

export function WritingPage({ posts }) {
  const router = useRouter();
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!router.isReady) return;
    const topic = Array.isArray(router.query.topic) ? router.query.topic[0] : router.query.topic;
    setCategory(categoryFromTopic(topic));
  }, [router.isReady, router.query.topic]);
  const visiblePosts = useMemo(() => filterPosts(posts, category, query), [posts, category, query]);
  function chooseTopic(nextCategory) {
    setCategory(nextCategory);
    const url = new URL(window.location.href);
    const topic = topics.find((item) => item.name === nextCategory);
    if (topic) url.searchParams.set('topic', topic.slug);
    else url.searchParams.delete('topic');
    void router.replace(`${url.pathname}${url.search}${url.hash}`, undefined, {
      shallow: true,
      scroll: false,
    });
  }
  return (
    <>
      <header className="journal-hero container">
        <div>
          <p className="eyebrow">The engineering notebook</p>
          <h1>
            Build. Learn.
            <br />
            <em>Pass it on.</em>
          </h1>
        </div>
        <div className="journal-intro">
          <p>Notes on better code, calmer deployments, and teams that work well together.</p>
          <span>{posts.length} practical guides · Four collections</span>
          <a className="text-link" href="/feed.xml">
            Follow via RSS <Arrow />
          </a>
        </div>
      </header>
      <section className="container journal-collections" aria-label="Article collections">
        <Collections posts={posts} />
      </section>
      <section className="section container journal-library" id="articles">
        <div className="library-heading">
          <h2>The complete notebook</h2>
          <span id="post-count" aria-live="polite">
            {visiblePosts.length} {visiblePosts.length === 1 ? 'article' : 'articles'}
          </span>
        </div>
        <div className="journal-toolbar">
          <div className="filters" role="group" aria-label="Filter articles by topic">
            <button
              type="button"
              className={`filter-chip${category === 'All' ? ' active' : ''}`}
              data-post-filter="All"
              aria-pressed={category === 'All'}
              onClick={() => chooseTopic('All')}
            >
              All topics
            </button>
            {topics.map((topic) => (
              <button
                type="button"
                key={topic.slug}
                className={`filter-chip${category === topic.name ? ' active' : ''}`}
                data-post-filter={topic.name}
                data-topic={topic.slug}
                aria-pressed={category === topic.name}
                onClick={() => chooseTopic(topic.name)}
              >
                {topic.name}
              </button>
            ))}
          </div>
          <label className="journal-search">
            <span className="screen-reader-only">Search articles</span>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              id="post-search"
              placeholder="Find an idea…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="blog-grid journal-grid">
          {visiblePosts.map((post) => (
            <BlogCard post={post} key={post.slug} />
          ))}
        </div>
        <div id="post-empty" className="empty-state" hidden={visiblePosts.length !== 0}>
          <h3>No articles found.</h3>
          <p>Try a broader search or choose another topic.</p>
          <button
            type="button"
            className="button secondary"
            data-reset-posts
            onClick={() => {
              setQuery('');
              chooseTopic('All');
            }}
          >
            Show all articles
          </button>
        </div>
      </section>
    </>
  );
}

function TableOfContents({ items }) {
  return (
    <ol>
      {items.map((item) => (
        <li key={item.id}>
          <a href={`#${item.id}`}>{item.title}</a>
        </li>
      ))}
    </ol>
  );
}

function ArticleDiagram({ post, image }) {
  const graph = post.diagramGraph;
  const diagramImage = <img src={image.src} alt={image.alt} loading="lazy" />;
  if (!graph)
    return (
      <figure className="article-diagram">
        {diagramImage}
        <figcaption>{post.diagram.caption}</figcaption>
      </figure>
    );
  const labels = new Map(graph.nodes.map((node) => [node.id, node.label.replace(/\n/g, ' ')]));
  return (
    <figure className="article-diagram technical-diagram">
      <div className="diagram-toolbar">
        <span>{graph.title}</span>
        <div>
          <a href={image.src} target="_blank" rel="noopener noreferrer">
            Open full size ↗
          </a>
          <a href={`/images/diagrams/${post.slug}.drawio`} download>
            Download .drawio ↓
          </a>
        </div>
      </div>
      <p className="diagram-scroll-hint">Scroll across or open full size to explore the diagram.</p>
      <div
        className="diagram-viewport"
        tabIndex={0}
        role="region"
        aria-label={`${graph.title}; scroll to explore`}
      >
        {diagramImage}
      </div>
      <figcaption>{post.diagram.caption}</figcaption>
      <details className="diagram-text">
        <summary>Read the flow as text</summary>
        <ul>
          {graph.edges.map((edge, index) => (
            <li key={`${edge.from}-${edge.to}-${index}`}>
              {labels.get(edge.from)} <span aria-hidden="true">→</span>
              <span className="screen-reader-only">leads to</span> {labels.get(edge.to)}
              {edge.label && (
                <>
                  {' '}
                  <strong>({edge.label})</strong>
                </>
              )}
              .
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}

function useArticleTools(articleRef, sidebarRef, progressRef, post) {
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    let disposed = false;
    let frame = 0;
    const timers = new Map();
    const listeners = [];
    const listen = (target, event, callback, options) => {
      target?.addEventListener(event, callback, options);
      listeners.push(() => target?.removeEventListener(event, callback, options));
    };
    const headings = [...article.querySelectorAll('h2[id]')];
    const tocLinks = [...(sidebarRef.current?.querySelectorAll('a[href^="#"]') || [])];
    const updateReading = () => {
      frame = 0;
      const rect = article.getBoundingClientRect();
      const amount = Math.max(
        0,
        Math.min(1, (120 - rect.top) / Math.max(1, rect.height - window.innerHeight + 160))
      );
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${amount})`;
      const current =
        [...headings].reverse().find((heading) => heading.getBoundingClientRect().top <= 170) ||
        headings[0];
      tocLinks.forEach((link) => {
        if (link.getAttribute('href') === `#${current?.id}`) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    };
    const scheduleReading = () => {
      if (!frame) frame = requestAnimationFrame(updateReading);
    };
    listen(window, 'scroll', scheduleReading, { passive: true });
    listen(window, 'resize', scheduleReading);
    listen(window, 'load', scheduleReading);
    listen(article, 'load', scheduleReading, true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleReading);
    observer?.observe(article);
    article.querySelectorAll('.diagram-viewport').forEach((viewport) => {
      const image = viewport.querySelector('img');
      const center = () => {
        if (viewport.scrollWidth > viewport.clientWidth)
          viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
      };
      if (image?.complete) center();
      else listen(image, 'load', center, { once: true });
    });
    const copyCode = async (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-copy-code]') : null;
      if (!button || !article.contains(button)) return;
      const code = button.closest('.code-block')?.querySelector('code');
      if (!code) return;
      let label = 'Copied!';
      try {
        await navigator.clipboard.writeText(code.textContent);
      } catch {
        if (disposed) return;
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection?.removeAllRanges();
        selection?.addRange(range);
        label = 'Select & copy';
      }
      if (disposed) return;
      clearTimeout(timers.get(button));
      button.textContent = label;
      button.setAttribute('aria-live', 'polite');
      timers.set(
        button,
        setTimeout(() => {
          button.textContent = 'Copy code';
          timers.delete(button);
        }, 2200)
      );
    };
    listen(article, 'click', copyCode);
    updateReading();
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      listeners.forEach((remove) => remove());
      timers.forEach((timer, button) => {
        clearTimeout(timer);
        button.textContent = 'Copy code';
      });
      tocLinks.forEach((link) => link.removeAttribute('aria-current'));
      if (progressRef.current) progressRef.current.style.transform = 'scaleX(0)';
    };
  }, [articleRef, sidebarRef, progressRef, post.slug, post.body]);
}

export function ArticlePage({ post, posts, profile }) {
  const articleRef = useRef(null);
  const sidebarRef = useRef(null);
  const progressRef = useRef(null);
  const sections = useMemo(() => articleSections(post), [post]);
  const related = relatedPosts(post, posts);
  useArticleTools(articleRef, sidebarRef, progressRef, post);
  return (
    <>
      <div className="reading-progress" aria-hidden="true">
        <span id="reading-progress" ref={progressRef} />
      </div>
      <article className="reading-page">
        <header className="reading-header container">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/writing/">The notebook</Link>
            <span aria-hidden="true">/</span>
            <span>{post.category}</span>
          </nav>
          <p className="article-kicker">
            {post.category} <span>·</span> {post.minutes} min read
          </p>
          <h1>{post.title}</h1>
          <p className="reading-deck">{post.description}</p>
          <div className="byline">
            <img src={portrait} alt="" width="42" height="42" />
            <div>
              <Link href="/about/">{profile.name}</Link>
              <span>
                <time dateTime={post.date}>{dateLabel(post.date)}</time>
                {post.updated > post.date && (
                  <> · Updated <time dateTime={post.updated}>{dateLabel(post.updated)}</time></>
                )}
              </span>
            </div>
            <div className="tag-list">
              {post.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          {post.cover && (
            <figure className="reading-cover">
              <CoverImage post={post} sizes="(max-width: 780px) 95vw, 1050px" priority />
              {post.coverCredit && (
                <figcaption className="photo-credit">
                  <PhotoCredit post={post} />
                </figcaption>
              )}
            </figure>
          )}
        </header>
        <div className="container reading-grid">
          <aside className="reading-sidebar" ref={sidebarRef}>
            <nav aria-label="On this page">
              <p className="eyebrow">On this page</p>
              <TableOfContents items={post.toc} />
            </nav>
            <Link className="reading-back" href="/writing/">
              ← Back to the notebook
            </Link>
          </aside>
          <div className="reading-content">
            <details className="mobile-toc">
              <summary>In this article</summary>
              <TableOfContents items={post.toc} />
            </details>
            <div className="prose article-prose" id="article-body" ref={articleRef}>
              {sections.map((section, index) => (
                <Fragment key={`${post.slug}-${index}`}>
                  {section.kind === 'diagram' ? (
                    <ArticleDiagram post={post} image={section} />
                  ) : (
                    <div
                      className="markdown-fragment"
                      style={{ display: 'contents' }}
                      dangerouslySetInnerHTML={{ __html: section.html }}
                    />
                  )}
                </Fragment>
              ))}
            </div>
            <div className="article-end">
              <span className="end-mark">EM</span>
              <h2>Thanks for reading.</h2>
              <p>Have a question or a different approach? I’d love to compare notes.</p>
              <Link className="text-link" href="/contact/">
                Start a conversation <Arrow />
              </Link>
            </div>
          </div>
        </div>
      </article>
      {related.length > 0 && (
        <section className="section container related-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Keep exploring</p>
              <h2>A few more pages.</h2>
            </div>
            <Link className="text-link" href="/writing/">
              All writing <Arrow />
            </Link>
          </div>
          <div className="blog-grid">
            {related.map((item) => (
              <BlogCard post={item} key={item.slug} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
