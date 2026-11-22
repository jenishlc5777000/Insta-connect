/**
 * Legal / policy pages shown at /policies/:slug and linked in the footer.
 * IMPORTANT: these are sensible starting drafts for an Indian online-education business.
 * Have them reviewed by your legal advisor and adjust the business rules
 * (refund windows, payout schedule, etc.) before going live.
 *
 * Content format: sections: [{ heading, paragraphs?: string[], list?: string[] }]
 */
import { company } from './company';

const C = company;
const email = (label) => C.contact.emails.find((e) => e.label === label)?.address;
const SUPPORT = email('Support') || 'support@jencorps.com';
const INFO = email('Enquiries') || 'info@jencorps.com';
const LEGAL_NAME = 'Jencorps Digital';
const ADDRESS = `${LEGAL_NAME}, ${C.contact.headquarters}, India`;

export const LAST_UPDATED = '22 November 2026';

export const policies = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    summary: 'What personal data we collect, why, how long we keep it and your rights under Indian law.',
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          `This website and its workshop and influencer services are operated by ${ADDRESS} ("JenCorps", "we", "us"). This policy explains how we handle your personal data in line with the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.`,
        ],
      },
      {
        heading: 'Data we collect',
        list: [
          'Registration details: your name, email address and phone number.',
          'Payment information: processed by our payment partner Razorpay. We receive a payment reference and status. We never see or store your card, UPI PIN or net-banking credentials.',
          'Referral data: which influencer link you used, campaign (UTM) tags and the date of your visit, so we can credit the right partner.',
          'Account data (if you create an account): login email and an encrypted password.',
          'Influencer partners: profile, Instagram handle, audience details you share, and payout details (bank account or UPI ID), which are stored encrypted.',
          'Technical data: device and browser information and a pseudonymised (hashed) IP address used for security and fraud prevention.',
        ],
      },
      {
        heading: 'Why we use it',
        list: [
          'To register you for workshops, take payment, send confirmations and share the live session link.',
          'To credit and pay commission to the influencer who referred you.',
          'To provide customer support and send important service messages.',
          'To prevent fraud, secure our platform and meet legal and tax obligations.',
          'To send workshop updates you have consented to; you can opt out at any time.',
        ],
      },
      {
        heading: 'Who we share it with',
        paragraphs: [
          'We do not sell your personal data. We share it only with service providers that help us run the platform (payment processing, cloud hosting, email delivery and file storage), under confidentiality obligations, and with authorities when required by law.',
          'Influencer partners see only your name and registration status for registrations made through their link, never your full email address, phone number or payment details.',
        ],
      },
      {
        heading: 'How long we keep it',
        paragraphs: [
          'We keep registration and payment records for as long as needed to provide the service and to meet accounting and tax requirements (generally up to 8 years). Marketing preferences are kept until you withdraw consent.',
        ],
      },
      {
        heading: 'Your rights',
        list: [
          'Access a summary of the personal data we hold about you.',
          'Correct or update inaccurate data.',
          'Request erasure of data we no longer need to keep.',
          'Withdraw consent for marketing communications.',
          'Nominate another person to exercise your rights in case of death or incapacity.',
          'Raise a grievance with us, and if unresolved, with the Data Protection Board of India.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'Data is transmitted over HTTPS, passwords are hashed, payout details are encrypted at rest and access is restricted to authorised staff. No system is perfectly secure, but we work to protect your data and will notify you as required by law in the event of a breach.',
        ],
      },
      {
        heading: 'Grievance officer',
        paragraphs: [`For any privacy request or complaint, write to ${SUPPORT} or call ${C.contact.phone}. We aim to respond within 7 working days.`],
      },
    ],
  },
  {
    slug: 'terms-and-conditions',
    title: 'Terms & Conditions',
    summary: 'The rules for using this website, registering for workshops and paying online.',
    sections: [
      {
        heading: 'Acceptance',
        paragraphs: [`By using this website or registering for a workshop you agree to these terms. The services are provided by ${ADDRESS}. If you do not agree, please do not use the website.`],
      },
      {
        heading: 'Workshop registration',
        list: [
          'Provide accurate name, email and phone details. Your seat is confirmed only after successful payment (or immediately for free workshops).',
          'Each registration is for one participant. Session links, recordings and materials are personal and must not be shared or resold.',
          'Workshop dates, timings, trainers and curriculum may change for reasons beyond our control; we will inform registered participants by email.',
        ],
      },
      {
        heading: 'Pricing and payment',
        list: [
          'Prices are shown in Indian Rupees (₹) and include applicable taxes unless stated otherwise.',
          'Payments are processed securely by Razorpay. A confirmation is sent once payment is verified.',
          'Discounts and offers are valid only for the period and conditions stated.',
        ],
      },
      {
        heading: 'Refunds',
        paragraphs: ['Refunds and cancellations are governed by our Refund & Cancellation Policy.'],
      },
      {
        heading: 'Code of conduct',
        list: [
          'Be respectful to trainers and other participants during live sessions and in community groups.',
          'Do not record, redistribute or publish workshop content without written permission.',
          'We may remove a participant who disrupts a session or violates these terms, without refund.',
        ],
      },
      {
        heading: 'Intellectual property',
        paragraphs: ['All workshop content, materials, prompt packs, recordings, logos and website content belong to JenCorps or its licensors and are provided for your personal learning only.'],
      },
      {
        heading: 'Third-party tools',
        paragraphs: ['Workshops may demonstrate third-party AI tools. Their availability, pricing and terms are set by those providers. You are responsible for complying with their terms and for content you create with them.'],
      },
      {
        heading: 'Limitation of liability',
        paragraphs: ['Workshops are educational. We do not guarantee specific results such as followers, views, income or employment. To the extent permitted by law, our total liability is limited to the amount you paid for the relevant workshop.'],
      },
      {
        heading: 'Governing law',
        paragraphs: ['These terms are governed by the laws of India. Courts in Tamil Nadu have exclusive jurisdiction over any dispute.'],
      },
      {
        heading: 'Contact',
        paragraphs: [`Questions about these terms: ${INFO} or ${C.contact.phone}.`],
      },
    ],
  },
  {
    slug: 'refund-policy',
    title: 'Refund & Cancellation Policy',
    summary: 'When you can cancel, how much is refunded and how long refunds take.',
    sections: [
      {
        heading: 'Cancellation by you',
        list: [
          'Cancel 7 days or more before the workshop start date: full refund.',
          'Cancel between 7 days and 72 hours before the start: 50% refund, or a free transfer to a future batch.',
          'Cancel less than 72 hours before the start, or after the workshop begins: no refund, but you may transfer your seat to another person by writing to support before the start time.',
        ],
      },
      {
        heading: 'Cancellation or rescheduling by JenCorps',
        paragraphs: ['If we cancel a workshop, you receive a full refund. If we reschedule, you may attend the new date or request a full refund.'],
      },
      {
        heading: 'Duplicate or failed payments',
        paragraphs: ['If you were charged twice, or money was deducted but your registration was not confirmed, contact us with your payment reference and we will refund the extra amount in full.'],
      },
      {
        heading: 'How to request a refund',
        paragraphs: [`Email ${SUPPORT} from your registered email address with your name, phone number and workshop name, or call ${C.contact.phone}.`],
      },
      {
        heading: 'Refund timelines',
        paragraphs: ['Approved refunds are processed within 2 working days and credited to your original payment method by Razorpay, usually within 5–7 working days depending on your bank.'],
      },
    ],
  },
  {
    slug: 'delivery-policy',
    title: 'Delivery Policy',
    summary: 'How the online workshop and its materials are delivered to you. No physical goods are shipped.',
    sections: [
      {
        heading: 'Digital service: no physical shipping',
        paragraphs: ['Our workshops are delivered live online. No physical product is shipped, and no shipping charges apply.'],
      },
      {
        heading: 'What you receive and when',
        list: [
          'Immediately after payment: an email confirmation and access to your registration page.',
          'Before the session: the live session link (also shown on your registration page).',
          'After the session: recordings and materials, where included, shared within 3 working days.',
        ],
      },
      {
        heading: 'Did not receive your access?',
        paragraphs: [`Check your spam folder first, then contact ${SUPPORT} or ${C.contact.phone} with your payment reference and we will resend it.`],
      },
    ],
  },
  {
    slug: 'cookie-policy',
    title: 'Cookie Policy',
    summary: 'The small number of cookies we use, and why.',
    sections: [
      {
        heading: 'What we use',
        paragraphs: ['We use a few first-party cookies that are essential for the website to work. We do not use advertising cookies or sell cookie data.'],
        list: [
          'Login cookies (jc_at, jc_rt): keep you signed in securely. These expire after 15 minutes and 7 days respectively.',
          'Referral cookie (jc_ref): remembers which influencer link you used, so the right partner is credited if you register later. Expires after 30 days.',
          'Session cookie (jc_sid): counts referral visits without double counting.',
          'Browser storage: remembers simple preferences, such as whether you have signed in on this device.',
        ],
      },
      {
        heading: 'Managing cookies',
        paragraphs: ['You can delete or block cookies in your browser settings. Blocking essential cookies may stop login and referral credit from working.'],
      },
    ],
  },
  {
    slug: 'partner-terms',
    title: 'Influencer Partner Terms',
    summary: 'The agreement for Instagram creators who promote JenCorps workshops and earn commission.',
    sections: [
      {
        heading: 'Joining the program',
        paragraphs: ['Applications are reviewed by JenCorps. Approval is at our discretion. Approved partners receive a personal referral link and dashboard access.'],
      },
      {
        heading: 'Commission',
        list: [
          'You earn the commission rate shown in your dashboard on the eligible amount of each paid registration made through your link.',
          'Commission is created only after the payment is verified. Pending commissions are reviewed and approved by JenCorps.',
          'If a registration is refunded, the related commission is reduced or reversed. Commission already paid on a refunded registration may be adjusted against future payouts.',
          'Attribution follows the first valid referral within the attribution window (30 days by default), as recorded by our system.',
        ],
      },
      {
        heading: 'Payouts',
        list: [
          'Approved commissions are paid to the bank account or UPI ID in your profile. Keep your payout details accurate.',
          'Applicable taxes (including TDS where required) may be deducted. You are responsible for your own tax filings.',
        ],
      },
      {
        heading: 'Promotion rules',
        list: [
          'Clearly disclose the partnership (for example #ad or "paid partnership") as required by ASCI guidelines.',
          'Do not make false or exaggerated claims, such as guaranteed income or results.',
          'Do not spam, use bots or fake traffic, or register through your own link to earn commission.',
          'Do not bid on JenCorps brand keywords in paid ads, or impersonate JenCorps.',
          'Use the official promotional materials provided in your dashboard where possible.',
        ],
      },
      {
        heading: 'Suspension and termination',
        paragraphs: ['Either party may end the partnership at any time. We may suspend accounts and withhold commission obtained through fraud or rule violations. Valid approved commissions earned before termination will be paid.'],
      },
      {
        heading: 'Contact',
        paragraphs: [`Partner questions: ${INFO} or ${C.contact.phone}.`],
      },
    ],
  },
];

export const findPolicy = (slug) => policies.find((p) => p.slug === slug);
export const policyContact = { support: SUPPORT, info: INFO, phone: C.contact.phone, phoneHref: C.contact.phoneHref, address: ADDRESS };
