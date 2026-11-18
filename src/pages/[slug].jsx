import Layout from '../components/Layout';
import { ProfilePage } from '../components/ProfilePages';
import { getPortfolio, pageMetadata, profileSections } from '../lib/site-data.mjs';

export function getStaticPaths() {
  return { paths: Object.keys(profileSections).map((slug) => ({ params: { slug } })), fallback: false };
}

export async function getStaticProps({ params: { slug } }) {
  if (!Object.hasOwn(profileSections, slug)) return { notFound: true };
  const { profile, pages } = await getPortfolio();
  return { props: { profile, slug, meta: pageMetadata(pages, `/${slug}/`) } };
}

export default function Profile({ profile, slug, meta }) {
  return (
    <Layout profile={profile} {...meta}>
      <ProfilePage slug={slug} profile={profile} />
    </Layout>
  );
}
