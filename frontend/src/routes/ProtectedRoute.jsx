import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui';

/** Renders child routes only for an authenticated user with one of `roles`. */
export default function ProtectedRoute({ roles, loginPath = '/login' }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (!user) return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) {
    const home = user.role === 'admin' ? '/admin/dashboard' : user.role === 'influencer' ? '/influencer/dashboard' : '/account';
    return <Navigate to={home} replace />;
  }
  return <Outlet />;
}
