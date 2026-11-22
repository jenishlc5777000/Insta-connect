import Logo from '../../components/Logo';

export default function AuthCard({ title, subtitle, children, footer, accent = 'brand' }) {
  const bar = { brand: 'from-brand to-purple', teal: 'from-teal to-brand', navy: 'from-navy to-brand' }[accent];
  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center bg-gradient-to-b from-brand-50/60 to-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card overflow-hidden">
          <div className={`h-1.5 bg-gradient-to-r ${bar}`} />
          <div className="p-6 sm:p-8">
            <Logo className="mb-6" />
            <h1 className="text-2xl font-extrabold">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </div>
  );
}
