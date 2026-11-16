import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function collectVueFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectVueFiles(full));
    } else if (entry.name.endsWith('.vue')) {
      results.push(full);
    }
  }
  return results;
}

describe('Dashboard Sidebar & Scroll Containment', () => {
  const dashboardLayout = readFileSync(join(process.cwd(), 'layouts/dashboard.vue'), 'utf8');
  const tailwindCss = readFileSync(join(process.cwd(), 'assets/css/tailwind.css'), 'utf8');
  const settingsPage = readFileSync(join(process.cwd(), 'pages/dashboard/settings.vue'), 'utf8');
  const auditPage = readFileSync(join(process.cwd(), 'pages/dashboard/audit.vue'), 'utf8');
  const indexPage = readFileSync(join(process.cwd(), 'pages/dashboard/index.vue'), 'utf8');
  const reportsPage = readFileSync(join(process.cwd(), 'pages/dashboard/reports.vue'), 'utf8');
  const terminalsIndexPage = readFileSync(join(process.cwd(), 'pages/dashboard/terminals/index.vue'), 'utf8');
  const terminalDetailPage = readFileSync(join(process.cwd(), 'pages/dashboard/terminals/[id].vue'), 'utf8');
  const databasePage = readFileSync(join(process.cwd(), 'pages/dashboard/database.vue'), 'utf8');
  const builderPage = readFileSync(join(process.cwd(), 'pages/dashboard/builder.vue'), 'utf8');

  test('dashboard layout shell isolates positioning, viewport lock, and internal sidebar scrolling', () => {
    expect(dashboardLayout).toContain("htmlAttrs: { class: 'dashboard-viewport-lock' }");
    expect(dashboardLayout).toContain("bodyAttrs: { class: 'dashboard-viewport-lock' }");
    expect(tailwindCss).toContain('html.dashboard-viewport-lock');
    expect(tailwindCss).toContain('body.dashboard-viewport-lock');
    expect(tailwindCss).toContain('overflow: hidden;');
    expect(tailwindCss).toContain('overscroll-behavior: none;');
    expect(dashboardLayout).toContain('relative flex h-dvh w-full overflow-hidden overscroll-none');
    expect(dashboardLayout).toContain('dashboard-sidebar w-[200px] h-full min-h-0 flex flex-col shrink-0 overflow-hidden overscroll-contain');
    expect(dashboardLayout).toContain('<nav class="flex-1 min-h-0 overflow-y-auto overscroll-contain');
    expect(dashboardLayout).toContain('<main class="relative flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden"');
  });

  test('all dashboard pages contain positioned/sr-only elements inside relative min-h-0 scroll containers', () => {
    expect(settingsPage).toContain('class="relative flex-1 min-h-0 overflow-y-auto overscroll-contain"');
    expect(settingsPage).toContain('<section class="relative space-y-3">');
    expect(auditPage).toContain('class="dashboard-readable relative flex-1 min-h-0 overflow-y-auto overscroll-contain"');
    expect(auditPage).toContain('<div class="relative space-y-2.5">');
    expect(auditPage).toContain('<div class="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">');
    expect(indexPage).toContain('class="dashboard-page relative flex-1 min-h-0 overflow-y-auto overscroll-contain"');
    expect(reportsPage).toContain('class="reports-page relative flex-1 min-h-0 overflow-y-auto overscroll-contain font-sans"');
    expect(terminalsIndexPage).toContain('class="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-6"');
    expect(terminalDetailPage).toContain('class="terminal-settings-page relative flex-1 min-h-0 overflow-y-auto overscroll-contain"');
    expect(databasePage).toContain('class="relative flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden"');
    expect(databasePage).toContain('class="relative flex-1 min-h-0 overflow-auto overscroll-contain"');
    expect(databasePage).toContain('class="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1 px-2"');
    expect(builderPage).toContain('class="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-[#f6efe8]"');
    expect(builderPage).toContain('class="relative flex-1 min-h-0 flex overflow-hidden bg-[#e5dfd8]"');
  });

  test('every dashboard page with sr-only labels establishes a relative containing block inside its template', () => {
    const dashboardFiles = collectVueFiles(join(process.cwd(), 'pages/dashboard'));
    expect(dashboardFiles.length).toBeGreaterThanOrEqual(8);

    for (const filePath of dashboardFiles) {
      const content = readFileSync(filePath, 'utf8');
      if (content.includes('sr-only')) {
        expect(content).toMatch(/<div[^>]*\brelative\b[^>]*\boverflow-(?:y-)?auto\b/);
      }
    }
  });
});
