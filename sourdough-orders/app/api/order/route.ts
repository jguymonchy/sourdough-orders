// app/api/order/route.ts
// Forward any calls to /api/order to the new /api/orders route
export { POST } from "../orders/route";
