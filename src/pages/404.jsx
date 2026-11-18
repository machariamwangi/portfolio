import Layout from '../components/Layout';
import { NotFoundPage } from '../components/ProfilePages';
import { getPortfolio } from '../lib/site-data.mjs';

export async function getStaticProps() {
  const { profile } = await getPortfolio();
  return { props: { profile } };
}

export default function NotFound({ profile }) {
  return (
    <Layout
      profile={profile}
      current="/404.html"
      title="Page not found"
      description="This page could not be found."
    >
      <NotFoundPage />
    </Layout>
  );
}
