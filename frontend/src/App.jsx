import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  LayoutDashboard, Users, Link2, Wallet, CalendarDays, FolderDown, UserCircle,
  GraduationCap, CreditCard, BadgePercent, Banknote, BarChart3, Settings, Megaphone, Instagram,
} from 'lucide-react';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import { Spinner } from './components/ui';

// Public
const Landing = lazy(() => import('./pages/public/Landing'));
const Workshops = lazy(() => import('./pages/public/Workshops'));
const WorkshopDetail = lazy(() => import('./pages/public/WorkshopDetail'));
const Register = lazy(() => import('./pages/public/Register'));
const RegistrationStatus = lazy(() => import('./pages/public/RegistrationStatus'));
const Login = lazy(() => import('./pages/public/Login'));
const RegisterAccount = lazy(() => import('./pages/public/RegisterAccount'));
const ForgotPassword = lazy(() => import('./pages/public/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/public/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/public/VerifyEmail'));
const Account = lazy(() => import('./pages/public/Account'));
const PolicyPage = lazy(() => import('./pages/public/Policies'));
const PoliciesIndex = lazy(() => import('./pages/public/Policies').then((m) => ({ default: m.PoliciesIndex })));
const NotFound = lazy(() => import('./pages/public/NotFound'));
const BecomeInfluencer = lazy(() => import('./pages/public/BecomeInfluencer'));
const About = lazy(() => import('./pages/public/About'));

// Influencer
const InfDashboard = lazy(() => import('./pages/influencer/Dashboard'));
const InfLeads = lazy(() => import('./pages/influencer/Leads'));
const InfLinks = lazy(() => import('./pages/influencer/ReferralLinks'));
const InfEarnings = lazy(() => import('./pages/influencer/Earnings'));
const InfWorkshops = lazy(() => import('./pages/influencer/Workshops'));
const InfResources = lazy(() => import('./pages/influencer/Resources'));
const InfProfile = lazy(() => import('./pages/influencer/Profile'));

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminInfluencers = lazy(() => import('./pages/admin/Influencers'));
const AdminInfluencerDetail = lazy(() => import('./pages/admin/InfluencerDetail'));
const AdminWorkshops = lazy(() => import('./pages/admin/Workshops'));
const AdminWorkshopForm = lazy(() => import('./pages/admin/WorkshopForm'));
const AdminLeads = lazy(() => import('./pages/admin/Leads'));
const AdminPayments = lazy(() => import('./pages/admin/Payments'));
const AdminCommissions = lazy(() => import('./pages/admin/Commissions'));
const AdminPayouts = lazy(() => import('./pages/admin/Payouts'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
const AdminResources = lazy(() => import('./pages/admin/Resources'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminApplications = lazy(() => import('./pages/admin/Applications'));

const influencerNav = [
  { to: '/influencer/dashboard', label: 'Overview', short: 'Home', icon: LayoutDashboard, mobile: true },
  { to: '/influencer/leads', label: 'My Leads', short: 'Leads', icon: Users, mobile: true },
  { to: '/influencer/referral-links', label: 'Referral Links', short: 'Links', icon: Link2, mobile: true },
  { to: '/influencer/earnings', label: 'My Earnings', short: 'Earnings', icon: Wallet, mobile: true },
  { to: '/influencer/workshops', label: 'Workshop Details', icon: CalendarDays },
  { to: '/influencer/resources', label: 'Marketing Resources', icon: FolderDown },
  { to: '/influencer/profile', label: 'Profile', short: 'Profile', icon: UserCircle, mobile: true },
];

const adminNav = [
  { to: '/admin/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, mobile: true },
  { to: '/admin/influencers', label: 'Influencers', icon: Users, mobile: true },
  { to: '/admin/applications', label: 'Applications', icon: Instagram },
  { to: '/admin/workshops', label: 'Workshops', icon: GraduationCap },
  { to: '/admin/leads', label: 'Leads', icon: Megaphone, mobile: true },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard, mobile: true },
  { to: '/admin/commissions', label: 'Commissions', icon: BadgePercent, mobile: true },
  { to: '/admin/payouts', label: 'Payouts', icon: Banknote },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/resources', label: 'Marketing Resources', icon: FolderDown },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const Fallback = () => (
  <div className="grid min-h-[60vh] place-items-center">
    <Spinner className="size-8" />
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Landing />} />
          <Route path="workshops" element={<Workshops />} />
          <Route path="workshops/:slug" element={<WorkshopDetail />} />
          <Route path="register/:workshopSlug" element={<Register />} />
          <Route path="registration/:id" element={<RegistrationStatus />} />
          <Route path="login" element={<Login portal="customer" />} />
          <Route path="register-account" element={<RegisterAccount />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route path="policies" element={<PoliciesIndex />} />
          <Route path="policies/:slug" element={<PolicyPage />} />
          <Route path="terms" element={<Navigate to="/policies/terms-and-conditions" replace />} />
          <Route path="privacy" element={<Navigate to="/policies/privacy-policy" replace />} />
          <Route path="refund-policy" element={<Navigate to="/policies/refund-policy" replace />} />
          <Route path="become-influencer" element={<BecomeInfluencer />} />
          <Route path="about" element={<About />} />
          <Route path="join" element={<Navigate to="/become-influencer" replace />} />
          <Route path="influencer/login" element={<Login portal="influencer" />} />
          <Route path="admin/login" element={<Login portal="admin" />} />
          <Route element={<ProtectedRoute roles={['customer', 'admin']} loginPath="/login" />}>
            <Route path="account" element={<Account />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route element={<ProtectedRoute roles={['influencer']} loginPath="/influencer/login" />}>
          <Route path="influencer" element={<DashboardLayout nav={influencerNav} title="Influencer Hub" homePath="/influencer/dashboard" loginPath="/influencer/login" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<InfDashboard />} />
            <Route path="leads" element={<InfLeads />} />
            <Route path="referral-links" element={<InfLinks />} />
            <Route path="earnings" element={<InfEarnings />} />
            <Route path="workshops" element={<InfWorkshops />} />
            <Route path="resources" element={<InfResources />} />
            <Route path="profile" element={<InfProfile />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['admin']} loginPath="/admin/login" />}>
          <Route path="admin" element={<DashboardLayout nav={adminNav} title="Admin Console" homePath="/admin/dashboard" loginPath="/admin/login" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="influencers" element={<AdminInfluencers />} />
            <Route path="influencers/:id" element={<AdminInfluencerDetail />} />
            <Route path="workshops" element={<AdminWorkshops />} />
            <Route path="workshops/new" element={<AdminWorkshopForm />} />
            <Route path="workshops/:id/edit" element={<AdminWorkshopForm />} />
            <Route path="leads" element={<AdminLeads />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="commissions" element={<AdminCommissions />} />
            <Route path="payouts" element={<AdminPayouts />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="resources" element={<AdminResources />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="applications" element={<AdminApplications />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
