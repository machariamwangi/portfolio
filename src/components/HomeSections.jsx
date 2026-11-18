import Link from 'next/link';
import { BlogCard } from './Editorial';
import { Icon } from './Icons';
import { ProjectCard } from './Projects';
import { homePosts } from './editorial-model.mjs';
import styles from './HomeSections.module.css';

const destinations = [
  { icon: 'code', title: 'Building', href: '/building/', detail: 'Explore the school, banking, and monitoring systems I’ve worked on.' },
  { icon: 'pen', title: 'Writing', href: '/writing/', detail: 'Field notes on .NET, delivery pipelines, and Git.' },
  { icon: 'tools', title: 'Tools', href: '/tools/', detail: 'The languages, frameworks, and tools I use to build and test.' },
  { icon: 'career', title: 'Career milestones', href: '/my-career/', detail: 'Roles at Binary, Jambo Pay, Kamsware, and Stöbich, plus open source work with Andela.' },
  { icon: 'globe', title: 'On the web', href: '/www/', detail: 'Find my code on GitHub and my profile on LinkedIn.' },
  { icon: 'mail', title: 'Contact', href: '/contact/', detail: 'Get in touch about a project or a question.' },
];

export default function HomeSections({ profile, projects, posts }) {
  const { latest } = homePosts(posts);
  const selected = projects
    .filter((project) => project.featured)
    .sort((a, b) => (a.featuredOrder ?? Infinity) - (b.featuredOrder ?? Infinity));

  return (
    <div className={styles.sections}>
      <section className={styles.about} id="about" aria-labelledby="home-about-heading">
        <div className="container">
          <div className={styles.story}>
            <p className={styles.kicker}>About me</p>
            <h2 id="home-about-heading">I like learning how people work.</h2>
            <p>
              A school administrator needs to know who’s in class. A fire safety team needs to know
              which device raised an alert. I’ve built tools for both, alongside member banking
              portals, online shops, and an automotive parts catalogue.
            </p>
            <p>
              I enjoy following a problem through the whole product. That might mean simplifying a
              React or Angular screen, tracing a request through a C# service, tuning a SQL query,
              or testing a release before it reaches users.
            </p>
            <Link className={styles.inlineLink} href="/about/">More about me <Icon name="right" /></Link>
          </div>
        </div>
      </section>

      <section className={styles.explore} id="explore" aria-labelledby="home-explore-heading">
        <div className="container">
          <h2 id="home-explore-heading" className={styles.exploreHeading}>Explore</h2>
          <nav className={styles.destinations} aria-labelledby="home-explore-heading">
            {destinations.map(({ href, icon, title, detail }) => (
              <Link className={styles.destination} key={href} href={href}>
                <span className={styles.destinationIcon}><Icon name={icon} /></span>
                <span className={styles.destinationTitle}>{title}</span>
                <span className={styles.destinationDetail}>{detail}</span>
                <Icon name="right" className={styles.destinationArrow} />
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {selected.length > 0 && (
        <section className={styles.work} id="selected-work" aria-labelledby="home-work-heading">
          <div className="container">
            <div className={styles.headingRow}>
              <h2 id="home-work-heading">Selected work</h2>
              <Link className={styles.inlineLink} href="/building/">All {projects.length} projects <Icon name="right" /></Link>
            </div>
            <div className={styles.projectGrid}>
              {selected.map((project) => <ProjectCard key={project.slug} project={project} />)}
            </div>
          </div>
        </section>
      )}

      {latest.length > 0 && (
        <section className="notebook-section" id="notebook" aria-labelledby="home-notebook-heading">
          <div className="container">
            <div className={styles.headingRow}>
              <h2 id="home-notebook-heading">Engineering notebook</h2>
              <Link className={styles.inlineLink} href="/writing/">All {posts.length} articles <Icon name="right" /></Link>
            </div>
            <div className={styles.articleGrid}>
              {latest.map((post) => <BlogCard key={post.slug} post={post} />)}
            </div>
          </div>
        </section>
      )}

      <section className={styles.contact} aria-labelledby="home-contact-heading">
        <div className={`container ${styles.contactRow}`}>
          <h2 id="home-contact-heading">Have a project in mind?</h2>
          <a className={styles.email} href={`mailto:${profile.email}`}>{profile.email} <Icon name="arrow" /></a>
        </div>
      </section>
    </div>
  );
}
