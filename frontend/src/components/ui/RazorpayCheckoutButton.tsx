import { useState } from 'react';
import { razorpayApi } from '@/services/api';
import { Loader2, CreditCard, CheckCircle, XCircle } from 'lucide-react';

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID as string;

export type CheckoutState = 'idle' | 'creating' | 'open' | 'verifying' | 'success' | 'failed' | 'cancelled';

interface RazorpayCheckoutButtonProps {
  /** Amount in paise (e.g. 50000 = ₹500) */
  amount: number;
  currency?: string;
  receipt?: string;
  description?: string;
  /** Merchant name shown in the modal */
  name?: string;
  prefillName?: string;
  prefillEmail?: string;
  prefillContact?: string;
  /** Called when payment is verified successfully on the backend */
  onSuccess?: (paymentId: string) => void;
  /** Called when payment fails or user cancels */
  onError?: (reason: string) => void;
  label?: string;
  className?: string;
}

/**
 * Razorpay Standard Checkout button.
 *
 * Flow:
 *   1. Click → POST /api/v1/payments/razorpay/order (backend creates order)
 *   2. Modal opens with order_id
 *   3. User pays → Razorpay calls handler with payment_id + signature
 *   4. POST /api/v1/payments/razorpay/verify (backend verifies HMAC-SHA256)
 *   5. onSuccess(paymentId) called only if backend confirms verified=true
 *
 * KEY_SECRET never touches this file.
 * Only VITE_RAZORPAY_KEY_ID (public) is used here.
 */
export function RazorpayCheckoutButton({
  amount,
  currency = 'INR',
  receipt,
  description = 'Zeno payment',
  name = 'Zeno',
  prefillName,
  prefillEmail,
  prefillContact,
  onSuccess,
  onError,
  label = 'Pay with Razorpay',
  className,
}: RazorpayCheckoutButtonProps) {
  const [state, setState]                   = useState<CheckoutState>('idle');
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);
  const [successPaymentId, setSuccessPaymentId] = useState<string | null>(null);

  const isLoading = state === 'creating' || state === 'open' || state === 'verifying';

  const handleClick = async () => {
    if (isLoading) return;

    if (!RAZORPAY_KEY_ID) {
      const msg = 'VITE_RAZORPAY_KEY_ID is not set in frontend/.env';
      setErrorMsg(msg);
      setState('failed');
      onError?.(msg);
      return;
    }

    if (typeof window.Razorpay === 'undefined') {
      const msg = 'Razorpay SDK not loaded. Check your internet connection.';
      setErrorMsg(msg);
      setState('failed');
      onError?.(msg);
      return;
    }

    setErrorMsg(null);
    setState('creating');

    // ── Step 1: Create order on backend ──────────────────────────────────
    let order: Awaited<ReturnType<typeof razorpayApi.createOrder>>;
    try {
      order = await razorpayApi.createOrder({ amount, currency, receipt, description });
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to create payment order. Please try again.';
      setErrorMsg(msg);
      setState('failed');
      onError?.(msg);
      return;
    }

    setState('open');

    // ── Step 2: Open checkout modal ───────────────────────────────────────
    const rzp = new window.Razorpay({
      key:         RAZORPAY_KEY_ID,
      amount:      order.amount,
      currency:    order.currency,
      name,
      description,
      order_id:    order.orderId,
      prefill: {
        name:    prefillName,
        email:   prefillEmail,
        contact: prefillContact,
      },
      theme: { color: '#6366f1' },
      modal: {
        confirm_close: false,
        ondismiss: () => {
          setState(prev => {
            // Only treat as cancellation if payment never reached a terminal state.
            // 'success' and 'failed' are terminal — ondismiss fires on those too.
            if (prev === 'open') {
              onError?.('Payment cancelled by user.');
              return 'cancelled';
            }
            return prev;
          });
        },
      },
      handler: async (response: RazorpaySuccessResponse) => {
        // ── Step 3: Verify signature on backend ───────────────────────────
        setState('verifying');
        try {
          const verify = await razorpayApi.verifyPayment({
            razorpayOrderId:   response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });

          if (verify.verified) {
            setState('success');
            setSuccessPaymentId(verify.paymentId);
            onSuccess?.(verify.paymentId ?? response.razorpay_payment_id);
          } else {
            const msg = verify.message ?? 'Signature verification failed.';
            setErrorMsg(msg);
            setState('failed');
            onError?.(msg);
          }
        } catch (err: any) {
          const msg = err?.message ?? 'Verification request failed.';
          setErrorMsg(msg);
          setState('failed');
          onError?.(msg);
        }
      },
    });

    // payment.failed fires when Razorpay reports a failure (network, bank decline, etc.)
    rzp.on('payment.failed', (response: { error: RazorpayError }) => {
      const msg = response.error?.description ?? 'Payment failed.';
      setErrorMsg(`Payment failed: ${msg}${response.error?.code ? ` (${response.error.code})` : ''}`);
      setState('failed');
      onError?.(msg);
    });

    rzp.open();
  };

  // ── Success state ─────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
          <CheckCircle className="h-4 w-4 shrink-0" />
          Payment verified successfully
        </div>
        {successPaymentId && (
          <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            Payment ID: <span className="font-mono">{successPaymentId}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
          transition-opacity disabled:opacity-60 disabled:cursor-not-allowed ${className ?? ''}`}
        style={{ background: 'var(--accent)', color: '#fff' }}>

        {state === 'creating'  && <><Loader2 className="h-4 w-4 animate-spin" />Creating order…</>}
        {state === 'open'      && <><Loader2 className="h-4 w-4 animate-spin" />Awaiting payment…</>}
        {state === 'verifying' && <><Loader2 className="h-4 w-4 animate-spin" />Verifying…</>}
        {!isLoading            && <><CreditCard className="h-4 w-4" />{label}</>}
      </button>

      {/* Error / cancelled feedback */}
      {(state === 'failed' || state === 'cancelled') && (
        <div className="flex flex-col gap-2">
          {errorMsg && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
              style={{
                background: state === 'cancelled' ? 'var(--surface-2)' : 'var(--danger-bg)',
                color:      state === 'cancelled' ? 'var(--fg-muted)'  : 'var(--danger)',
                border: `1px solid ${state === 'cancelled' ? 'var(--border)' : 'var(--danger)'}`,
              }}>
              <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          <button
            onClick={() => { setState('idle'); setErrorMsg(null); }}
            className="text-xs underline text-left"
            style={{ color: 'var(--accent)' }}>
            Try again
          </button>
        </div>
      )}

      <p className="text-xs text-center" style={{ color: 'var(--fg-subtle)' }}>
        🔒 Secured by Razorpay ·{' '}
        <span className="font-semibold" style={{ color: 'var(--warning)' }}>TEST MODE</span>
      </p>
    </div>
  );
}
