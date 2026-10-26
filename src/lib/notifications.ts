/**
 * Low-stock email notification hook (MOCK).
 *
 * Called when an item's current quantity drops to or below its `min_stock_level`.
 *
 * FUTURE INTEGRATION:
 * This function will later call a backend API route (e.g. `POST /api/notifications/low-stock`)
 * backed by a transactional email provider such as Resend or SendGrid, or by a Supabase Edge
 * Function triggered from a database webhook, which sends an automated "PO Required" email
 * alert to the purchasing manager. Keep the API key server-side only — never in the browser.
 *
 * Until then it only logs the payload that would be sent.
 */
export interface LowStockEmailPayload {
  to: string;
  subject: string;
  itemCode: string;
  itemName: string;
  currentQty: number;
  minQty: number;
  shortfall: number;
}

// Placeholder recipient — to be replaced by the purchasing manager's address from settings/DB.
const PURCHASING_MANAGER_EMAIL = 'purchasing@zahi.example';

export async function triggerLowStockEmail(
  itemCode: string,
  itemName: string,
  currentQty: number,
  minQty: number
): Promise<LowStockEmailPayload> {
  const payload: LowStockEmailPayload = {
    to: PURCHASING_MANAGER_EMAIL,
    subject: `PO Required: ${itemCode} (${itemName}) is below minimum stock`,
    itemCode,
    itemName,
    currentQty,
    minQty,
    shortfall: Math.max(minQty - currentQty, 0),
  };

  // TODO: replace with `await fetch('/api/notifications/low-stock', { method: 'POST', body: JSON.stringify(payload) })`
  console.info('[triggerLowStockEmail] (mock) would send "PO Required" email:', payload);
  return payload;
}
