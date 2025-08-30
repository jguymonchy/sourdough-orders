'use client'

import { useState } from 'react'

type Item = { sku: string; name: string }

const CATALOG: Item[] = [
  { sku: 'classic', name: 'Classic Sourdough' },
  { sku: 'jalapeno-cheddar', name: 'Jalapeño Cheddar' },
  { sku: 'cinnamon-raisin', name: 'Cinnamon Raisin' },
  { sku: 'banana-pepper-pepper-jack', name: 'Banana Pepper & Pepper Jack' }
]

export default function OrderPage() {
  const [form, setForm] = useState({
    customer_name: '',
    email: '',
    phone: '',
    ship: true,
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'USA',
    notes: ''
  })
  const [cart, setCart] = useState<Record<string, number>>({})
  const [status, setStatus] = useState<string>('')

  function setQty(sku: string, qty: number) {
    setCart(prev => {
      const next = { ...prev }
      if (qty > 0) next[sku] = qty
      else delete next[sku]
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('Submitting...')
    const items = Object.entries(cart).map(([sku, qty]) => {
      const it = CATALOG.find(i => i.sku === sku)!
      return { sku, name: it.name, qty }
    })
    if (items.length === 0) {
      setStatus('Please add at least one item.')
      return
    }
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items })
    })
    if (res.ok) {
      setStatus('Thanks! Your order was submitted. Check your email for confirmation.')
      setCart({})
      ;(document.getElementById('order-form') as HTMLFormElement)?.reset()
    } else {
      const t = await res.text()
      setStatus('Error: ' + t)
    }
  }

  return (
    <div className="card">
      <h1>Order Bread</h1>
      <p>Choose your loaves and enter shipping details.</p>
      <form id="order-form" onSubmit={submit}>
        <div className="card">
          <h3>Loaves</h3>
          {CATALOG.map(item => {
            const qty = cart[item.sku] || 0
            return (
              <div key={item.sku} className="flex" style={{ justifyContent: 'space-between' }}>
                <div>{item.name}</div>
                <div className="flex">
                  <button type="button" onClick={() => setQty(item.sku, Math.max(0, qty - 1))}>-</button>
                  <input
                    type="number"
                    min={0}
                    value={qty}
                    onChange={e => setQty(item.sku, Math.max(0, parseInt(e.target.value || '0', 10)))}
                    style={{ width: 60, textAlign: 'center' }}
                  />
                  <button type="button" onClick={() => setQty(item.sku, qty + 1)}>+</button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <h3>Contact</h3>
          <label>Name<input required onChange={e=>setForm({...form, customer_name:e.target.value})} /></label>
          <label>Email<input type="email" onChange={e=>setForm({...form, email:e.target.value})} /></label>
          <label>Phone<input onChange={e=>setForm({...form, phone:e.target.value})} /></label>
        </div>

        <div className="card">
          <h3>Delivery</h3>
          <label>
            <span className="flex"><input type="checkbox" checked={form.ship} onChange={e=>setForm({...form, ship:e.target.checked})}/> Ship to address</span>
          </label>
          {form.ship && (
            <div className="row">
              <label>Address line 1<input onChange={e=>setForm({...form, address_line1:e.target.value})} /></label>
              <label>Address line 2<input onChange={e=>setForm({...form, address_line2:e.target.value})} /></label>
              <label>City<input onChange={e=>setForm({...form, city:e.target.value})} /></label>
              <label>State<input onChange={e=>setForm({...form, state:e.target.value})} /></label>
              <label>Postal Code<input onChange={e=>setForm({...form, postal_code:e.target.value})} /></label>
              <label>Country<input defaultValue="USA" onChange={e=>setForm({...form, country:e.target.value})} /></label>
            </div>
          )}
          <label>Notes<textarea onChange={e=>setForm({...form, notes:e.target.value})} /></label>
        </div>

        <button className="primary" type="submit">Submit Order</button>
      </form>
      <p><small className="muted">{status}</small></p>
    </div>
  )
}
