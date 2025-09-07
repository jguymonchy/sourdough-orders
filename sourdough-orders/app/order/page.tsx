'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ApiResponse = { ok: boolean; kh?: string; venmo_note?: string; error?: string };
type Flavor = { name: string; price: number };

const FLAVORS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSwsTLwZpD-JCURv_-X4KtREOH1vFo2Ys9Me94io0Rq-MLcLcLvbeJb-ETrHbsa7p4FimwBNMMAsjlK/pub?gid=0&single=true&output=csv';

const PRICE_EACH = 10;
const VENMO_USERNAME = 'John-T-Guymon';

function parseFlavorsCSV(text: string): Flavor[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  return lines
    .slice(1)
    .map((line) => {
      const parts = line.split(',');
      const priceStr = parts.pop() ?? '';
      const name = parts.join(',').replace(/^"|"$/g, '').trim();
      const price = Number(String(priceStr).replace(/[^0-9.]/g, '')) || 0;
      return { name, price };
    })
    .filter((f) => f.name);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildVenmoDeepLink(user: string, amount: number, note: string) {
  const base = 'venmo://paycharge';
  const params = new URLSearchParams();
  params.set('txn', 'pay');
  params.set('recipients', user);
  if (amount > 0) params.set('amount', String(amount));
  if (note) params.set('note', note);
  return `${base}?${params.toString()}`;
}

// ---------- Date helpers ----------
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
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
// Strictly-next DOW (always moves forward at least 1 day)
function nextDowFrom(from: Date, targetDow: number) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  do d.setDate(d.getDate() + 1);
  while (d.getDay() !== targetDow);
  return d;
}
// Next-or-same DOW (today counts if it matches)
function nextOrSameDowFrom(from: Date, targetDow: number) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  while (d.getDay() !== targetDow) d.setDate(d.getDate() + 1);
  return d;
}

// Pickup cutoff logic:
// - Before Thu 10:00 AM → earliest allowed = THIS Saturday (today counts if Saturday)
// - Thu 10:00 AM or later (including Fri/Sat) → earliest allowed = NEXT Saturday
function nextPickupSaturdayConsideringCutoff(now: Date) {
  const dow = now.getDay(); // 0=Sun ... 6=Sat
  const hour = now.getHours();
  const thisOrSameSaturday = nextOrSameDowFrom(now, 6);
  const cutoffPassed = dow > 4 /* Fri(5) or Sat(6) */ || (dow === 4 && hour >= 10); /* Thu >=10:00 */
  if (cutoffPassed) {
    const nextSat = new Date(thisOrSameSaturday);
    nextSat.setDate(thisOrSameSaturday.getDate() + 7);
    return nextSat;
  }
  return thisOrSameSaturday;
}

export default function OrderPage() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kh, setKh] = useState<string | null>(null);
  const [lastTotal, setLastTotal] = useState(0);

  // Hide site header on this page
  useEffect(() => {
    document.body.classList.add('khh-hide-header');
    return () => document.body.classList.remove('khh-hide-header');
  }, []);

  const [method, setMethod] = useState<'pickup' | 'shipping'>('pickup');
  const [dateHint, setDateHint] = useState<string>('');
  const dateRef = useRef<HTMLInputElement | null>(null);

  type Line = { name: string; qty: number };
  const [items, setItems] = useState<Line[]>([]);
  const [picker, setPicker] = useState<string>('');

  // Flavors from sheet
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  useEffect(() => {
    const u = new URL(FLAVORS_CSV_URL);
    u.searchParams.set('ts', String(Date.now())); // cache-buster
    fetch(u.toString(), { cache: 'no-store' })
      .then((r) => r.text())
      .then((t) => setFlavors(parseFlavorsCSV(t)))
      .catch(() => setFlavors([]));
  }, []);
  const priceMap = useMemo<Record<string, number>>(
    () => Object.fromEntries(flavors.map((f) => [f.name, f.price])),
    [flavors]
  );

  const total = useMemo(
    () => items.reduce((sum, i) => sum + (i.qty || 0) * (priceMap[i.name] ?? PRICE_EACH), 0),
    [items, priceMap]
  );

  // auto-hide popup after 15s
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 15000);
      return () => clearTimeout(t);
    }
  }, [message]);

  function ruleText(m: 'pickup' | 'shipping') {
    if (m === 'pickup') {
      return 'Pickup is Saturdays at Festival City Farmers Market (Cedar City). After Thu 10:00 AM, pickup moves to the following Saturday.';
    }
    return 'Shipping goes out on Fridays (US only).';
  }

  // Initialize default date and set <input min> whenever method changes
  useEffect(() => {
    const el = dateRef.current;
    setDateHint(ruleText(method));
    if (!el) return;

    if (method === 'pickup') {
      const minSat = startOfDay(nextPickupSaturdayConsideringCutoff(new Date()));
      el.value = toYMD(minSat);
      el.min = toYMD(minSat); // prevent earlier dates
      el.setCustomValidity('');
    } else {
      const fri = startOfDay(nextOrSameDowFrom(new Date(), 5));
      el.value = toYMD(fri);
      el.min = toYMD(fri);
      el.setCustomValidity('');
    }
  }, [method]);

  function validateOrSnapDate(el: HTMLInputElement) {
    if (!el.value) return;
    try {
      const picked = startOfDay(fromYMD(el.value));

      if (method === 'pickup') {
        const minSat = startOfDay(nextPickupSaturdayConsideringCutoff(new Date()));

        // Too early? lock to earliest allowed Saturday
        if (picked < minSat) {
          el.value = toYMD(minSat);
          setDateHint('Pickup date adjusted to the earliest available Saturday based on the Thu 10:00 AM cutoff.');
          el.setCustomValidity('');
          return;
        }

        // Not a Saturday? snap forward to the next Saturday from that picked date
        if (picked.getDay() !== 6) {
          const nextSat = startOfDay(nextDowFrom(picked, 6));
          el.value = toYMD(nextSat);
          setDateHint('Pickup is Saturdays — date adjusted to the next Saturday.');
        } else {
          // Valid future Saturday — accept as-is
          setDateHint(ruleText('pickup'));
        }
        el.setCustomValidity('');
        return;
      }

      // Shipping path (disabled in UI, kept tidy)
      if (picked.getDay() !== 5) {
        const fri = startOfDay(nextDowFrom(picked, 5));
        el.value = toYMD(fri);
        setDateHint('Shipping is Fridays — date adjusted to the next Friday.');
      } else {
        setDateHint(ruleText('shipping'));
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

      // For pickup, clear address fields
      const addressDisabled = method !== 'shipping';
      if (addressDisabled) {
        fd.set('address1', '');
        fd.set('address2', '');
        fd.set('city', '');
        fd.set('state', '');
        fd.set('postal', '');
      }

      if (dateRef.current) validateOrSnapDate(dateRef.current);

      const filtered = items.filter((i) => (i.qty || 0) > 0);
      const itemsArray = filtered.map((line) => ({
        sku: slugify(line.name),
        name: line.name,
        item: line.name,
        qty: Number(line.qty || 0),
        unit_price: priceMap[line.name] ?? PRICE_EACH,
      }));

      const payload = {
        customer_name: String(fd.get('name') || ''),
        email: String(fd.get('email') || ''),
        phone: String(fd.get('phone') || ''),
        fulfillment: method,
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
        // aliases
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

      const raw = await res.text();
      let data: ApiResponse | null = null;
      try {
        data = raw ? (JSON.parse(raw) as ApiResponse) : null;
      } catch {
        throw new Error(`Server returned non-JSON: ${raw?.slice(0, 200)}`);
      }

      if (!res.ok || !data?.ok) throw new Error(data?.error || `Request failed (status ${res.status})`);

      setKh(data.kh ?? null);
      setLastTotal(total);
      setMessage(`✅ Order placed! ${data.kh ? `Your ID is ${data.kh}` : 'Check your email for confirmation.'}`);
      setItems([]);
      setPicker('');
    } catch (err: any) {
      setMessage(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const addressDisabled = method !== 'shipping';
  const venmoNote = kh ? `${kh} — Kanarra Heights Homestead` : '';
  const venmoDeepLink = buildVenmoDeepLink(VENMO_USERNAME, lastTotal, venmoNote);
  const venmoWebLink = `https://account.venmo.com/u/${VENMO_USERNAME}`;

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
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.6 }}>
                    <input
                      type="radio"
                      name="fulfillment_method"
                      value="shipping"
                      disabled
                      checked={false}
                      onChange={() => {}}
                    />
                    <span>Shipping (coming soon)</span>
                  </label>
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
                    setTimeout(() => setPicker(''), 0);
                  }}
                >
                  <option value="" disabled hidden>— Select a Bread Flavor —</option>
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
                <div style={{ marginTop: 10, padding: 10, background: '#f6f6f6', borderRadius: 10, position: 'relative' }}>
                  {/* Close button */}
                  <button
                    onClick={() => setMessage(null)}
                    style={{ position: 'absolute', top: 6, right: 8, border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer', color: '#555' }}
                    aria-label="Close"
                  >
                    ×
                  </button>

                  {kh ? (
                    <div>
                      <div style={{ fontWeight: 700 }}>{message}</div>
                      <div>Venmo note: “{venmoNote}”</div>

                      {/* Venmo block */}
                      <div style={{ marginTop: 12, padding: 12, border: '1px solid #eee', borderRadius: 10 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Pay with Venmo</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                          <a
                            href={venmoDeepLink}
                            style={{ padding: '10px 12px', borderRadius: 10, background: '#3d95ce', color: '#fff', textDecoration: 'none', fontWeight: 600 }}
                          >
                            Open Venmo & Pay ${lastTotal}
                          </a>
                          <a
                            href={venmoWebLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'underline', color: '#333' }}
                          >
                            Or open your Venmo profile
                          </a>
                          <button
                            type="button"
                            onClick={() => setMessage('👍 No problem — you can pay within 24 hours.')}
                            style={{ appearance: 'none', border: '1px solid #ccc', background: '#fff', color: '#333', padding: '10px 12px', borderRadius: 10, cursor: 'pointer' }}
                          >
                            Pay later
                          </button>
                        </div>
                        <div style={{ marginTop: 8, color: '#555', fontSize: 13 }}>
                          Please include <b>{kh}</b> in your Venmo note. Pay within <b>24 hours</b> or your order may be cancelled.
                        </div>
                      </div>
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
