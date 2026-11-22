import { useSite } from '../../context/SiteContext';
import { useDocumentTitle } from '../../hooks';

// Replace with text reviewed by your legal counsel.
export default function Legal({ kind }) {
  const site = useSite();
  const terms = kind === 'terms';
  useDocumentTitle(terms ? 'Terms' : 'Privacy Policy');
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold">{terms ? 'Terms & Conditions' : 'Privacy Policy'}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-600">
        {terms ? (
          <>
            <p>By registering for a {site.siteName} workshop you agree to provide accurate information and to follow the code of conduct during sessions.</p>
            <p>Seats are confirmed only after successful payment. Refunds, where offered, are processed to the original payment method and may take 5–7 business days.</p>
            <p>Workshop content, recordings and materials are for personal use only and may not be redistributed.</p>
            <p>{site.siteName} may reschedule a workshop for reasons beyond its control; registered participants will be notified by email.</p>
          </>
        ) : (
          <>
            <p>We collect your name, email, phone number and city to manage your workshop registration, process payments and contact you about the workshop.</p>
            <p>When you arrive through a partner influencer's link we store a first-party cookie to credit that partner for your registration. Partners see only your name and registration status — never your full contact details or payment information.</p>
            <p>Payments are processed by Razorpay; we never see or store your card details.</p>
            <p>You can request access to or deletion of your data by writing to {site.supportEmail || 'our support team'}.</p>
          </>
        )}
      </div>
    </article>
  );
}
