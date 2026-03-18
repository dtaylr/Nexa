export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface FailurePattern {
 patterns: RegExp[];
 severity: Severity;
 recommendedAction: string;
 escalate: boolean;
}

export const DOMAIN_FAILURE_TAXONOMY: Record<
 string,
 Record<string, FailurePattern>
> = {
 finance: {
  PRECISION_ERROR: {
   patterns: [/floating.?point/i, /0\.3000000/, /arithmetic/i, /toFixed/i],
   severity: "CRITICAL",
   recommendedAction:
    "Switch to Decimal library for all monetary calculations. IEEE 754 floats must not be used for financial arithmetic.",
   escalate: true,
  },
  AUDIT_MISSING: {
   patterns: [
    /auditId.*undefined/,
    /audit.*not found/i,
    /audit record missing/i,
   ],
   severity: "CRITICAL",
   recommendedAction:
    "Transaction completed without audit trail. Wrap transfer and audit write in a single database transaction.",
   escalate: true,
  },
  AUTH_BYPASS: {
   patterns: [
    /401.*not thrown/,
    /unauthorized.*200/i,
    /recently expired token/i,
    /grace period/i,
   ],
   severity: "CRITICAL",
   recommendedAction:
    "Token expiry grace period detected. Remove `ignoreExpiration` and validate `exp` against current timestamp directly.",
   escalate: true,
  },
  DATA_LEAKAGE: {
   patterns: [/account.*ID.*leaked/i, /accountId.*response/i, /ACCOUNT_ID_DISCLOSURE/],
   severity: "HIGH",
   recommendedAction:
    "Account identifier exposed in error response. Return only generic error messages to clients.",
   escalate: false,
  },
  RACE_CONDITION: {
   patterns: [
    /negative balance/i,
    /balance went negative/i,
    /concurrent.*transfer/i,
    /BALANCE_RACE_CONDITION/,
   ],
   severity: "CRITICAL",
   recommendedAction:
    "Double-spend race condition detected. Wrap balance check and debit in a serializable database transaction.",
   escalate: true,
  },
 },

 health: {
  PII_LEAKAGE: {
   patterns: [/patient.*id.*response/i, /PII pattern.*found/i, /PATIENT_PII_DISCLOSURE/],
   severity: "CRITICAL",
   recommendedAction:
    "Patient identifier detected in API error response. Strip all patient-identifying fields from error bodies.",
   escalate: true,
  },
  DOSAGE_TYPE_ERROR: {
   patterns: [
    /dosage.*string/i,
    /expected number.*received string/i,
    /DOSAGE_TYPE_MISMATCH/,
   ],
   severity: "HIGH",
   recommendedAction:
    "Medication dosage returned as wrong type. Change hlt_medications.dosage column to REAL and cast on read.",
   escalate: true,
  },
  IDOR: {
   patterns: [/IDOR/i, /patient 1 accessed patient/i, /PATIENT_RECORDS_IDOR/],
   severity: "CRITICAL",
   recommendedAction:
    "Insecure direct object reference: patient records accessible without ownership check. Add `WHERE userId = ?` to all patient queries.",
   escalate: true,
  },
  WCAG_CRITICAL: {
   patterns: [/critical.*violation/i, /axe.*critical/i, /CANCEL_DIALOG_FOCUS_TRAP/],
   severity: "HIGH",
   recommendedAction:
    "Critical WCAG 2.1 violation detected. Block release. Add focus management to modal dialogs.",
   escalate: false,
  },
  DOUBLE_BOOKING: {
   patterns: [/double.?book/i, /concurrent.*appointment/i, /APPOINTMENT_DOUBLE_BOOKING/],
   severity: "HIGH",
   recommendedAction:
    "Concurrent appointment creation allows double-booking. Add a UNIQUE constraint on (doctorId, datetime) or use a SELECT FOR UPDATE check.",
   escalate: false,
  },
 },

 commerce: {
  OVERSELL: {
   patterns: [/inventory.*negative/i, /went to.*should be 0/i, /INVENTORY_OVERSELL_RACE/],
   severity: "HIGH",
   recommendedAction:
    "Concurrent checkout created negative inventory. Wrap inventory check and decrement in a single atomic transaction.",
   escalate: false,
  },
  CHECKOUT_BROKEN: {
   patterns: [/checkout.*failed/i, /payment.*500/i, /order.*not created/i],
   severity: "CRITICAL",
   recommendedAction:
    "Checkout flow failure detected. Direct revenue impact. Block release and investigate order creation endpoint.",
   escalate: true,
  },
  EMAIL_BEFORE_PAYMENT: {
   patterns: [/email.*before payment/i, /emailSent.*should be 0/i, /EMAIL_BEFORE_PAYMENT/],
   severity: "MEDIUM",
   recommendedAction:
    "Order confirmation email sent at order creation, before payment is confirmed. Move emailSent flag update to the payment endpoint.",
   escalate: false,
  },
  PRICE_DISPLAY: {
   patterns: [/too many decimal places/i, /19\.9999/i, /PRICE_FLOAT_PRECISION/],
   severity: "MEDIUM",
   recommendedAction:
    "Price display rounding error. Apply `parseFloat(price.toFixed(2))` at the API response layer.",
   escalate: false,
  },
  PROMO_STACKING: {
   patterns: [/duplicate promo/i, /stacking allowed/i, /PROMO_CODE_STACKING/],
   severity: "HIGH",
   recommendedAction:
    "Promotion code can be applied multiple times to same cart. Add a UNIQUE constraint on (cartId, promotionId) in com_cart_promotions.",
   escalate: false,
  },
  MOBILE_LAYOUT: {
   patterns: [/horizontal.*overflow/i, /scrollWidth.*390/i, /CHECKOUT_MOBILE_OVERFLOW/],
   severity: "MEDIUM",
   recommendedAction:
    "Horizontal scroll on mobile viewport. Add `max-width: 100%; overflow-x: hidden` to checkout container.",
   escalate: false,
  },
 },
};

export function classifyFailure(
 domain: string,
 errorMessage: string,
): FailurePattern | null {
 const taxonomy = DOMAIN_FAILURE_TAXONOMY[domain];
 if (!taxonomy) return null;

 for (const [, pattern] of Object.entries(taxonomy)) {
  if (pattern.patterns.some((p) => p.test(errorMessage))) {
   return pattern;
  }
 }

 return null;
}
