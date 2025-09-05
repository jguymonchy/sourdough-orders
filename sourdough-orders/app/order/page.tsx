'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ApiResponse = { ok: boolean; kh?: string; venmo_note?: string; error?: string };
type Flavor = { name: string; price: number };

// 👉 Your published CSV (name,price) from the “Flavors” sheet:
const FLAVORS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSwsTLwZpD-JCURv_-X4KtREOH1vFo2Ys9Me94io0Rq-MLcLcLvbeJb-ETrHbsa7p4FimwBNMMAsjlK/pub?gid=0&single=true&output=csv';

const PRICE_EACH = 10; // fallback if a flavor price is missing

// Tiny CSV parser: uses last comma as the separator so names can contain commas
function parseFlavorsCSV(text: string): Flavor[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  return lines.slice(1).map((line) => {
    const parts = line.split(',');
    const priceStr = parts.pop() ?? '';
    const name = parts.join(',').replace(/^"|"$/g, '').trim();
    const price = Number(String(priceStr).replace(/[^0-9.]/g, '')) || 0;
    return { name, price };
  }).filter(f => f.name);
}

export default function OrderPage() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kh, setKh] = useState<string | null>(null);

  // Hide site header on this page
  useEffect(() => {
    document.body.classList.add('khh-hide-header');
    return () => document.body.classList.remove('khh-hide-header');
  }, []);

  // Fulfillment + date helpers
  const [method, setMethod] = useState<'pickup' | 'shipping'>('pickup');
  const [dateHint, setDateHint] = useState<string>('');
  const dateRef = useRef<HTMLInputElement | null>(null);

  type Line = { name: string; qty: number };
  const [items, setItems] = useState<Line[]>([]);
  const [picker, setPicker] = useState<string>('');

  // --- Flavors pulled from the sheet ---
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  useEffect(() => {
    fetch(FLAVORS_CSV_URL)
      .then((r) => r.text())
      .then((t) => setFlavors(parseFlavorsCSV(t)))
      .catch(() => setFlavors([]));
  }, []);
  const priceMap = useMemo<Record<string, number>>(
    () => Object.fromEntries(flavors.map(f => [f.name, f.price])),
    [flavors]
  );

  const total = useMemo(
    () => items.reduce((sum, i) => sum + (i.qty || 0) * (priceMap[i.name] ?? PRICE_EACH), 0),
    [items, priceMap]
  );

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ---- Date helpers ----
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
  function nextDowFrom(from: Date, targetDow: number) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    do d.setDate(d.getDate() + 1);
    while (d.getDay() !== targetDow);
    return d;
  }
  function allowedDowFor(m: 'pickup' | 'shipping') {
    return m === 'pickup' ? 6 : 5; // Sat/Fri
  }
  function ruleText(m: 'pickup' | 'shipping') {
    return m === 'pickup'
      ? 'Pickup is Saturdays at Festival City Farmers Market (Cedar City).'
      : 'Shipping goes out on Fridays (US only).';
  }

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

  // ---- Items helpers ----
  function addItemByName(name: string) {
    if (!name) return;
    setItems((prev) => {
      const found = prev.find((p) => p.name === name);
      if (found) return prev.map((p) => (p.name === name ? { ...p, qty: p.qty + 1 } : p));
      return [...prev, { name, qty: 1 }];
    });
  }
  function setQty(idx: number, qty: number) {
    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, qty: Math.max(0, qty) } : p)));
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // ---------- Submit ----------
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setKh(null);

    try {
      const fd = new FormData(e.currentTarget);

      // For pickup, clear address fields so backend/Sheets stay clean
      const addressDisabled = method !== 'shipping';
      if (addressDisabled) {
        fd.set('address1', '');
        fd.set('address2', '');
        fd.set('city', '');
        fd.set('state', '');
        fd.set('postal', '');
      }

      if (dateRef.current) validateOrSnapDate(dateRef.current);

      // Build items array (with sku/name/item for Sheets + legacy)
      const filtered = items.filter((i) => (i.qty || 0) > 0);
      const itemsArray = filtered.map((line) => ({
        sku: slugify(line.name),
        name: line.name,
        item: line.name,
        qty: Number(line.qty || 0),
        unit_price: priceMap[line.name] ?? PRICE_EACH,
      }));

      // Payload with both canonical and alias fields (server normalizes)
      const payload = {
        customer_name: String(fd.get('name') || ''),
        email: String(fd.get('email') || ''),
        phone: String(fd.get('phone') || ''),
        fulfillment: method, // 'pickup' | 'shipping'
        pickup_date: String(fd.get('pickup_date') || ''),

        address_line1: String(fd.get('address1') || ''),
        address_line2: String(fd.get('address2') || ''),
        city: String(fd.get('city') || ''),
        state: String(fd.get('state') || ''),
        postal_code: String(fd.get('postal') || ''),
        country: 'USA',
        notes: String(fd.get('notes') || ''),
        items: itemsArray,
        status: 'open',

        // aliases for older code paths
        customerName: String(fd.get('name') || ''),
        customerEmail: String(fd.get('email') || ''),
        ship: method === 'shipping',
        address1: String(fd.get('address1') || ''),
        postal: String(fd.get('postal') || ''),
      };

      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Be robust to empty bodies
      const raw = await res.text();
      let data: ApiResponse | null = null;
      try {
        data = raw ? (JSON.parse(raw) as ApiResponse) : null;
      } catch {
        throw new Error(`Server returned non-JSON: ${raw?.slice(0, 200)}`);
      }

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Request failed (status ${res.status})`);
      }

      setKh(data.kh ?? null);
      setMessage(
        `✅ Order placed! ${data.kh ? `Your ID is ${data.kh}` : 'Check your email for confirmation.'}`
      );
      setItems([]); // reset after submit
      setPicker('');
    } catch (err: any) {
      setMessage(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const addressDisabled = method !== 'shipping';

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <img src="/khh-logo.svg" alt="Kanarra Heights Homestead" style={{ width: 300, height: 'auto' }} />
      </div>

      <div className="card khh-card" style={{ padding: 20, position: 'relative' }}>
        <div className="khh-wm" aria-hidden><div className="khh-wm__shape" /></div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Artisan Sourdough Bread — Order</h1>
          <p style={{ margin: '0 0 16px', color: '#666' }}>
            Choose <b>Pickup</b> or <b>Shipping</b>, then complete your details.
          </p>

          <form onSubmit={onSubmit}>
            <div style={{ display: 'grid', gap: 12 }}>
              {/* Contact */}
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
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 16 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="radio"
                      name="fulfillment_method"
                      value="pickup"
                      checked={method === 'pickup'}
                      onChange={() => setMethod('pickup')}
                    />
                    <span>Pickup</span>
                  </label>
                  <span style={{ color: '#666', fontSize: 12 }}>
                    Festival City Farmers Market, Cedar City
                  </span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
                <div style={{ marginTop: 6, color: '#666', fontSize: 12 }}>
                  {dateHint || ruleText(method)}
                </div>
              </div>

              {/* Address (Shipping only) */}
              <div style={{ marginTop: 6, fontWeight: 700, fontSize: 15 }}>
                Shipping Address (only if “Shipping”)
              </div>
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
              <div>
                <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 6 }}>
                  Choose a Bread Flavor
                </label>
                <select
                  value={picker}
                  onChange={(e) => {
                    const name = e.target.value;
                    setPicker(name);
                    addItemByName(name);
                    setTimeout(() => setPicker(''), 0); // allow re-adding same item
                  }}
                >
                  <option value="" disabled hidden>
                    — Select a Bread Flavor —
                  </option>
                  {flavors.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name} — ${f.price.toFixed(2)}
                    </option>
                  ))}
                </select>
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
                          style={{
                            appearance: 'none',
                            border: 'none',
                            background: '#eee',
                            color: '#333',
                            padding: '10px 12px',
                            borderRadius: 10,
                            cursor: 'pointer',
                          }}
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



