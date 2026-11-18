import Link from 'next/link';
import { Icon } from './Icons';

const profileNavigation = [
  ['About me', 'about'],
  ['Career milestones', 'my-career'],
  ['My toolkit', 'tools'],
  ['On the web', 'www'],
  ['Contact', 'contact'],
];

function PageIntro({ eyebrow, title, description }) {
  return (
    <header className="page-hero container">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function ProfileSidebar({ current, children }) {
  return (
    <div className="content-layout container">
      <aside className="page-sidebar">
        <nav aria-label="About section">
          {profileNavigation.map(([label, slug]) => (
            <Link key={slug} href={`/${slug}/`} aria-current={current === slug ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="article-content">{children}</div>
    </div>
  );
}

function CvLink({ profile }) {
  return (
    <a className="button secondary" href={profile.cv} target="_blank" rel="noopener noreferrer">
      View my CV <Icon name="arrow" />
    </a>
  );
}

function AboutPage({ profile }) {
  return (
    <>
      <PageIntro
        eyebrow="Behind the work"
        title={`Hello, I’m ${profile.name.split(' ')[0]}.`}
        description="Software engineer. Curious builder. Always learning."
      />
      <ProfileSidebar current="about">
        <div className="prose">
          <img
            className="about-portrait"
            src="/images/elijah-macharia-profile.jpg"
            alt={profile.name}
            width="400"
            height="400"
          />
          {profile.biography.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <h2>Across the stack</h2>
          <p>
            I work with C# and .NET on the backend, React and Angular on the frontend, and the tools that
            bring them together. I care about making products understandable, useful, and dependable.
          </p>
          <h2>Let’s make something useful</h2>
          <p>If you have a project in mind or want to compare notes, I’d like to hear from you.</p>
          <div className="button-row">
            <Link className="button primary" href="/contact/">
              Get in touch <Icon name="right" />
            </Link>
            <CvLink profile={profile} />
          </div>
        </div>
      </ProfileSidebar>
    </>
  );
}

function ToolsPage({ profile }) {
  return (
    <>
      <PageIntro
        eyebrow="My toolkit"
        title="Tools of the trade."
        description="The languages, frameworks, and tools I work with."
      />
      <ProfileSidebar current="tools">
        <div className="skills-grid">
          {profile.skills.map((group) => (
            <section className="skill-group" key={group.category}>
              <h2>{group.category}</h2>
              <div className="tag-list">
                {group.items.map((item) => (
                  <span className="tag" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="prose">
          <h2>Tools follow the problem.</h2>
          <p>
            Different products need different approaches. My work spans web interfaces, APIs, integrations,
            databases, and cloud deployments.
          </p>
          <Link className="text-link" href="/building/">
            See the work <Icon name="right" />
          </Link>
        </div>
      </ProfileSidebar>
    </>
  );
}

function CareerPage({ profile }) {
  return (
    <>
      <PageIntro
        eyebrow="Experience"
        title="Career milestones."
        description="A selection of roles and teams that have shaped how I build."
      />
      <ProfileSidebar current="my-career">
        <div className="timeline">
          {profile.experience.map((role) => (
            <article className="timeline-item" key={`${role.company}-${role.role}-${role.period}`}>
              <p className="timeline-date">{role.period}{role.location && ` · ${role.location}`}</p>
              <h2>{role.role}</h2>
              <h3>{role.company}</h3>
              {role.description && <p>{role.description}</p>}
              {role.project && (
                <Link className="text-link" href={`/building/${role.project.slug}/`}>
                  Explore the {role.project.title} <Icon name="right" />
                </Link>
              )}
            </article>
          ))}
        </div>
        <div className="button-row">
          <CvLink profile={profile} />
        </div>
      </ProfileSidebar>
    </>
  );
}

function ContactPage({ profile }) {
  const phoneLabel = profile.phone.replace(/^(\+254)(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4');
  return (
    <>
      <PageIntro
        eyebrow="Start a conversation"
        title="Let’s build something useful."
        description="Have a project in mind, a question, or an idea to explore? I’d love to hear from you."
      />
      <section className="section container" aria-label="Contact options">
        <div className="contact-grid">
          <a className="contact-card" href={`mailto:${profile.email}`}>
            <Icon name="mail" />
            <h2>Email me</h2>
            <p>{profile.email}</p>
            <span className="text-link">
              Say hello <Icon name="arrow" />
            </span>
          </a>
          <a className="contact-card" href={profile.linkedin} target="_blank" rel="noopener noreferrer">
            <Icon name="linkedin" />
            <h2>Connect on LinkedIn</h2>
            <p>Work, ideas, and conversations.</p>
            <span className="text-link">
              Find me on LinkedIn <Icon name="arrow" />
            </span>
          </a>
          <a className="contact-card" href={profile.github} target="_blank" rel="noopener noreferrer">
            <Icon name="github" />
            <h2>Explore my GitHub</h2>
            <p>A closer look at my code.</p>
            <span className="text-link">
              See my repositories <Icon name="arrow" />
            </span>
          </a>
        </div>
        <div className="prose">
          <p>
            Based in {profile.location}. You can also reach me on{' '}
            <a href={`tel:${profile.phone}`}>{phoneLabel}</a>.
          </p>
        </div>
      </section>
    </>
  );
}

function WebPage({ profile }) {
  const githubHandle = profile.github.replace(/\/+$/, '').split('/').pop();
  return (
    <>
      <PageIntro
        eyebrow="Elsewhere"
        title="Around the web."
        description="Find my code, connect with me, or send a note."
      />
      <ProfileSidebar current="www">
        <div className="contact-grid">
          <a className="contact-card" href={profile.github} target="_blank" rel="noopener noreferrer">
            <Icon name="github" />
            <h2>GitHub</h2>
            <p>@{githubHandle}</p>
          </a>
          <a className="contact-card" href={profile.linkedin} target="_blank" rel="noopener noreferrer">
            <Icon name="linkedin" />
            <h2>LinkedIn</h2>
            <p>{profile.name}</p>
          </a>
          <a className="contact-card" href={`mailto:${profile.email}`}>
            <Icon name="mail" />
            <h2>Email</h2>
            <p>{profile.email}</p>
          </a>
        </div>
      </ProfileSidebar>
    </>
  );
}

export function ProfilePage({ slug, profile }) {
  const page = typeof slug === 'string' ? slug.replace(/^\/+|\/+$/g, '') : '';
  switch (page) {
    case 'about':
      return <AboutPage profile={profile} />;
    case 'tools':
      return <ToolsPage profile={profile} />;
    case 'my-career':
      return <CareerPage profile={profile} />;
    case 'contact':
      return <ContactPage profile={profile} />;
    case 'www':
      return <WebPage profile={profile} />;
    default:
      return <NotFoundPage />;
  }
}

export function NotFoundPage() {
  return (
    <>
      <PageIntro
        eyebrow="404"
        title="A little off the path."
        description="The page may have moved, or the link may be incomplete."
      />
      <section className="section container">
        <Link className="button primary" href="/">
          Back home <Icon name="right" />
        </Link>
      </section>
    </>
  );
}
