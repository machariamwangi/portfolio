import Layout from '../../components/Layout';
import { BuildingPage } from '../../components/Projects';
import { getPortfolio, pageMetadata } from '../../lib/site-data.mjs';

export async function getStaticProps() {
  const { profile, projects, pages } = await getPortfolio();
  return { props: { profile, projects, meta: pageMetadata(pages, '/building/') } };
}

export default function Building({ profile, projects, meta }) {
  return (
    <Layout profile={profile} {...meta}>
      <BuildingPage projects={projects} />
    </Layout>
  );
}
