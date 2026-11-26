// UPI "pay" deep links (NPCI UPI linking specification). Any UPI app opens
// this link, or the QR that encodes it, with the payee and amount filled in.
// Values are percent-encoded; UPI apps expect %20 for spaces, not "+".

export type UpiPayRequest = {
  upiId: string;
  payeeName: string;
  amount: number;
  // Shown to the payer and on their statement, e.g. the booking reference.
  note: string;
  // Our reference for matching a payment to a booking later.
  reference: string;
};

const encode = (value: string) => encodeURIComponent(value);

export function buildUpiPayLink(request: UpiPayRequest): string {
  const params: [string, string][] = [
    ["pa", request.upiId],
    ["pn", request.payeeName],
    ["am", request.amount.toFixed(2)],
    ["cu", "INR"],
    ["tn", request.note.slice(0, 80)],
    ["tr", request.reference.slice(0, 35)],
  ];
  return `upi://pay?${params.map(([key, value]) => `${key}=${encode(value)}`).join("&")}`;
}

// A short, readable booking reference for payment notes ("AG-00000001").
export function bookingReference(bookingId: string): string {
  return `AG-${bookingId.replace(/-/g, "").slice(-8).toUpperCase()}`;
}

// Demo UPI IDs use the reserved @example handle, which no payment app
// accepts: the QR is shown, but no real money can move (ADR 0022).
export function isDemoUpiId(upiId: string): boolean {
  return upiId.toLowerCase().endsWith("@example");
}
