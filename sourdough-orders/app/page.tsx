'use client';

import { useEffect, useMemo, useState } from 'react';
import { useState } from 'react';

export default function OrderPage() {
  const [method, setMethod] = useState<'pickup' | 'shipping'>('pickup'); // default = pickup
  const addressDisabled = method !== 'shipping';


type ApiResponse = {
  ok: boolean;
  kh?: string;
  venmo_note?: string;
  error?: string;
};

export default function OrderPage() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kh, setKh] = useState<string | null>(null);

  // simple local state to control UI toggles (form still posts with FormData)
  const [method, setMethod] = useState<'pickup' | 'shipping'>('pickup');

  // optional: lightweight live total (prices are also applied server-side)
  const [qty1, setQty1] = useState<number>(1);
  const [qty2, setQty2] = useState<number>(0);
  const PRICE_EACH = 10;

  const total = useMemo(() => (qty1 + qty2) * PRICE_EACH, [qty1, qty2]);

  useEffect(() => {
    // clear any message when user starts editing again
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setKh(null);

    try {
      const fd = new FormData(e.currentTarget);
      // If pickup, make sure address fields are empty (server ignores anyway, but keeps data clean)
      if (method === 'pickup') {
        fd.set('address1', '');
        fd.set('address2', '');
        fd.set('city', '');
        fd.set('state', '');
        fd.set('postal', '');
      }

      const payload = Object.fromEntries(fd.entries());

      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: ApiResponse = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Order failed');
      }
      setKh(data.kh ?? null);
      setMessage(`✅ Order placed! ${data.kh ? `Your ID is ${data.kh}` : 'Check your email for confirmation.'}`);
      // Optionally reset just the item quantities
      // (We keep name/email for convenience on repeated orders)
      setQty1(1);
      setQty2(0);
    } catch (err: any) {
      setMessage(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const addressDisabled = method !== 'shipping';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Kanarra Heights Homestead — Order</h1>
        <p style={{ margin: '0 0 16px', color: '#666' }}>
          Choose <b>Pickup</b> or <b>Shipping</b>, then complete your details.
        </p>

        <form onSubmit={onSubmit}>
          {/* Name / Contact */}
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: 14 }}>Full Name</label>
              <input name="name" placeholder="Jane Doe" required
                     style={inputStyle}/>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: 14 }}>Email</label>
                <input name="email" type="email" placeholder="jane@example.com" required
                       style={inputStyle}/>
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 14 }}>Phone</label>
                <input name="phone" placeholder="(555) 555-5555" required
                       style={inputStyle}/>
              </div>
            </div>

           {/* Fulfillment */}
<div style={{ marginTop: 16 }}>
  <div style={{ fontWeight: 700, marginBottom: 8 }}>Fulfillment</div>
  <div style={{ display: 'flex', gap: 16 }}>
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input
        type="radio"
        name="fulfillment_method"
        value="pickup"
        checked={method === 'pickup'}
        onChange={() => setMethod('pickup')}
      />
      Pickup
    </label>
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input
        type="radio"
        name="fulfillment_method"
        value="shipping"
        checked={method === 'shipping'}
        onChange={() => setMethod('shipping')}
      />
      Shipping
    </label>
  </div>
</div>

{/* Pickup date (shown for both, used when pickup) */}
<div style={{ marginTop: 12 }}>
  <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Pickup date</label>
  <input
    type="date"
    name="pickup_date"
    style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 10, fontSize: 16 }}
  />
</div>

{/* Shipping Address (disabled when Pickup) */}
<div style={{ marginTop: 16 }}>
  <div style={{ fontWeight: 700, marginBottom: 8 }}>Shipping address (only if “Shipping”)</div>

  <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Address line 1</label>
  <input
    name="address1"
    disabled={addressDisabled}
    required={!addressDisabled}
    style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 10, background: addressDisabled ? '#f6f6f6' : '#fff' }}
  />

  <div style={{ height: 10 }} />

  <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Address line 2</label>
  <input
    name="address2"
    disabled={addressDisabled}
    style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 10, background: addressDisabled ? '#f6f6f6' : '#fff' }}
  />

  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
    <div>
      <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>City</label>
      <input
        name="city"
        disabled={addressDisabled}
        required={!addressDisabled}
        style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 10, background: addressDisabled ? '#f6f6f6' : '#fff' }}
      />
    </div>
    <div>
      <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>State</label>
      <input
        name="state"
        disabled={addressDisabled}
        required={!addressDisabled}
        style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 10, background: addressDisabled ? '#f6f6f6' : '#fff' }}
      />
    </div>
  </div>

  <div style={{ marginTop: 12 }}>
    <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Postal Code</label>
    <input
      name="postal"
      disabled={addressDisabled}
      required={!addressDisabled}
      style={{ width: '100%', padding: 12, border: '1px solid #ddd', borderRadius: 10, background: addressDisabled ? '#f6f6f6' : '#fff' }}
    />
  </div>
</div>

            {/* Totals preview */}
            <div style={{ marginTop: 6, color: '#333' }}>
              <b>Estimated total:</b> ${total}
              <div style={{ fontSize: 12, color: '#666' }}>(final total computed server-side)</div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                appearance: 'none',
                border: 'none',
                background: '#111',
                color: '#fff',
                padding: '12px 16px',
                borderRadius: 12,
                fontSize: 16,
                cursor: 'pointer'
              }}
            >
              {submitting ? 'Placing order…' : 'Place Order'}
            </button>

            {message && (
              <div style={{ marginTop: 10, padding: 10, background: '#f6f6f6', borderRadius: 10 }}>
                {kh ? <div><div style={{ fontWeight: 700 }}>{message}</div><div>Venmo note: {`"${kh} — Kanarra Heights Homestead"`}</div></div> : message}
              </div>
            )}
          </div>
        </form>
      </div>
      <div style={{ marginTop: 14, fontSize: 12, color: '#777', textAlign: 'center' }}>
        You’ll see a Venmo note like “KH### — Kanarra Heights Homestead”.
      </div>
    </div>
  );
}

// --- little inline styles ---
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid #ddd',
};

function disabledStyle(disabled: boolean): React.CSSProperties {
  return {
    ...inputStyle,
    background: disabled ? '#f6f6f6' : '#fff',
  };
}
