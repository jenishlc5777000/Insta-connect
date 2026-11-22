import { useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, ShieldCheck, FlaskConical } from 'lucide-react';
import { Button } from '../ui';
import { post, errorMessage } from '../../services/api';
import { formatINR } from '../../utils/format';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`);
    const script = existing || document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    if (!existing) document.body.appendChild(script);
  });
}

/**
 * Creates a server-side order and opens Razorpay Checkout. Success is only shown after the
 * backend verifies the signature (the webhook confirms it independently).
 */
export default function PaymentPanel({ leadId, accessToken, amount, workshopTitle, onPaid }) {
  const [busy, setBusy] = useState(false);
  const [mockOrder, setMockOrder] = useState(null);

  const pay = async () => {
    setBusy(true);
    try {
      const { data: order } = await post('/payments/order', { leadId, accessToken });
      if (order.gateway === 'mock') {
        setMockOrder(order);
        setBusy(false);
        return;
      }
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load the payment window. Check your connection and try again.');
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'JenCorps',
        description: order.workshopTitle,
        prefill: order.prefill,
        theme: { color: '#2F6BFF' },
        handler: async (response) => {
          try {
            await post('/payments/verify', response);
            toast.success('Payment successful! 🎉');
            onPaid?.();
          } catch (err) {
            toast.error(errorMessage(err, 'We could not verify your payment yet. If money was deducted, it will be confirmed automatically.'));
            onPaid?.();
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on('payment.failed', (resp) => {
        toast.error(resp?.error?.description || 'Payment failed. Please try again.');
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  const simulate = async (outcome) => {
    setBusy(true);
    try {
      await post('/payments/mock/complete', { orderId: mockOrder.orderId, outcome });
      toast.success('Payment successful (test mode)');
      setMockOrder(null);
      onPaid?.();
    } catch (err) {
      toast.error(errorMessage(err));
      onPaid?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brand/20 bg-brand-50/50 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-600">Amount payable</p>
          <p className="font-display text-3xl font-extrabold text-navy">{formatINR(amount)}</p>
          {workshopTitle && <p className="text-xs text-slate-500">{workshopTitle}</p>}
        </div>
        <ShieldCheck className="size-10 text-teal" />
      </div>
      {mockOrder ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <FlaskConical className="size-4" /> Test payment gateway (development)
          </p>
          <p className="mt-1 text-xs text-amber-700">Razorpay keys are not configured, so payments are simulated. This never appears in production.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => simulate('success')} loading={busy}>
              Simulate success
            </Button>
            <Button size="sm" variant="secondary" onClick={() => simulate('failure')} disabled={busy}>
              Simulate failure
            </Button>
          </div>
        </div>
      ) : (
        <Button className="mt-4 w-full py-3 text-base" onClick={pay} loading={busy} icon={CreditCard}>
          Pay {formatINR(amount)} securely
        </Button>
      )}
      <p className="mt-3 text-center text-xs text-slate-500">UPI, cards, net banking & wallets via Razorpay. Your seat is confirmed instantly after payment.</p>
    </div>
  );
}
