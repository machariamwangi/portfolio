import Layout from '../components/Layout';
import HomePage from '../components/HomePage';
import { homePosts } from '../components/editorial-model.mjs';
import { getPortfolio, pageMetadata } from '../lib/site-data.mjs';

export async function getStaticProps() {
  const { profile, projects, summaries, pages } = await getPortfolio();
  return { props: { profile, projects, posts: summaries, meta: pageMetadata(pages, '/') } };
}

export default function Home({ profile, projects, posts, meta }) {
  const { featured } = homePosts(posts);
  return (
    <Layout profile={profile} featuredArticle={featured} {...meta}>
      <HomePage profile={profile} projects={projects} posts={posts} />
    </Layout>
  );
}
