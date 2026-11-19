import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icons';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahmwangi.net').replace(
  /\/$/,
  ''
);
const NAVIGATION = [
  ['Home', '/'],
  ['About', '/about/'],
  ['Building', '/building/'],
  ['Writing', '/writing/'],
  ['Tools', '/tools/'],
  ['Contact', '/contact/'],
];
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let cachedSearchEntries;

function isCurrent(current, href) {
  return current === href || (href !== '/' && current.startsWith(href));
}

function NavigationLinks({ current, onNavigate }) {
  return NAVIGATION.map(([label, href]) => (
    <Link
      key={href}
      href={href}
      aria-current={isCurrent(current, href) ? 'page' : undefined}
      onClick={onNavigate}
    >
      {label}
    </Link>
  ));
}

function searchEntries(value) {
  if (!Array.isArray(value)) throw new Error('Invalid search index');
  return value
    .filter(
      (entry) =>
        entry &&
        typeof entry.title === 'string' &&
        typeof entry.url === 'string' &&
        /^\/(?!\/)[^\\\u0000-\u001f]*$/.test(entry.url)
    )
    .map((entry) => ({
      title: entry.title,
      url: entry.url,
      description: typeof entry.description === 'string' ? entry.description : '',
      type: typeof entry.type === 'string' ? entry.type : '',
    }));
}

export default function Layout({
  children,
  profile,
  current = '/',
  title = '',
  description,
  cover,
  article = false,
  featuredArticle,
}) {
  const router = useRouter();
  const brandRef = useRef(null);
  const navRef = useRef(null);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const activeDialogRef = useRef(null);
  const openerRef = useRef(null);
  const mountedRef = useRef(false);
  const searchRequestRef = useRef(null);
  const searchAbortRef = useRef(null);
  const pathname = current.split(/[?#]/)[0] || '/';
  const home = pathname === '/';
  const defaultTheme = home ? 'dark' : 'light';
  const [activeDialog, setActiveDialog] = useState(null);
  // The first client render matches SSR. The head script sets the saved theme before paint.
  const [theme, setTheme] = useState(defaultTheme);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle');
  const fullTitle = title ? `${title} · ${profile.name}` : `${profile.name} — ${profile.role}`;
  const pageDescription = description || profile.intro;
  const canonical = `${SITE_URL}${pathname}`;
  const imageUrl = new URL(cover || '/images/elijah-macharia-profile.jpg', `${SITE_URL}/`).href;

  const applyTheme = useCallback((preference) => {
    const nextTheme = preference === 'light' || preference === 'dark' ? preference : defaultTheme;
    const root = document.documentElement;
    root.dataset.page = home ? 'home' : 'interior';
    root.dataset.theme = nextTheme;
    const color = getComputedStyle(root).getPropertyValue('--wash').trim();
    if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
    setTheme(nextTheme);
  }, [home, defaultTheme]);

  function toggleTheme() {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('em-theme', nextTheme);
      delete root.dataset.sessionTheme;
    } catch {
      root.dataset.sessionTheme = nextTheme;
    }
    applyTheme(nextTheme);
  }

  function dismissFeature() {
    document.documentElement.dataset.featureDismissed = 'true';
    try {
      sessionStorage.setItem('em-feature-dismissed', '1');
    } catch {
      /* The strip stays dismissed while navigating this document. */
    }
    brandRef.current?.focus({ preventScroll: true });
  }

  // A Pages Router navigation replaces the page without running the document's head script again.
  useLayoutEffect(() => {
    function syncTheme() {
      let preference = document.documentElement.dataset.sessionTheme;
      try {
        preference = preference || localStorage.getItem('em-theme');
      } catch {
        /* Use the current session when storage is unavailable. */
      }
      applyTheme(preference);
    }
    syncTheme();
    function onStorage(event) {
      if (event.key === 'em-theme' || event.key === null) {
        delete document.documentElement.dataset.sessionTheme;
        syncTheme();
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [applyTheme]);

  const closeDialog = useCallback((restoreFocus = true) => {
    const dialog = activeDialogRef.current;
    const opener = openerRef.current;
    activeDialogRef.current = null;
    openerRef.current = null;
    if (dialog?.open) dialog.close();
    document.documentElement.classList.remove('dialog-open');
    setActiveDialog(null);
    if (restoreFocus && opener?.isConnected && typeof opener.focus === 'function') {
      opener.focus({ preventScroll: true });
    }
  }, []);

  const loadSearch = useCallback(() => {
    if (cachedSearchEntries) {
      setEntries(cachedSearchEntries);
      setSearchStatus('ready');
      return;
    }
    if (searchRequestRef.current) return;
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearchStatus('loading');
    searchRequestRef.current = fetch('/search.json', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Search index unavailable');
        return response.json();
      })
      .then(searchEntries)
      .then((data) => {
        cachedSearchEntries = data;
        if (mountedRef.current) {
          setEntries(data);
          setSearchStatus('ready');
        }
      })
      .catch((error) => {
        if (mountedRef.current && error.name !== 'AbortError') setSearchStatus('error');
      })
      .finally(() => {
        searchRequestRef.current = null;
        searchAbortRef.current = null;
      });
  }, []);

  const openDialog = useCallback(
    (kind, trigger) => {
      const dialog = kind === 'search' ? searchRef.current : navRef.current;
      if (!dialog) return;
      if (activeDialogRef.current === dialog && dialog.open) {
        if (kind === 'search') searchInputRef.current?.focus();
        return;
      }
      // A keyboard shortcut can replace an open menu; retain its original outside trigger.
      const opener = activeDialogRef.current ? openerRef.current : trigger || document.activeElement;
      closeDialog(false);
      openerRef.current = opener;
      activeDialogRef.current = dialog;
      dialog.showModal();
      document.documentElement.classList.add('dialog-open');
      setActiveDialog(kind);
      if (kind === 'search') {
        searchInputRef.current?.focus();
        loadSearch();
      } else {
        dialog.querySelector('[data-dialog-close]')?.focus();
      }
    },
    [closeDialog, loadSearch]
  );

  useEffect(() => {
    mountedRef.current = true;
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openDialog('search');
      }
    };
    const onRouteChange = () => closeDialog(false);
    document.addEventListener('keydown', shortcut);
    router.events.on('routeChangeStart', onRouteChange);
    router.events.on('hashChangeStart', onRouteChange);
    return () => {
      mountedRef.current = false;
      searchAbortRef.current?.abort();
      document.removeEventListener('keydown', shortcut);
      router.events.off('routeChangeStart', onRouteChange);
      router.events.off('hashChangeStart', onRouteChange);
      const dialog = activeDialogRef.current;
      activeDialogRef.current = null;
      if (dialog?.open) dialog.close();
      document.documentElement.classList.remove('dialog-open');
    };
  }, [closeDialog, openDialog, router.events]);

  const matches = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter((entry) => {
      const haystack = `${entry.title} ${entry.description} ${entry.type}`.toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [entries, query]);

  function onNavigate(event) {
    if (
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      closeDialog(false);
    }
  }

  function onDialogClick(event) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      closeDialog();
    }
  }

  function onDialogKeyDown(event) {
    if (event.key !== 'Tab') return;
    const elements = [...event.currentTarget.querySelectorAll(FOCUSABLE)].filter(
      (element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true'
    );
    if (!elements.length) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }
    const first = elements[0];
    const last = elements[elements.length - 1];
    const focused = document.activeElement;
    if (event.shiftKey && (focused === first || !elements.includes(focused))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (focused === last || !elements.includes(focused))) {
      event.preventDefault();
      first.focus();
    }
  }

  const dialogEvents = {
    onClick: onDialogClick,
    onKeyDown: onDialogKeyDown,
    onCancel: (event) => {
      event.preventDefault();
      closeDialog();
    },
    onClose: (event) => {
      if (activeDialogRef.current === event.currentTarget && !event.currentTarget.open) closeDialog();
    },
  };
  const themeLabel = theme === 'dark' ? 'Use light mode' : 'Use dark mode';
  const searchButton = (
    <button
      type="button"
      className="icon-button search-toggle"
      data-search-open=""
      aria-label="Search this site"
      aria-keyshortcuts="Control+K Meta+K"
      title="Search (Ctrl+K or ⌘K)"
      aria-haspopup="dialog"
      aria-controls="search-dialog"
      aria-expanded={activeDialog === 'search'}
      onClick={(event) => openDialog('search', event.currentTarget)}
    >
      <Icon name="search" />
      {home && (
        <>
          <span aria-hidden="true">Search</span>
          <kbd aria-hidden="true">Ctrl K</kbd>
        </>
      )}
    </button>
  );

  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" key="viewport" />
        <meta name="description" content={pageDescription} key="description" />
        <link rel="canonical" href={canonical} key="canonical" />
        <meta property="og:title" content={fullTitle} key="og:title" />
        <meta property="og:description" content={pageDescription} key="og:description" />
        <meta property="og:type" content={article ? 'article' : 'website'} key="og:type" />
        <meta property="og:url" content={canonical} key="og:url" />
        <meta property="og:image" content={imageUrl} key="og:image" />
        <meta name="twitter:card" content="summary_large_image" key="twitter:card" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${profile.name} — Writing`}
          href="/feed.xml"
          key="feed"
        />
      </Head>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {home && featuredArticle && (
        <aside className="feature-strip" aria-label="Featured article">
          <div className="feature-strip-inner">
            <span className="feature-strip-label">Featured article</span>
            <Link className="feature-strip-link" href={featuredArticle.url}>
              <strong>{featuredArticle.title}</strong>
              <span className="feature-strip-cta" aria-hidden="true">
                Read article <Icon name="right" />
              </span>
            </Link>
          </div>
          <button
            type="button"
            className="feature-strip-dismiss"
            aria-label="Dismiss featured article"
            onClick={dismissFeature}
          >
            <Icon name="close" />
          </button>
        </aside>
      )}
      <header className="site-header">
        <div className="header-inner">
          <button
            type="button"
            className="icon-button menu-toggle"
            data-menu-open=""
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-controls="nav-dialog"
            aria-expanded={activeDialog === 'nav'}
            onClick={(event) => openDialog('nav', event.currentTarget)}
          >
            <Icon name="menu" />
          </button>
          <Link ref={brandRef} className="brand" href="/" aria-label={`${profile.name} home`}>
            <img className="brand-logo" src="/images/elijah-mwangi-horizontal.svg" width="208" height="38" alt="" />
          </Link>
          {home && searchButton}
          <nav className="desktop-nav" aria-label="Main navigation">
            <NavigationLinks current={pathname} />
          </nav>
          <div className="header-actions">
            {!home && searchButton}
            <button
              type="button"
              className="icon-button"
              data-theme-toggle=""
              aria-label={themeLabel}
              title={themeLabel}
              onClick={toggleTheme}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <a
              className="icon-button social-link"
              href={profile.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
              <Icon name="github" />
            </a>
            <a
              className="icon-button social-link"
              href={profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
            >
              <Icon name="linkedin" />
            </a>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="footer-inner container">
          <nav className="footer-links" aria-label="Footer navigation">
            <Link href="/contact/">Contact</Link>
            <Link href="/www/">On the web</Link>
            <Link href="/writing/">Writing</Link>
            <a href="/feed.xml">RSS feed</a>
          </nav>
          <div className="footer-socials">
            <a href={profile.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <Icon name="github" />
            </a>
            <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <Icon name="linkedin" />
            </a>
            <a href={`mailto:${profile.email}`} aria-label={`Email ${profile.name}`}>
              <Icon name="mail" />
            </a>
          </div>
          <div className="footer-meta">
            <span>
              © <span suppressHydrationWarning>{new Date().getFullYear()}</span> {profile.name}
            </span>
            <span>Built with curiosity. Based in Nairobi.</span>
          </div>
        </div>
      </footer>
      <dialog
        ref={navRef}
        className="nav-dialog"
        id="nav-dialog"
        aria-label="Site navigation"
        tabIndex={-1}
        {...dialogEvents}
      >
        <div className="dialog-header">
          <strong>Explore</strong>
          <button
            type="button"
            className="icon-button"
            data-dialog-close=""
            aria-label="Close menu"
            onClick={() => closeDialog()}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Mobile navigation">
          <NavigationLinks current={pathname} onNavigate={onNavigate} />
          <Link
            href="/my-career/"
            aria-current={isCurrent(pathname, '/my-career/') ? 'page' : undefined}
            onClick={onNavigate}
          >
            Career milestones
          </Link>
          <Link
            href="/www/"
            aria-current={isCurrent(pathname, '/www/') ? 'page' : undefined}
            onClick={onNavigate}
          >
            On the web
          </Link>
        </nav>
      </dialog>
      <dialog
        ref={searchRef}
        className="search-dialog"
        id="search-dialog"
        aria-labelledby="search-title"
        tabIndex={-1}
        {...dialogEvents}
      >
        <div className="dialog-header">
          <h2 id="search-title">Search the site</h2>
          <button
            type="button"
            className="icon-button"
            data-dialog-close=""
            aria-label="Close search"
            onClick={() => closeDialog()}
          >
            <Icon name="close" />
          </button>
        </div>
        <label className="screen-reader-only" htmlFor="site-search">
          Search projects, pages and writing
        </label>
        <input
          ref={searchInputRef}
          type="search"
          id="site-search"
          placeholder="Search projects, pages and writing…"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div
          id="search-results"
          className="search-results"
          aria-live="polite"
          aria-busy={searchStatus === 'loading'}
        >
          {searchStatus === 'idle' && <p role="status">Start typing to explore.</p>}
          {searchStatus === 'loading' && <p role="status">Loading search…</p>}
          {searchStatus === 'error' && (
            <p role="status">
              Search could not load. You can still browse using the menu. Close and reopen search to try
              again.
            </p>
          )}
          {searchStatus === 'ready' &&
            (matches.length ? (
              <>
                <p role="status">
                  {query.trim()
                    ? `${matches.length} ${matches.length === 1 ? 'result' : 'results'}${
                        matches.length > 20 ? ' · Showing the first 20' : ''
                      }`
                    : 'Explore the site, or type to search projects, pages and writing.'}
                </p>
                {matches.slice(0, 20).map((entry) => (
                  <Link key={entry.url} href={entry.url} onClick={onNavigate}>
                    <span className="result-title">{entry.title}</span>
                    {(entry.type || entry.description) && (
                      <span>{[entry.type, entry.description].filter(Boolean).join(' · ')}</span>
                    )}
                  </Link>
                ))}
              </>
            ) : (
              <p role="status">No results for “{query.trim()}”. Try a project name or a broader keyword.</p>
            ))}
        </div>
      </dialog>
    </>
  );
}
