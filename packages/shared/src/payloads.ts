// ---------------------------------------------------------------------------
// Shopify payload interfaces
// These type the `data: JSONB` column in db_import / db_history.
// NOT TypeORM entities — plain TypeScript types usable in both apps.
// ---------------------------------------------------------------------------

export interface ShopifyMoneySet {
  shop_money: { amount: string; currency_code: string };
  presentment_money: { amount: string; currency_code: string };
}

export interface OrderPayload {
  id: number;
  admin_graphql_api_id: string;
  name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  current_total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    sku: string | null;
    variant_id: number | null;
    product_id: number | null;
  }>;
  customer: CustomerPayload | null;
  [key: string]: unknown;
}

export interface CustomerPayload {
  id: number;
  admin_graphql_api_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  orders_count: number;
  total_spent: string;
  currency: string;
  tags: string;
  [key: string]: unknown;
}

export interface ProductPayload {
  id: number;
  admin_graphql_api_id: string;
  title: string;
  handle: string;
  status: 'active' | 'archived' | 'draft';
  product_type: string;
  vendor: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  tags: string;
  variants: Array<{
    id: number;
    title: string;
    sku: string | null;
    price: string;
    inventory_quantity: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface FulfillmentPayload {
  id: number;
  admin_graphql_api_id: string;
  order_id: number;
  status: string;
  created_at: string;
  updated_at: string;
  tracking_company: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  line_items: unknown[];
  [key: string]: unknown;
}
