'use client';
import { useState } from 'react';

export default function OrderForm() {
  const [msg, setMsg] = useState<string|null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());

    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) {
      setMsg('Something went wrong, please try again.');
    } else {
      setMsg(`✅ Order placed! Your ID is ${data.kh}`);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit}>
        <input name="name" placeholder="Full name" required />
        <input name="email" type="email" placeholder="Email" required />
        <input name="phone" placeholder="Phone" required />
        {/* add fulfillment_method, pickup_date, address1...item1_name, item1_qty, etc. */}
        <button type="submit">Place Order</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  );
}
