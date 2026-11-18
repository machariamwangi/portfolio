import Link from 'next/link';
import HomeSections from './HomeSections';
import { Icon } from './Icons';
import styles from './HomePage.module.css';

export default function HomePage({ profile, projects, posts }) {
  const featuredProject = projects.find((project) => project.featuredOrder === 1);
  return (
    <div className={styles.shell}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.introduction}>
            <h1 id="home-title" className={styles.title}>
              <span className={styles.name}>{profile.name}</span>{' '}
              <span>{profile.role}</span>
            </h1>
            <p className={styles.intro}>{profile.intro}</p>
            <details className={styles.details}>
              <summary>Building what’s next, and helping people understand it.</summary>
              <div className={styles.detailsBody}>
                <p>
                  I’m a technical leader and full-stack engineer who turns ideas into reliable,
                  well-built products. I lead teams, steer products and programs from strategy to
                  launch, and build software that works across web, mobile and cloud. I also make
                  complex technology clear, so decision-makers can move with confidence.
                </p>
                <p><strong>What I do</strong></p>
                <ul>
                  <li>
                    <strong>Leadership:</strong> I build and guide teams that ship, in person or
                    distributed, and I keep people, priorities and delivery aligned.
                  </li>
                  <li>
                    <strong>Technical product and program management:</strong> I turn business goals
                    into roadmaps and measurable outcomes, and keep complex programs on track from
                    discovery to delivery.
                  </li>
                  <li>
                    <strong>Full-stack, cross-platform engineering:</strong> I design and build
                    secure, scalable, maintainable software for web, mobile and cloud, with clean
                    architecture, solid testing and systems built to last.
                  </li>
                  <li>
                    <strong>Technical communication:</strong> I translate complex systems, risks and
                    trade-offs into clear language for executives, clients and users.
                  </li>
                </ul>
              </div>
            </details>
            <nav className={styles.actions} aria-label="Homepage shortcuts">
              <Link className={styles.primary} href="/contact/">Get in touch</Link>
              <Link href="/about/">About me</Link>
              <Link href="/writing/">Engineering Notebook</Link>
              <a href={featuredProject ? '#selected-work' : '/building/'}>Selected work</a>
            </nav>
          </div>
          <figure className={styles.portrait}>
            <div className={styles.frame}>
              <img src="/images/elijah-macharia-profile.jpg" alt={profile.name} width="400" height="400" fetchPriority="high" />
            </div>
            <figcaption>
              <Icon name="globe" /><span>Based in {profile.location}</span>
            </figcaption>
          </figure>
        </div>
      </section>
      <HomeSections profile={profile} projects={projects} posts={posts} />
    </div>
  );
}
