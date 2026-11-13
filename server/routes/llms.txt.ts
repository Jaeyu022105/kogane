import { defineEventHandler, setResponseHeader } from 'h3';
import { resolveServerSiteOrigin } from '../middleware/seoHeaders';

export default defineEventHandler((event) => {
  const origin = resolveServerSiteOrigin(event);
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=3600');

  return [
    '# Kogane',
    '',
    '> Kogane is a lightweight managed Terminal Builder SaaS for everyday businesses (cafes, retail shops, logistics teams, clinics, contractors, and accounting desks). Instead of paying an agency once for custom software that goes stale and shows outdated data, businesses configure UI presets once on Kogane—when Kogane ships one platform improvement, every connected terminal updates automatically.',
    '',
    '## Core Pages',
    '',
    `- [Home](${origin}/): Interactive Terminal Builder overview, live preset explorer, and automatic release sync`,
    `- [Features](${origin}/features): Guided onboarding, industry schemas, visual Terminal Builder, role-scoped links, and audit history`,
    `- [Pricing](${origin}/pricing): Transparent SaaS plans for solo operators, multi-station teams, and multi-site businesses`,
    `- [Sitemap](${origin}/sitemap.xml): Canonical XML sitemap of public marketing and legal routes`,
    '',
    '## Built-in Terminal Presets',
    '',
    '- Cashier Station (`cashier-station`): Front-counter sales register, payment methods, receipt printing, and open orders queue',
    '- Catalog Registrar (`catalog-station`): Product and menu creation, pricing, categories, and live catalog lookup',
    '- Inventory Station (`inventory-station`): Stock level monitoring, restock counts, and inventory visualizations',
    '- Kitchen Display (`kitchen-station`): Live back-of-house ticket queue synced with counter orders',
    '- Reports Station (`reports-station`): Read-only sales ledgers, charts, and activity audit feed',
    '- Dispatch & Delivery Console (`dispatch-station`): Courier waybill intake, barcode tracking scan, and delivery status board',
    '- Billing & Ledger Desk (`billing-station`): Client invoice creation, expense logging, and spend breakdown',
    '- Appointments & Intake Desk (`appointment-station`): Front-desk scheduling and check-in queue for clinics, salons, and repair desks',
    '- Directory & Roster Desk (`directory-station`): Client, patient, student, loyalty member, and staff roster records',
    '',
    '## Pricing Overview',
    '',
    '- **Starter ($0 / mo)**: 1 active terminal, core presets, local and cloud testing, community updates',
    '- **Business ($15 / mo monthly, $12 / mo billed annually)**: Up to 5 connected terminals, automatic preset updates, custom presets, full audit log history, real-time sync across devices, plus $5 / mo per extra terminal',
    '- **Multi-Site / Team ($49 / mo monthly, $39 / mo billed annually)**: Unlimited workspaces and terminals across branches, shared custom preset library, priority preset rollouts, CSV/JSON audit exports, and role permissions',
    '',
    '## Platform Capabilities',
    '',
    '- Guided workspace setup for industry tables, currency, brand theme, and starter terminals',
    '- Visual Terminal Builder with bound tables, forms, cart registers, barcode scanners, charts, and modals',
    '- Custom business-scoped presets that propagate layout and permission improvements across linked terminals',
    '- Role-scoped staff PIN access (`/terminal/[id]`) and public kiosk/table ordering links (`/t/[slug]`)',
    '- Full compliance audit log with diff inspection and CSV/JSON exports',
    '- Multi-language interface: English (`en`), Filipino (`ph`/`fil`), Spanish (`es`), Japanese (`ja`), Korean (`ko`), and Chinese (`zh`)',
    '',
    '## Policies',
    '',
    `- [Privacy Policy](${origin}/privacy): How Kogane handles account, workspace, and terminal operational data`,
    `- [Terms of Service](${origin}/terms): Service license, plan terms, and acceptable use`,
    '',
  ].join('\n');
});
