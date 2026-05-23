/**
 * Razorpay TEST key for development (Dashboard → API Keys → Test mode).
 * Production builds should use live keys from secure config / CI secrets.
 */
export const RAZORPAY_TEST_KEY_ID =
  process.env.RAZORPAY_KEY_ID ?? 'rzp_test_mock';
