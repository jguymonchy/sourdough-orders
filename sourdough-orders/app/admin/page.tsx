import OrdersTable from './table'

export const dynamic = 'force-dynamic'

export default function AdminHome() {
  return (
    <div>
      <h1>Orders</h1>
      <OrdersTable />
    </div>
  )
}
