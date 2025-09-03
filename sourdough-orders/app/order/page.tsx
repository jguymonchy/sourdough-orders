'use client';
import { useState } from 'react';

export default function OrderPage() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kh, setKh] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setKh(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      fulfillment: formData.get('fulfillment'),
      date: formData.get('date'),
      address1: formData.get('address1'),
      address2: formData.get('address2'),
      city: formData.get('city'),
      state: formData.get('state'),
      postal: formData.get('postal'),
      items: [] as any[],
      notes: formData.get('notes'),
    };

    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setKh(data.kh_id || null);
        setMessage('Order placed successfully!');
      } else {
        setMessage('Something went wrong.');
      }
    } catch (err) {
      setMessage('Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <div className="card khh-card" style={{ padding: 24, position: 'relative' }}>
        {/* watermark */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: 0.05,
          }}
        >
          <img
            src="/khh-logo.svg"
            alt=""
            style={{
              width: '50%',
              height: '50%',
              objectFit: 'contain',
            }}
          />
        </div>

        <h2 style={{ marginBottom: 12, position: 'relative', zIndex: 1 }}>
          Kanarra Heights Homestead — Order
        </h2>
        <p style={{ marginTop: 0, marginBottom: 20, color: '#555', position: 'relative', zIndex: 1 }}>
          Choose <strong>Pickup</strong> or <strong>Shipping</strong>, then complete your details.
        </p>

        <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Full Name</label>
              <input name="name" required />
            </div>
            <div>
              <label>Email</label>
              <input type="email" name="email" required />
            </div>
            <div>
              <label>Phone</label>
              <input type="tel" name="phone" required />
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label>Fulfillment</label>
            <div style={{ display: 'flex', gap: 24, marginTop: 6 }}>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <input type="radio" name="fulfillment" value="pickup" defaultChecked /> Pickup
                <span style={{ fontSize: 12, color: '#666' }}>
                  Festival City Farmers Market, Cedar City
                </span>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <input type="radio" name="fulfillment" value="shipping" /> Shipping
                <span style={{ fontSize: 12, color: '#666' }}>US only</span>
              </label>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label>Date</label>
            <input type="date" name="date" required />
            <div style={{ fontSize: 12, marginTop: 4, color: '#666' }}>
              Pickup is Saturdays at Festival City Farmers Market (Cedar City). Shipping runs Fridays
              (US only).
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label>Shipping Address (only if “Shipping”)</label>
            <input name="address1" placeholder="Address line 1" />
            <input name="address2" placeholder="Address line 2" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input name="city" placeholder="City" />
              <input name="state" placeholder="State" />
            </div>
            <input name="postal" placeholder="Postal Code" />
          </div>

          <div style={{ marginTop: 20 }}>
            <label>Items</label>
            <select name="bread">
              <option value="sourdough">Classic Sourdough</option>
              <option value="jalapeno">Jalapeño Cheddar</option>
              <option value="cinnamon">Cinnamon Raisin</option>
              <option value="banana">Banana Pepper & Pepper Jack</option>
            </select>
            <input name="qty" type="number" defaultValue={1} min={1} />
          </div>

          <div style={{ marginTop: 20 }}>
            <label>Notes</label>
            <textarea name="notes" rows={3} placeholder="Any special requests?" />
          </div>

          <button type="submit" disabled={submitting} className="primary" style={{ marginTop: 24 }}>
            {submitting ? 'Placing order…' : 'Place Order'}
          </button>

          {message && (
            <div style={{ marginTop: 12 }}>
              {message} {kh && <strong>{kh}</strong>}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

