import { useParams } from 'react-router-dom';
import WorkshopLanding from '../../components/landing/WorkshopLanding';
import { ErrorState } from '../../components/ui';
import { useDocumentTitle, useFetch } from '../../hooks';

export default function WorkshopDetail() {
  const { slug } = useParams();
  const { data, loading, error } = useFetch(`/workshops/${slug}`);
  useDocumentTitle(data?.title);
  if (error) {
    return (
      <div className="pt-24">
        <ErrorState message={error} />
      </div>
    );
  }
  const open = data && data.status === 'published';
  return <WorkshopLanding workshop={data} workshops={open ? [data] : []} loading={loading} />;
}
