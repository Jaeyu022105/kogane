<script setup lang="ts">
import { Monitor, ShieldCheck, WifiOff, Users, ArrowRight, CheckCircle2 } from 'lucide-vue-next';

definePageMeta({ layout: 'marketing' });

useSeoMeta({
  title: 'Direct Station Access - Kogane',
  description: 'Direct local access for on-premise workstation terminals. No recurring SaaS subscriptions or cloud billing lockouts.',
});

const { isLoggedIn } = useAuth();

const workstationModels = [
  {
    name: 'Cashier Register',
    badge: 'Front Counter',
    description: 'Fast counter sales, order entry, custom ticket totals, receipt generation, and payment processing.',
    details: ['Table & queue management', 'Payment method logging', 'Instant receipt printing'],
  },
  {
    name: 'Inventory Manager',
    badge: 'Stock Operations',
    description: 'Stock level tracking, catalog synchronisation, inbound supply shipments, and receiving records.',
    details: ['Inbound stock logs', 'Reorder threshold alerts', 'Direct inventory ledger'],
  },
  {
    name: 'Kitchen Display',
    badge: 'Prep Line',
    description: 'Live order board and ticket queues for kitchen and prep staff to coordinate food & drink preparation.',
    details: ['Real-time status updates', 'Order fulfill actions', 'Dedicated pass-through display'],
  },
  {
    name: 'Catalog Registrar',
    badge: 'Product Desk',
    description: 'Dedicated catalog maintenance terminal for item descriptions, pricing, and category setup.',
    details: ['Item catalog registry', 'Price configuration', 'Category categorization'],
  },
  {
    name: 'Reports & Analytics',
    badge: 'Back Office',
    description: 'Full business sales ledgers, compliance records, tax audit views, and operational performance trends.',
    details: ['Audit logs & daily ledger', 'Sales forecast schedules', 'Tax compliance exports'],
  },
];
</script>

<template>
  <div class="pricing-page">
    <!-- Hero Section -->
    <section class="pricing-hero">
      <div class="m-inner pricing-hero-inner">
        <p class="m-overline">Offline Operations & Direct Access</p>
        <h1 class="m-heading-lg">
          No SaaS Subscriptions.<br>
          <em>Direct Local Station Access.</em>
        </h1>
        <p class="m-sub" style="margin: 0 auto; max-width: 680px;">
          Kogane is built for physical, on-site venues. Pay directly offline for your location setup and access your local workstations without recurring cloud paywalls or billing lockouts.
        </p>

        <div class="hero-cta-wrap">
          <NuxtLink v-if="isLoggedIn" to="/dashboard" class="m-btn-primary ribbon">
            Open Dashboard <ArrowRight class="w-4 h-4 ml-1" />
          </NuxtLink>
          <NuxtLink v-else to="/login?mode=signup" class="m-btn-primary ribbon">
            Set Up Your Workspace <ArrowRight class="w-4 h-4 ml-1" />
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Core Pillars -->
    <section class="section-pillars">
      <div class="m-inner">
        <div class="pillars-grid">
          <div class="pillar-card">
            <div class="pillar-icon-wrap">
              <ShieldCheck class="w-6 h-6 text-[#FF5776]" />
            </div>
            <h3 class="pillar-title">In-Person Offline Payment</h3>
            <p class="pillar-text">
              Direct offline payment handles your venue setup. No credit card recurring subscriptions, SaaS tiers, or unexpected surprise billing.
            </p>
          </div>

          <div class="pillar-card">
            <div class="pillar-icon-wrap">
              <WifiOff class="w-6 h-6 text-[#FF5776]" />
            </div>
            <h3 class="pillar-title">100% Local LAN Availability</h3>
            <p class="pillar-text">
              All terminals communicate seamlessly across your local premises network. If external internet drops, your business operations and cash registers never stop.
            </p>
          </div>

          <div class="pillar-card">
            <div class="pillar-icon-wrap">
              <Users class="w-6 h-6 text-[#FF5776]" />
            </div>
            <h3 class="pillar-title">Unlimited Workstations</h3>
            <p class="pillar-text">
              Equip your front counters, kitchen passes, back stockrooms, and audit desks. No artificial per-terminal license caps or seat paywalls.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Workstations Section -->
    <section class="section-workstations">
      <div class="m-inner">
        <div class="section-header text-center">
          <p class="m-overline">Included Workstations</p>
          <h2 class="m-heading-md">Equip Your Entire Floor</h2>
          <p class="m-sub" style="margin: 0 auto; max-width: 580px;">
            Every standard on-site installation includes full configuration for all 5 official workstation roles.
          </p>
        </div>

        <div class="workstations-grid">
          <div
            v-for="station in workstationModels"
            :key="station.name"
            class="station-card"
          >
            <div class="station-header">
              <div class="station-icon">
                <Monitor class="w-5 h-5 text-[#68293A]" />
              </div>
              <span class="station-badge">{{ station.badge }}</span>
            </div>
            <h3 class="station-name">{{ station.name }}</h3>
            <p class="station-desc">{{ station.description }}</p>
            <ul class="station-details">
              <li v-for="d in station.details" :key="d" class="station-detail-item">
                <CheckCircle2 class="w-4 h-4 text-[#FF5776] shrink-0" />
                <span>{{ d }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom CTA -->
    <section class="m-cta-strip">
      <div class="m-cta-inner">
        <h2 class="m-cta-heading">Ready to configure your venue?</h2>
        <p class="m-cta-sub">
          Launch your local workspace, configure terminals, and share LAN links with staff instantly.
        </p>
        <div class="m-cta-btns">
          <NuxtLink v-if="isLoggedIn" to="/dashboard/terminals" class="m-btn-primary ribbon">
            Manage Workstations
          </NuxtLink>
          <NuxtLink v-else to="/login?mode=signup" class="m-btn-primary ribbon">
            Get Started Now
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pricing-page {
  padding-bottom: 4rem;
}

.pricing-hero {
  padding: 6rem 0 4rem;
  text-align: center;
  background: radial-gradient(ellipse at 50% 20%, rgba(255, 87, 118, 0.08) 0%, transparent 70%);
}

.hero-cta-wrap {
  margin-top: 2.5rem;
  display: flex;
  justify-content: center;
}

.section-pillars {
  padding: 3rem 0 4rem;
}

.pillars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.pillar-card {
  padding: 2rem;
  border-radius: 1.25rem;
  background: #ffffff;
  border: 1px solid rgba(61, 24, 32, 0.08);
  box-shadow: 0 4px 16px rgba(61, 24, 32, 0.03);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.pillar-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(61, 24, 32, 0.06);
}

.pillar-icon-wrap {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  background: rgba(255, 87, 118, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.pillar-title {
  font-family: 'DM Serif Display', serif;
  font-size: 1.25rem;
  color: #68293A;
  margin-bottom: 0.5rem;
}

.pillar-text {
  font-size: 0.92rem;
  line-height: 1.6;
  color: rgba(61, 24, 32, 0.65);
  margin: 0;
}

.section-workstations {
  padding: 4rem 0;
}

.section-header {
  margin-bottom: 3rem;
}

.workstations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.station-card {
  padding: 1.75rem;
  border-radius: 1.25rem;
  background: #ffffff;
  border: 1px solid rgba(61, 24, 32, 0.08);
  box-shadow: 0 4px 12px rgba(61, 24, 32, 0.02);
  display: flex;
  flex-direction: column;
}

.station-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.station-icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.6rem;
  background: rgba(104, 41, 58, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.station-badge {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.25rem 0.6rem;
  border-radius: 99px;
  background: rgba(104, 41, 58, 0.06);
  color: #68293A;
}

.station-name {
  font-family: 'DM Serif Display', serif;
  font-size: 1.25rem;
  color: #68293A;
  margin: 0 0 0.5rem;
}

.station-desc {
  font-size: 0.88rem;
  line-height: 1.55;
  color: rgba(61, 24, 32, 0.6);
  margin: 0 0 1.25rem;
  flex-grow: 1;
}

.station-details {
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid rgba(61, 24, 32, 0.06);
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.station-detail-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.84rem;
  color: rgba(61, 24, 32, 0.75);
}

.m-cta-strip {
  background: linear-gradient(135deg, #68293A 0%, #4A1A27 100%);
  border-radius: 1.5rem;
  padding: 4rem 2rem;
  text-align: center;
  color: #ffffff;
  margin-top: 4rem;
}

.m-cta-heading {
  font-family: 'DM Serif Display', serif;
  font-size: 2.25rem;
  margin-bottom: 0.75rem;
}

.m-cta-sub {
  font-size: 1.05rem;
  opacity: 0.85;
  max-width: 600px;
  margin: 0 auto 2rem;
}

.m-cta-btns {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.m-btn-primary {
  display: inline-flex;
  align-items: center;
  padding: 0.85rem 1.75rem;
  border-radius: 0.75rem;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  background: #FF5776;
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(255, 87, 118, 0.35);
  transition: all 0.2s ease;
}

.m-btn-primary:hover {
  background: #fa4264;
  transform: translateY(-1px);
}
</style>
