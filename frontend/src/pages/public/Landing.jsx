import WorkshopLanding from '../../components/landing/WorkshopLanding';
import { useDocumentTitle, useFetch } from '../../hooks';

/** jencorps.com and every influencer subdomain render this page; attribution is handled globally. */
export default function Landing() {
  const featured = useFetch('/workshops/featured');
  const list = useFetch('/workshops', { limit: 20 });
  useDocumentTitle(featured.data?.title || 'AI Video Creation Workshop');
  return <WorkshopLanding workshop={featured.data} workshops={list.data || []} loading={featured.loading} />;
}
