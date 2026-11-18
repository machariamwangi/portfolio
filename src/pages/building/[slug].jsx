import Layout from '../../components/Layout';
import { ProjectPage } from '../../components/Projects';
import { getPortfolio } from '../../lib/site-data.mjs';

export async function getStaticPaths() {
  const { projects } = await getPortfolio();
  return { paths: projects.map(({ slug }) => ({ params: { slug } })), fallback: false };
}

export async function getStaticProps({ params }) {
  const { profile, projects } = await getPortfolio();
  const project = projects.find((item) => item.slug === params.slug);
  return project ? { props: { profile, project } } : { notFound: true };
}

export default function Project({ profile, project }) {
  return (
    <Layout
      profile={profile}
      title={project.title}
      description={project.description}
      current={`/building/${project.slug}/`}
    >
      <ProjectPage project={project} />
    </Layout>
  );
}
