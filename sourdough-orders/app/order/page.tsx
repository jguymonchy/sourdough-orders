'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ApiResponse = { ok: boolean; kh?: string; venmo_note?: string; error?: string };

const CATALOG = [
  'Classic Sourdough',
  'Jalapeño Cheddar',
  'Cinnamon Raisin',
  'Banana Pepper & Pepper Jack',
  'Rosemary',
  'Garlic',
  'Seeded Country',
  'Olive',
];

const PRICE_EACH = 10;

export default function OrderPage() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kh, setKh] = useState<string | null>(null);

  // Fulfillment + date behavior
  const [method, setMethod] = useState<'pickup' | 'shipping'>('pickup');
  const [dateHint, setDateHint] = useState<string>('');
  const dateRef = useRef<HTMLInputElement | null>(null);

  // Items (dropdown -> lines with qty)
  type Line = { name: string; qty: number };
  const [items, setItems] = useState<Line[]>([{ name: 'Sourdough Loaf', qty: 1 }]);
  const [picker, setPicker] = useState<string>(CATALOG[0]);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + (i.qty || 0) * PRICE_EACH, 0),
    [items]
  );

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  // ---------- Date helpers (always snap to the NEXT valid day) ----------
  function toYMD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function fromYMD(ymd: string) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  // get the *next* occurrence of targetDow strictly in the future from "from"
  function nextDowFrom(from: Date, targetDow: number) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    do {
      d.setDate(d.getDate() + 1);
    } while (d.getDay() !== targetDow);
    return d;
  }
  function allowedDowFor(m: 'pickup' | 'shipping') {
    return m === 'pickup' ? 6 /* Sat */ : 5 /* Fri */;
  }
  function ruleText(m: 'pickup' | 'shipping') {
    return m === 'pickup'
      ? 'Pickup is Saturdays at Festival City Farmers Market (Cedar City).'
      : 'Shipping goes out on Fridays (US only).';
  }

  // When method changes, pick the next valid day from *today*
  useEffect(() => {
    const el = dateRef.current;
    const allowed = allowedDowFor(method);
    setDateHint(ruleText(method));
    if (el) {
      const snap = nextDowFrom(new Date(), allowed);
      el.value = toYMD(snap);
      el.setCustomValidity('');
    }
  }, [method]);

  // If user picks a non-valid day, snap to the next valid day from that pick
  function validateOrSnapDate(el: HTMLInputElement) {
    if (!el.value) return;
    try {
      const picked = fromYMD(el.value);
      const allowed = allowedDowFor(method);
      if (picked.getDay() !== allowed) {
        const snapped = nextDowFrom(picked, allowed);
        el.value = toYMD(snapped);
        setDateHint(
          method === 'pickup'
            ? 'Pickup is Saturdays — date adjusted to the next Saturday.'
            : 'Shipping is Fridays — date adjusted to the next Friday.'
        );
      } else {
        setDateHint(ruleText(method));
      }
      el.setCustomValidity('');
    } catch {
      el.setCustomValidity('');
    }
  }

  // ---------- Items helpers ----------
  function addItem() {
    if (!picker) return;
    setItems((prev) => {
      const found = prev.find((p) => p.name === picker);
      if (found) {
        return prev.map((p) => (p.name === picker ? { ...p, qty: p.qty + 1 } : p));
      }
      return [...prev, { name: picker, qty: 1 }];
    });
  }
  function setQty(idx: number, qty: number) {
    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, qty: Math.max(0, qty) } : p)));
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // ---------- Submit ----------
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setKh(null);

    try {
      const fd = new FormData(e.currentTarget);

      // Clear address fields when Pickup
      const addressDisabled = method !== 'shipping';
      if (addressDisabled) {
        fd.set('address1', '');
        fd.set('address2', '');
        fd.set('city', '');
        fd.set('state', '');
        fd.set('postal', '');
      }

      // Ensure date is valid before sending
      if (dateRef.current) validateOrSnapDate(dateRef.current);

      // Build payload + map items -> item1_name/item1_qty, ...
      const payload: Record<string, any> = Object.fromEntries(fd.entries());
      const filtered = items.filter((i) => (i.qty || 0) > 0);
      filtered.forEach((line, idx) => {
        const n = idx + 1;
        payload[`item${n}_name`] = line.name;
        payload[`item${n}_qty`] = String(line.qty);
      });

      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: ApiResponse = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Order failed');

      setKh(data.kh ?? null);
      setMessage(`✅ Order placed! ${data.kh ? `Your ID is ${data.kh}` : 'Check your email for confirmation.'}`);
      // reset items to a single default row
      setItems([{ name: 'Sourdough Loaf', qty: 1 }]);
    } catch (err: any) {
      setMessage(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const addressDisabled = method !== 'shipping';

  return (
    <div className="container">
      <div className="card khh-card" style={{ padding: 20, position: 'relative' }}>
        {/* BIG centered watermark */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: 0.06,
          }}
        >
          <img
            src="/khh-logo.svg"
            alt=""
            style={{ width: '50%', height: '50%', objectFit: 'contain', filter: 'grayscale(100%) contrast(85%)' }}
          />
        </div>

        {/* Content layer above watermark */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Kanarra Heights Homestead — Order</h1>
          <p style={{ margin: '0 0 16px', color: '#666' }}>
            Choose <b>Pickup</b> or <b>Shipping</b>, then complete your details.
          </p>

          <form onSubmit={onSubmit}>
            {/* Contact */}
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: 14 }}>Full Name</label>
                <input name="name" placeholder="Jane Doe" required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontWeight: 600, fontSize: 14 }}>Email</label>
                  <input name="email" type="email" placeholder="jane@example.com" required />
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: 14 }}>Phone</label>
                  <input name="phone" placeholder="(555) 555-5555" required />
                </div>
              </div>

              {/* Fulfillment */}
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Fulfillment</div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 24 }}>
                    <input
                      type="radio"
                      name="fulfillment_method"
                      value="pickup"
                      checked={method === 'pickup'}
                      onChange={() => setMethod('pickup')}
                    />
                    <span>Pickup</span>
                  </label>
                  <span style={{ color: '#666', fontSize: 12, marginRight: 32 }}>
                    Festival City Farmers Market, Cedar City
                  </span>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 24 }}>
                    <input
                      type="radio"
                      name="fulfillment_method"
                      value="shipping"
                      checked={method === 'shipping'}
                      onChange={() => setMethod('shipping')}
                    />
                    <span>Shipping</span>
                  </label>
                  <span style={{ color: '#666', fontSize: 12 }}>US only</span>
                </div>
              </div>

              {/* Date */}
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Date</label>
                <input
                  ref={dateRef}
                  name="pickup_date"
                  type="date"
                  onBlur={(e) => validateOrSnapDate(e.currentTarget)}
                />
                <div style={{ marginTop: 6, color: '#666', fontSize: 12 }}>{dateHint || ruleText(method)}</div>
              </div>

              {/* Address (Shipping only) */}
              <div style={{ marginTop: 6, fontWeight: 700, fontSize: 15 }}>Shipping Address (only if “Shipping”)</div>
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Address line 1</label>
                <input name="address1" disabled={addressDisabled} required={!addressDisabled} />
              </div>
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Address line 2</label>
                <input name="address2" disabled={addressDisabled} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>City</label>
                  <input name="city" disabled={addressDisabled} required={!addressDisabled} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>State</label>
                  <input name="state" disabled={addressDisabled} required={!addressDisabled} />
                </div>
              </div>
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Postal Code</label>
                <input name="postal" disabled={addressDisabled} required={!addressDisabled} />
              </div>

              {/* Items */}
              <div style={{ marginTop: 6, fontWeight: 700, fontSize: 15 }}>Items</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 12, alignItems: 'end' }}>
                <div>
                  <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6 }}>Choose a bread</label>
                  <select value={picker} onChange={(e) => setPicker(e.target.value)}>
                    {CATALOG.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <button type="button" onClick={addItem} className="primary" style={{ width: '100%' }}>
                    Add item
                  </button>
                </div>
                <div />
              </div>

              {items.length > 0 && (
                <div style={{ border: '1px solid #eee', borderRadius: 10 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 120px 80px',
                      padding: '8px 10px',
                      borderBottom: '1px solid #eee',
                      fontWeight: 600,
                    }}
                  >
                    <div>Item</div>
                    <div style={{ textAlign: 'right' }}>Qty</div>
                    <div />
                  </div>
                  {items.map((line, idx) => (
                    <div
                      key={`${line.name}-${idx}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 120px 80px',
                        padding: '8px 10px',
                        alignItems: 'center',
                        borderBottom: idx < items.length - 1 ? '1px solid #f3f3f3' : 'none',
                      }}
                    >
                      <div>{line.name}</div>
                      <div style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          min={0}
                          value={line.qty}
                          onChange={(e) => setQty(idx, Math.max(0, Number(e.target.value || 0)))}
                          style={{ width: 100, textAlign: 'right' }}
                        />
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          style={{ appearance: 'none', border: 'none', background: '#eee', color: '#333', padding: '10px 12px', borderRadius: 10, cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total + Submit */}
              <div style={{ marginTop: 6, color: '#333' }}>
                <b>Estimated total:</b> ${total}
                <div style={{ fontSize: 12, color: '#666' }}>(final total computed server-side)</div>
              </div>

              <button type="submit" disabled={submitting} className="primary" style={{ marginTop: 12 }}>
                {submitting ? 'Placing order…' : 'Place Order'}
              </button>

              {message && (
                <div style={{ marginTop: 10, padding: 10, background: '#f6f6f6', borderRadius: 10 }}>
                  {kh ? (
                    <div>
                      <div style={{ fontWeight: 700 }}>{message}</div>
                      <div>Venmo note: “{kh} — Kanarra Heights Homestead”</div>
                    </div>
                  ) : (
                    message
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: '#777', textAlign: 'center' }}>
        Pickup is Saturdays at Festival City Farmers Market (Cedar City). Shipping runs Fridays (US only).
      </div>
    </div>
  );
}

