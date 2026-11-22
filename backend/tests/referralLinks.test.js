const env = require('../src/config/env');
const { referralUrlFor } = require('../src/services/influencerService');

describe('Referral link builder', () => {
  const original = { mode: env.referralLinkMode, url: env.frontendUrl };
  afterEach(() => {
    env.referralLinkMode = original.mode;
    env.frontendUrl = original.url;
  });

  it('builds subdomain links for a wildcard custom domain', () => {
    env.referralLinkMode = 'subdomain';
    env.frontendUrl = 'https://jencorps.com';
    expect(referralUrlFor('arun', 'INF-1001')).toBe('https://arun.jencorps.com');
    expect(referralUrlFor('arun', 'INF-1001', '/workshops/ai-video', { utm_source: 'instagram' })).toBe('https://arun.jencorps.com/workshops/ai-video?utm_source=instagram');
  });

  it('builds ?ref= links when subdomains are unavailable (e.g. *.vercel.app)', () => {
    env.referralLinkMode = 'query';
    env.frontendUrl = 'https://insta-connect.vercel.app';
    expect(referralUrlFor('arun', 'INF-1001')).toBe('https://insta-connect.vercel.app/?ref=INF-1001');
    expect(referralUrlFor('arun', 'INF-1001', '/workshops/ai-video', { utm_source: 'instagram', utm_campaign: 'CMP-X' })).toBe(
      'https://insta-connect.vercel.app/workshops/ai-video?ref=INF-1001&utm_source=instagram&utm_campaign=CMP-X'
    );
  });
});
