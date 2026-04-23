// Shared types for the POS terminal UI

export interface PosCategory {
  id: number
  name: string
  parent_id?: [number, string] | number | false | null
  color?: number | null
  sequence?: number
}

export interface Product {
  id: number
  name: string
  list_price?: number | null
  price?: number | null
  image_1920?: string | false | null
  categ_id?: [number, string] | number | false | null
  default_code?: string | false | null
  barcode?: string | false | null
}

export interface AttributeValue {
  id: number
  name: string
  html_color?: string | false | null
  sequence?: number
}

export interface AttributeLine {
  id: number
  attribute_id: number | [number, string]
  attribute_name?: string
  value_ids?: AttributeValue[]
  values?: AttributeValue[]
}

export interface Variant {
  id: number
  name?: string
  product_template_attribute_value_ids?: number[]
  price?: number
  list_price?: number
  qty_available?: number
  image_1920?: string | false
}

export interface CartLine {
  uid: string                 // stable client-side id so the same product as two lines is OK
  productId: number
  variantId?: number | null
  name: string
  price: number
  qty: number
  discount: number            // percent 0..100
  note?: string
  image_1920?: string | null  // thumbnail (optional, no huge base64 persisted)
}

export interface PosPaymentMethod {
  id: number
  name: string
  is_cash_count?: boolean
  use_payment_terminal?: boolean | string | false
}

export interface PosSession {
  id: number
  name: string
  config_id: [number, string] | number
  state: string
}

export interface PosConfig {
  id: number
  name: string
  module_pos_restaurant?: boolean
}

export interface PaymentLine {
  payment_method_id: number
  payment_method_name: string
  amount: number
  is_cash: boolean
}

export interface CompletedReceipt {
  orderId: number
  orderName?: string
  lines: CartLine[]
  payments: PaymentLine[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  change: number
  customer?: string
  date: string
}

export type ServiceMode = 'dine_in' | 'takeout' | 'delivery'

// Currency formatter (hoisted)
const _money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})
export function fmtMoney(value: number): string {
  if (!Number.isFinite(value)) return _money.format(0)
  return _money.format(value)
}

// Map Odoo-style integer color (0..11) to a Tailwind-friendly hex / class hint.
// We return a hex so we can use it as inline border/background — avoids hard-coded
// tailwind classes that might get purged.
const PALETTE = [
  '#94a3b8', // 0 - slate
  '#ef4444', // 1 - red
  '#f97316', // 2 - orange
  '#eab308', // 3 - yellow
  '#22c55e', // 4 - green
  '#14b8a6', // 5 - teal
  '#06b6d4', // 6 - cyan
  '#3b82f6', // 7 - blue
  '#6366f1', // 8 - indigo
  '#a855f7', // 9 - purple
  '#ec4899', // 10 - pink
  '#f43f5e', // 11 - rose
]
export function categoryColor(color: number | null | undefined): string {
  if (color == null) return PALETTE[0]
  return PALETTE[Math.abs(color) % PALETTE.length]
}

export function uuid(): string {
  // Lightweight unique id, no deps
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

export function imageSrc(image: string | false | null | undefined): string | null {
  if (!image) return null
  // Backend might already provide a data: URL; otherwise assume base64 png
  if (typeof image === 'string' && image.startsWith('data:')) return image
  return `data:image/png;base64,${image}`
}

export const TAX_RATE = 0.10   // 10% default tax
