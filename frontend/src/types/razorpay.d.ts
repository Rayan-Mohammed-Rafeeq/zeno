/**
 * Minimal type declarations for the Razorpay Standard Checkout SDK.
 * Loaded via <script src="https://checkout.razorpay.com/v1/checkout.js">
 *
 * Only the fields we actually use are declared — full SDK types are
 * available at @types/razorpay if needed.
 */
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: { color?: string };
  modal?: {
    ondismiss?: () => void;
    confirm_close?: boolean;
  };
  handler: (response: RazorpaySuccessResponse) => void;
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id:   string;
  razorpay_signature:  string;
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: { error: RazorpayError }) => void): void;
}

interface RazorpayError {
  code:        string;
  description: string;
  source:      string;
  step:        string;
  reason:      string;
  metadata:    { payment_id?: string; order_id?: string };
}

interface Window {
  Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
}
