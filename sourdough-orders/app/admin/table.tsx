'use client'

import { useEffect, useMemo, useState } from 'react'

type Order = {
  id: string
  created_at: string
  customer_name: string
  email: string | null
  phone: string | null
  ship: boolean
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  items: Array<{ sku: string, name: string, qty: number }>
  notes: string | null
  status: string
}

export default function OrdersTable() {
  const [orders, setOrders] = useState<Order[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    fetch('/api/order')
      .then(r=>r.json())
      .then(setOrders)
  }, [])

  const filtered = useMemo(() => {
    if (!q) return orders
    const t = q.toLowerCase()
    return orders.filter(o =>
      (o.customer_name || '').toLowerCase().includes(t) ||
      (o.email || '').toLowerCase().includes(t) ||
      (o.phone || '').toLowerCase().includes(t) ||
      (o.city || '').toLowerCase().includes(t) ||
      (o.state || '').toLowerCase().includes(t) ||
      (o.postal_code || '').toLowerCase().includes(t) ||
      (o.items || []).some(i => i.name.toLowerCase().includes(t))
    )
  }, [orders, q])

  function exportCSV() {
    const header = ['created_at','customer_name','email','phone','ship','address','items','notes','status','id']
    const rows = filtered.map(o => [
      o.created_at,
      o.customer_name,
      o.email || '',
      o.phone || '',
      o.ship ? 'ship' : 'pickup',
      [o.address_line1, o.address_line2, o.city, o.state, o.postal_code, o.country].filter(Boolean).join(', '),
      (o.items || []).map(i => `${i.name} x ${i.qty}`).join('; '),
      (o.notes || '').replace(/\n/g,' '),
      o.status,
      o.id
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'orders.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="card">
      <div className="flex" style={{justifyContent:'space-between'}}>
        <input placeholder="Search name, email, city, item..." value={q} onChange={e=>setQ(e.target.value)} />
        <button onClick={exportCSV}>Export CSV</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>When</th><th>Customer</th><th>Contact</th><th>Delivery</th><th>Address</th><th>Items</th><th>Notes</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(o => (
            <tr key={o.id}>
              <td><small>{new Date(o.created_at).toLocaleString()}</small></td>
              <td>{o.customer_name}</td>
              <td>
                <div>{o.email}</div>
                <div>{o.phone}</div>
              </td>
              <td><span className="badge">{o.ship ? 'Ship' : 'Pickup'}</span></td>
              <td style={{maxWidth:220, overflow:'hidden', textOverflow:'ellipsis'}}>
                {[o.address_line1, o.address_line2, o.city, o.state, o.postal_code, o.country].filter(Boolean).join(', ')}
              </td>
              <td>
                <ul style={{margin:0, paddingLeft:'1rem'}}>
                  {(o.items || []).map((i,idx)=>(<li key={idx}>{i.name} x {i.qty}</li>))}
                </ul>
              </td>
              <td style={{maxWidth:260}}>{o.notes}</td>
              <td>{o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p><small className="muted">No orders yet.</small></p>}
    </div>
  )
}
