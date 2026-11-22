const { calculateCommission, resolveCommissionRate } = require('../src/services/commissionService');

const base = { excludeTaxFromCommission: false, taxRatePercent: 18, deductGatewayFees: false, gatewayFeePercent: 2, defaultCommissionRate: 50 };

describe('Commission calculation', () => {
  it('pays 50% of ₹2,000 = ₹1,000 by default', () => {
    const r = calculateCommission({ amount: 200000, rate: 50, settings: base });
    expect(r.eligibleNetRevenue).toBe(200000);
    expect(r.commissionAmount).toBe(100000);
    expect(r.grossAmount - r.commissionAmount).toBe(100000); // JenCorps share
  });

  it('excludes GST from eligible revenue when configured', () => {
    const r = calculateCommission({ amount: 118000, rate: 50, settings: { ...base, excludeTaxFromCommission: true } });
    expect(r.deductions.tax).toBe(18000);
    expect(r.eligibleNetRevenue).toBe(100000);
    expect(r.commissionAmount).toBe(50000);
  });

  it('deducts actual gateway fees, or the configured % when unknown', () => {
    const s = { ...base, deductGatewayFees: true };
    expect(calculateCommission({ amount: 200000, gatewayFee: 4720, rate: 50, settings: s }).eligibleNetRevenue).toBe(195280);
    expect(calculateCommission({ amount: 200000, rate: 50, settings: s }).deductions.gatewayFee).toBe(4000);
  });

  it('reduces eligible revenue by refunds and never goes negative', () => {
    expect(calculateCommission({ amount: 200000, refundedAmount: 50000, rate: 50, settings: base }).commissionAmount).toBe(75000);
    const full = calculateCommission({ amount: 200000, refundedAmount: 200000, gatewayFee: 4000, rate: 50, settings: { ...base, deductGatewayFees: true } });
    expect(full.eligibleNetRevenue).toBe(0);
    expect(full.commissionAmount).toBe(0);
  });

  it('rounds to whole paise', () => {
    expect(Number.isInteger(calculateCommission({ amount: 99999, rate: 33.3, settings: base }).commissionAmount)).toBe(true);
  });

  it('resolves rate precedence: influencer > workshop > default', () => {
    expect(resolveCommissionRate({ influencer: { commissionRate: 40 }, workshop: { commissionRate: 30 }, settings: base })).toBe(40);
    expect(resolveCommissionRate({ influencer: { commissionRate: null }, workshop: { commissionRate: 30 }, settings: base })).toBe(30);
    expect(resolveCommissionRate({ influencer: { commissionRate: null }, workshop: { commissionRate: null }, settings: base })).toBe(50);
    expect(resolveCommissionRate({ influencer: { commissionRate: 0 }, workshop: {}, settings: base })).toBe(0);
  });
});
