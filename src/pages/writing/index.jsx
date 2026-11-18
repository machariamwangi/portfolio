import Layout from '../../components/Layout';
import { WritingPage } from '../../components/Editorial';
import { getPortfolio, pageMetadata } from '../../lib/site-data.mjs';

export async function getStaticProps() {
  const { profile, summaries, pages } = await getPortfolio();
  return { props: { profile, posts: summaries, meta: pageMetadata(pages, '/writing/') } };
}

export default function Writing({ profile, posts, meta }) {
  return (
    <Layout profile={profile} {...meta}>
      <WritingPage posts={posts} />
    </Layout>
  );
}
