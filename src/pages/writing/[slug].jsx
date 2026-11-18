import Layout from '../../components/Layout';
import { ArticlePage } from '../../components/Editorial';
import { getPortfolio } from '../../lib/site-data.mjs';

export async function getStaticPaths() {
  const { articles } = await getPortfolio();
  return { paths: articles.map(({ slug }) => ({ params: { slug } })), fallback: false };
}

export async function getStaticProps({ params }) {
  const { profile, articles, summaries } = await getPortfolio();
  const post = articles.find((item) => item.slug === params.slug);
  if (!post) return { notFound: true };
  const related = summaries
    .filter((item) => item.slug !== post.slug && item.category === post.category)
    .slice(0, 3);
  return { props: { profile, post, related } };
}

export default function Article({ profile, post, related }) {
  return (
    <Layout
      profile={profile}
      title={post.title}
      description={post.description}
      current={post.url}
      cover={post.cover}
      article
    >
      <ArticlePage profile={profile} post={post} posts={related} />
    </Layout>
  );
}
