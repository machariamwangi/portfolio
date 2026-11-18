import { useState } from 'react';
import Link from 'next/link';
import { Icon } from './Icons';

function ProjectVisual({ project, eager = false }) {
  if (project.image) {
    const fallbackAlt = `${project.title} ${
      project.slug === 'lehigh-erp' ? 'academic years interface' : 'website preview'
    }`;
    return (
      <img
        src={project.image}
        alt={project.imageAlt || fallbackAlt}
        loading={eager ? 'eager' : 'lazy'}
        width="1020"
        height="594"
      />
    );
  }

  return (
    <div className="project-placeholder" data-category={project.category.toLowerCase()}>
      <span className="project-monogram">
        {project.title
          .split(' ')
          .map((word) => word[0])
          .slice(0, 3)
          .join('')}
      </span>
      <span className="project-caption">
        {project.category} / {project.environment || project.organization}
      </span>
    </div>
  );
}

export function ProjectCard({ project }) {
  const href = `/building/${project.slug}/`;
  return (
    <article
      className="project-card"
      data-category={project.category}
      data-search={`${project.title} ${project.category} ${project.description}`.toLocaleLowerCase()}
    >
      <Link className="project-image" href={href} aria-label={`Explore ${project.title}`}>
        <ProjectVisual project={project} />
      </Link>
      <div className="project-body">
        <div className="project-meta">
          <span className="tag">{project.category}</span>
          <span className="status">{project.environment || project.organization}</span>
        </div>
        <h3>
          <Link href={href}>{project.title}</Link>
        </h3>
        <p>{project.description}</p>
        <div className="project-links">
          <Link className="text-link" href={href}>
            Explore project <Icon name="right" />
          </Link>
          {project.url && (
            <a
              className="icon-button"
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit ${project.title} website`}
            >
              <Icon name="arrow" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function BuildingPage({ projects }) {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const categories = ['All', ...new Set(projects.map((project) => project.category))];
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visibleProjects = projects.filter((project) => {
    const matchesCategory = category === 'All' || project.category === category;
    const haystack = `${project.title} ${project.category} ${project.description}`.toLocaleLowerCase();
    return matchesCategory && terms.every((term) => haystack.includes(term));
  });

  return (
    <>
      <header className="page-hero container">
        <p className="eyebrow">Projects &amp; products</p>
        <h1>Things I’ve helped build.</h1>
        <p>
          A collection of websites, platforms, and applications — from storefronts to the systems behind the
          scenes.
        </p>
      </header>
      <section className="section container" aria-label="Projects">
        <div className="project-toolbar">
          <div className="filters" role="group" aria-label="Filter projects by category">
            {categories.map((value) => (
              <button
                key={value}
                type="button"
                className={`filter-chip${category === value ? ' active' : ''}`}
                data-filter={value}
                aria-pressed={category === value}
                aria-controls="project-results"
                onClick={() => setCategory(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <label className="screen-reader-only" htmlFor="project-search">
            Search projects
          </label>
          <input
            className="search-input"
            type="search"
            id="project-search"
            placeholder="Search projects…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-controls="project-results"
          />
        </div>
        <p id="project-count" className="eyebrow" role="status" aria-live="polite" aria-atomic="true">
          {visibleProjects.length} {visibleProjects.length === 1 ? 'project' : 'projects'}
        </p>
        <div className="project-grid" id="project-results">
          {visibleProjects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
        {visibleProjects.length === 0 && (
          <div className="empty-state" id="project-empty">
            <h2>No projects found.</h2>
            <p>Try another category or search term.</p>
          </div>
        )}
      </section>
    </>
  );
}

export function ProjectPage({ project }) {
  return (
    <div className="container article-layout">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/building/">Building</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{project.title}</span>
      </nav>
      <header className="article-header">
        <p className="eyebrow">
          {project.category} · {project.environment || project.organization}
        </p>
        <h1>{project.title}</h1>
        <p>{project.description}</p>
        <div className="button-row">
          {project.url && (
            <a className="button primary" href={project.url} target="_blank" rel="noopener noreferrer">
              Visit project <Icon name="arrow" />
            </a>
          )}
          <Link className="button secondary" href="/contact/">
            Let’s talk about your project
          </Link>
        </div>
      </header>
      <div className={`project-detail-hero${project.showFullScreenshot ? ' full-screenshot' : ''}`}>
        <ProjectVisual project={project} eager />
      </div>
      <div className="project-facts">
        <div>
          <h2>Project</h2>
          <p>{project.title}</p>
        </div>
        <div>
          <h2>Focus</h2>
          <p>{project.category}</p>
        </div>
        <div>
          <h2>{project.environment ? 'Environment' : 'Organization'}</h2>
          <p>{project.environment || project.organization}</p>
        </div>
      </div>
      <div className="article-body prose">
        {project.contribution && (
          <>
            <h2>My contribution</h2>
            <p>{project.contribution}</p>
          </>
        )}
        {project.gallery?.length > 0 && (
          <section className="project-gallery" aria-labelledby="project-gallery-heading">
            <h2 id="project-gallery-heading">{project.galleryTitle || 'Project screenshots'}</h2>
            {project.gallery.map((view) => (
              <figure key={view.image}>
                <img src={view.image} alt={view.alt} width={view.width} height={view.height} loading="lazy" />
                <figcaption>
                  <span>{view.caption}</span>
                  <a href={view.image} aria-label={`View ${view.caption.toLowerCase()} at full size`}>
                    View full size
                  </a>
                </figcaption>
              </figure>
            ))}
          </section>
        )}
        {project.url && (
          <>
            <h2>Explore the project</h2>
            <p>
              {project.description} Use the project link to visit the{' '}
              {project.environment && project.environment !== 'Live' ? `${project.environment.toLowerCase()} environment` : 'website'}.
            </p>
          </>
        )}
        {project.url && ['Development', 'Staging'].includes(project.environment) && (
          <p className="notice">
            This link opens a development or staging environment. Availability may change, and some screens
            may require sign-in.
          </p>
        )}
        <p>
          Want to discuss this project or something similar? <Link href="/contact/">Get in touch.</Link>
        </p>
      </div>
      <Link className="text-link article-back" href="/building/">
        ← Back to all projects
      </Link>
    </div>
  );
}
