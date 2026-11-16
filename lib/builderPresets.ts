import { cloneLayout, normalizeLayout, DEFAULT_LAYOUT_THEME, type UiLayout } from '~/lib/uiTypes';
import {
  DEFAULT_TERMINAL_PERMISSIONS,
  normalizePermissions,
  presetByRoleOrKey,
  type PermissionPresetKey,
  type TerminalPermissions,
} from '~/lib/permissions';
import { validateTableDef, type SchemaDef, type TableDef } from '~/lib/schemaUtils';
import { sanitizeTextInput, validateAndSanitizeRecord } from '~/lib/securityClient';
import { applyBrandingToLayout, mergeTerminalBrandConfig, type WorkspaceBrandConfig } from '~/lib/workspaceBranding';

export interface BuilderPreset {
  id: string;
  presetKey: PermissionPresetKey;
  category: 'core' | 'industry';
  presetVersion: number;
  name: string;
  description: string;
  icon: string;
  layout: UiLayout;
}

export const BUILDER_PRESETS: BuilderPreset[] = [
  {
    id: 'cashier-station',
    presetKey: 'cashier-register',
    category: 'core',
    presetVersion: 1,
    name: 'Cashier Station',
    description: 'Registrar-style selling screen with a sale panel and open orders queue.',
    icon: 'monitor',
    layout: {
      version: 2,
      resolution: { width: 1280, height: 720 },
      modals: [],
      elements: [
        {
          id: 'cashier-title',
          type: 'text',
          label: 'title',
          position: { x: 40, y: 28, width: 420, height: 44, zIndex: 1 },
          content: 'Front Counter',
          fontSize: 30,
          fontWeight: 'bold',
          color: '#ffffff',
          align: 'left',
        },
        {
          id: 'cashier-subtitle',
          type: 'text',
          label: 'subtitle',
          position: { x: 40, y: 66, width: 560, height: 26, zIndex: 1 },
          content: 'Ring up orders quickly while keeping the queue visible.',
          fontSize: 14,
          fontWeight: 'normal',
          color: 'rgba(255,255,255,0.6)',
          align: 'left',
        },
        {
          id: 'cashier-sale-panel',
          type: 'cart-widget',
          label: 'sale panel',
          position: { x: 40, y: 108, width: 800, height: 572, zIndex: 2 },
          title: 'Cashier Register',
          subtitle: 'Tap products, assign a table number, confirm payment, and submit the current order.',
          productTable: 'products',
          displayColumns: ['name', 'category'],
          priceColumn: 'price',
          orderTable: 'orders',
          submitLabel: 'Submit Order',
          emptyLabel: 'No products are ready for sale yet. Add them from the Catalog or Inventory terminal first.',
          paymentMethods: ['cash', 'card', 'gcash'],
          defaultPaymentMethod: 'cash',
          enableCardReader: true,
          cardReaderMode: 'manual',
          cardReaderProvider: 'External Reader',
          cardReaderLabel: 'Counter Reader',
          enableReceiptPrinting: true,
          receiptTitle: 'Official Receipt',
          receiptFooter: 'Thank you for dining with us.',
          backgroundColor: '#161116',
          panelColor: 'rgba(255,255,255,0.04)',
          textColor: '#f5ede4',
          accentColor: '#e8748a',
          borderColor: 'rgba(255,255,255,0.08)',
          radius: 26,
        },
        {
          id: 'cashier-open-orders',
          type: 'table-view',
          label: 'open orders',
          position: { x: 864, y: 108, width: 376, height: 572, zIndex: 2 },
          source: 'business-table',
          title: 'Open Orders',
          subtitle: 'What the station still needs to finish.',
          tableName: 'orders',
          columns: ['id', 'table_number', 'total', 'status'],
          pageSize: 14,
          striped: true,
          backgroundColor: '#161116',
          headerBackgroundColor: 'rgba(255,255,255,0.06)',
          textColor: '#f5ede4',
        },
      ],
    },
  },
  {
    id: 'catalog-station',
    presetKey: 'catalog-registrar',
    category: 'core',
    presetVersion: 1,
    name: 'Catalog Registrar',
    description: 'Dedicated product-entry screen for creating sellable items and checking the live catalog before they reach the cashier.',
    icon: 'database',
    layout: {
      version: 2,
      resolution: { width: 1280, height: 720 },
      modals: [],
      elements: [
        {
          id: 'catalog-title',
          type: 'text',
          label: 'title',
          position: { x: 40, y: 28, width: 520, height: 44, zIndex: 1 },
          content: 'Catalog Registrar',
          fontSize: 30,
          fontWeight: 'bold',
          color: '#ffffff',
          align: 'left',
        },
        {
          id: 'catalog-subtitle',
          type: 'text',
          label: 'subtitle',
          position: { x: 40, y: 66, width: 620, height: 26, zIndex: 1 },
          content: 'Create products here, then the cashier register can sell them immediately.',
          fontSize: 14,
          fontWeight: 'normal',
          color: 'rgba(255,255,255,0.6)',
          align: 'left',
        },
        {
          id: 'catalog-product-name',
          type: 'input-field',
          label: 'product name',
          position: { x: 40, y: 116, width: 220, height: 56, zIndex: 2 },
          fieldName: 'name',
          placeholder: 'Product name',
          inputType: 'text',
          backgroundColor: 'rgba(255,255,255,0.06)',
          textColor: '#f5ede4',
          borderColor: 'rgba(255,255,255,0.12)',
          radius: 16,
        },
        {
          id: 'catalog-product-description',
          type: 'input-field',
          label: 'product description',
          position: { x: 276, y: 116, width: 220, height: 56, zIndex: 2 },
          fieldName: 'description',
          placeholder: 'Short description',
          inputType: 'text',
          backgroundColor: 'rgba(255,255,255,0.06)',
          textColor: '#f5ede4',
          borderColor: 'rgba(255,255,255,0.12)',
          radius: 16,
        },
        {
          id: 'catalog-product-category',
          type: 'input-field',
          label: 'product category',
          position: { x: 40, y: 188, width: 220, height: 56, zIndex: 2 },
          fieldName: 'category',
          placeholder: 'Category',
          inputType: 'select',
          options: ['Food', 'Beverage', 'Service', 'Supplies'],
          backgroundColor: 'rgba(255,255,255,0.06)',
          textColor: '#f5ede4',
          borderColor: 'rgba(255,255,255,0.12)',
          radius: 16,
        },
        {
          id: 'catalog-product-price',
          type: 'input-field',
          label: 'product price',
          position: { x: 276, y: 188, width: 220, height: 56, zIndex: 2 },
          fieldName: 'price',
          placeholder: 'Price',
          inputType: 'number',
          backgroundColor: 'rgba(255,255,255,0.06)',
          textColor: '#f5ede4',
          borderColor: 'rgba(255,255,255,0.12)',
          radius: 16,
        },
        {
          id: 'catalog-product-submit',
          type: 'button',
          label: 'add product',
          position: { x: 40, y: 268, width: 456, height: 58, zIndex: 2 },
          text: 'Add Product',
          variant: 'primary',
          backgroundColor: '#e8748a',
          textColor: '#ffffff',
          radius: 18,
          events: [
            {
              trigger: 'click',
              action: {
                type: 'insert',
                table: 'products',
                payload: {
                  name: '$$input.catalog-product-name',
                  description: '$$input.catalog-product-description',
                  category: '$$input.catalog-product-category',
                  price: '$$input.catalog-product-price',
                },
              },
            },
          ],
        },
        {
          id: 'catalog-products-table',
          type: 'table-view',
          label: 'product catalog',
          position: { x: 536, y: 116, width: 704, height: 520, zIndex: 2 },
          source: 'business-table',
          title: 'Product Catalog',
          subtitle: 'Items available for cashier and other staff terminals.',
          tableName: 'products',
          columns: ['name', 'category', 'description', 'price', 'available'],
          pageSize: 12,
          striped: true,
          emptyLabel: 'No products have been added yet.',
          backgroundColor: '#161116',
          headerBackgroundColor: 'rgba(255,255,255,0.06)',
          textColor: '#f5ede4',
        },
        {
          id: 'catalog-lookup-title',
          type: 'text',
          label: 'lookup title',
          position: { x: 40, y: 360, width: 320, height: 30, zIndex: 2 },
          content: 'Quick Lookup',
          fontSize: 18,
          fontWeight: 'semibold',
          color: '#ffffff',
          align: 'left',
        },
        {
          id: 'catalog-lookup-name',
          type: 'input-field',
          label: 'lookup name',
          position: { x: 40, y: 400, width: 220, height: 52, zIndex: 2 },
          fieldName: 'lookup_name',
          placeholder: 'Exact product name',
          inputType: 'text',
          backgroundColor: 'rgba(255,255,255,0.06)',
          textColor: '#f5ede4',
          borderColor: 'rgba(255,255,255,0.12)',
          radius: 16,
        },
        {
          id: 'catalog-lookup-button',
          type: 'button',
          label: 'lookup button',
          position: { x: 276, y: 400, width: 220, height: 52, zIndex: 2 },
          text: 'Search Catalog',
          variant: 'secondary',
          backgroundColor: 'rgba(255,255,255,0.10)',
          textColor: '#f5ede4',
          radius: 16,
          events: [
            {
              trigger: 'click',
              action: {
                type: 'query',
                source: 'business-table',
                table: 'products',
                columns: ['name', 'category', 'description', 'price', 'available'],
                where: {
                  name: '$$input.catalog-lookup-name',
                },
                targetElementId: 'catalog-products-table',
                limit: 10,
              },
            },
          ],
        },
      ],
    },
  },
  {
    id: 'inventory-station',
    presetKey: 'inventory-manager',
    category: 'core',
    presetVersion: 1,
    name: 'Inventory Station',
    description: 'Operations view for stock counts, updates, and restock visibility.',
    icon: 'list',
    layout: {
      version: 2,
      resolution: { width: 1280, height: 720 },
      modals: [],
      elements: [
        {
          id: 'inventory-title',
          type: 'text',
          label: 'title',
          position: { x: 40, y: 28, width: 520, height: 44, zIndex: 1 },
          content: 'Inventory Control',
          fontSize: 30,
          fontWeight: 'bold',
          color: '#ffffff',
          align: 'left',
        },
        {
          id: 'inventory-table',
          type: 'table-view',
          label: 'inventory overview',
          position: { x: 40, y: 96, width: 760, height: 540, zIndex: 2 },
          source: 'business-table',
          title: 'Inventory Overview',
          subtitle: 'Monitor quantity, units, and reorder thresholds.',
          tableName: 'inventory',
          columns: ['item_name', 'quantity', 'unit', 'reorder_at'],
          pageSize: 12,
          striped: true,
          backgroundColor: '#161116',
          headerBackgroundColor: 'rgba(255,255,255,0.06)',
          textColor: '#f5ede4',
        },
        {
          id: 'inventory-chart',
          type: 'chart',
          label: 'stock chart',
          position: { x: 824, y: 96, width: 416, height: 260, zIndex: 2 },
          source: 'business-table',
          title: 'Stock Levels',
          subtitle: 'Fast visual comparison of available stock.',
          chartType: 'bar',
          aggregation: 'sum',
          tableName: 'inventory',
          labelColumn: 'item_name',
          valueColumn: 'quantity',
          backgroundColor: '#161116',
          textColor: '#f5ede4',
          colorPalette: ['#e8748a', '#10b981', '#0ea5e9'],
        },
        {
          id: 'inventory-upload',
          type: 'upload',
          label: 'inventory upload',
          position: { x: 824, y: 380, width: 416, height: 120, zIndex: 2 },
          bucket: 'products',
          buttonLabel: 'Upload Stock Sheet',
          pathTemplate: 'inventory/{{date}}.csv',
          accept: ['.csv', '.xlsx'],
          backgroundColor: 'rgba(255,255,255,0.05)',
          textColor: '#f5ede4',
          borderColor: 'rgba(255,255,255,0.18)',
          radius: 20,
        },
      ],
    },
  },
  {
    id: 'kitchen-station',
    presetKey: 'kitchen-display',
    category: 'core',
    presetVersion: 1,
    name: 'Kitchen Display',
    description: 'Back-of-house order board that refreshes automatically as the cashier sends new tickets.',
    icon: 'monitor',
    layout: {
      version: 2,
      resolution: { width: 1280, height: 720 },
      modals: [],
      elements: [
        {
          id: 'kitchen-title',
          type: 'text',
          label: 'title',
          position: { x: 40, y: 28, width: 520, height: 44, zIndex: 1 },
          content: 'Kitchen Queue',
          fontSize: 30,
          fontWeight: 'bold',
          color: '#ffffff',
          align: 'left',
        },
        {
          id: 'kitchen-subtitle',
          type: 'text',
          label: 'subtitle',
          position: { x: 40, y: 66, width: 760, height: 26, zIndex: 1 },
          content: 'New cashier orders appear here automatically so the back-of-house can start preparation right away.',
          fontSize: 14,
          fontWeight: 'normal',
          color: 'rgba(255,255,255,0.6)',
          align: 'left',
        },
        {
          id: 'kitchen-orders-board',
          type: 'table-view',
          label: 'kitchen orders',
          position: { x: 40, y: 108, width: 1200, height: 560, zIndex: 2 },
          source: 'business-table',
          title: 'Incoming Orders',
          subtitle: 'Auto-refreshes every few seconds while the station is open.',
          tableName: 'orders',
          columns: ['created_at', 'table_number', 'items', 'status', 'total'],
          pageSize: 20,
          autoRefreshMs: 3000,
          orderBy: 'created_at',
          descending: true,
          striped: true,
          emptyLabel: 'No orders have reached the kitchen yet.',
          backgroundColor: '#161116',
          headerBackgroundColor: 'rgba(255,255,255,0.06)',
          textColor: '#f5ede4',
        },
      ],
    },
  },
  {
    id: 'reports-station',
    presetKey: 'reports-viewer',
    category: 'core',
    presetVersion: 1,
    name: 'Reports Station',
    description: 'Read-only reporting screen with audit feed and activity charts.',
    icon: 'chart',
    layout: {
      version: 2,
      resolution: { width: 1280, height: 720 },
      modals: [],
      elements: [
        {
          id: 'reports-title',
          type: 'text',
          label: 'title',
          position: { x: 40, y: 28, width: 420, height: 44, zIndex: 1 },
          content: 'Operations Reports',
          fontSize: 30,
          fontWeight: 'bold',
          color: '#ffffff',
          align: 'left',
        },
        {
          id: 'reports-chart',
          type: 'chart',
          label: 'action breakdown',
          position: { x: 40, y: 96, width: 520, height: 280, zIndex: 2 },
          source: 'audit-log',
          title: 'Action Breakdown',
          subtitle: 'Count actions by type across the audit trail.',
          chartType: 'bar',
          aggregation: 'count',
          labelColumn: 'action_type',
          backgroundColor: '#161116',
          textColor: '#f5ede4',
          colorPalette: ['#e8748a', '#0ea5e9', '#10b981'],
        },
        {
          id: 'reports-table',
          type: 'table-view',
          label: 'activity feed',
          position: { x: 584, y: 96, width: 656, height: 540, zIndex: 2 },
          source: 'audit-log',
          title: 'Activity Feed',
          subtitle: 'Review who changed what and when.',
          columns: ['created_at', 'actor_name', 'action_type', 'target_table'],
          pageSize: 16,
          striped: true,
          backgroundColor: '#161116',
          headerBackgroundColor: 'rgba(255,255,255,0.06)',
          textColor: '#f5ede4',
        },
        {
          id: 'reports-trend',
          type: 'chart',
          label: 'target table trend',
          position: { x: 40, y: 396, width: 520, height: 240, zIndex: 2 },
          source: 'audit-log',
          title: 'Target Table Trend',
          subtitle: 'Which tables are receiving the most activity.',
          chartType: 'pie',
          aggregation: 'count',
          labelColumn: 'target_table',
          backgroundColor: '#161116',
          textColor: '#f5ede4',
          colorPalette: ['#f59e0b', '#e8748a', '#0ea5e9', '#10b981'],
        },
      ],
    },
  },
];

/**
 * Specialized builder station layouts for non-restaurant industries
 * (Logistics, Accounting, Retail, Clinic, Services, Education, Operations).
 */
export const INDUSTRY_BUILDER_PRESETS: BuilderPreset[] = [
  {
    id: 'dispatch-station',
    presetKey: 'dispatch-console',
    category: 'industry',
    presetVersion: 1,
    name: 'Dispatch & Delivery Console',
    description: 'Logistics & courier console with barcode tracking scan, waybill intake, and live delivery board.',
    icon: 'monitor',
    layout: {
      version: 2,
      resolution: { width: 1280, height: 720 },
      theme: { ...DEFAULT_LAYOUT_THEME, canvasBackground: '#0f172a' },
      elements: [
        {
          id: 'dispatch-title',
          type: 'text',
          label: 'title',
          position: { x: 40, y: 28, width: 560, height: 36, zIndex: 1 },
          content: 'Dispatch & Delivery Console',
          fontSize: 28,
          fontWeight: 'bold',
          color: '#f8fafc',
          align: 'left',
        },
        {
          id: 'dispatch-subtitle',
          type: 'text',
          label: 'subtitle',
          position: { x: 40, y: 66, width: 640, height: 26, zIndex: 1 },
          content: 'Scan waybills, assign couriers, and track active shipments.',
          fontSize: 13,
          fontWeight: 'normal',
          color: 'rgba(248,250,252,0.7)',
          align: 'left',
        },
        {
          id: 'dispatch-scan',
          type: 'scan-field',
          label: 'waybill scan',
          position: { x: 40, y: 108, width: 456, height: 48, zIndex: 2 },
          fieldName: 'tracking_code',
          placeholder: 'Scan tracking barcode to look up shipment…',
          burstThresholdMs: 40,
          radius: 14,
          events: [
            {
              id: 'dispatch-scan-lookup',
              trigger: 'input:commit',
              action: {
                type: 'query',
                table: 'deliveries',
                columns: ['tracking_code', 'origin', 'destination', 'driver_name', 'status'],
                where: { tracking_code: '$$input.dispatch-scan' },
                targetElementId: 'dispatch-table',
                limit: 25,
              },
            },
          ],
        },
        {
          id: 'dispatch-tracking',
          type: 'input-field',
          label: 'tracking code',
          position: { x: 40, y: 172, width: 220, height: 52, zIndex: 2 },
          fieldName: 'tracking_code',
          placeholder: 'Tracking code (TRK-1042)',
          inputType: 'text',
          radius: 14,
        },
        {
          id: 'dispatch-driver',
          type: 'input-field',
          label: 'driver name',
          position: { x: 276, y: 172, width: 220, height: 52, zIndex: 2 },
          fieldName: 'driver_name',
          placeholder: 'Driver / courier name',
          inputType: 'text',
          radius: 14,
        },
        {
          id: 'dispatch-origin',
          type: 'input-field',
          label: 'origin',
          position: { x: 40, y: 240, width: 220, height: 52, zIndex: 2 },
          fieldName: 'origin',
          placeholder: 'Origin warehouse / hub',
          inputType: 'text',
          radius: 14,
        },
        {
          id: 'dispatch-destination',
          type: 'input-field',
          label: 'destination',
          position: { x: 276, y: 240, width: 220, height: 52, zIndex: 2 },
          fieldName: 'destination',
          placeholder: 'Destination address',
          inputType: 'text',
          radius: 14,
        },
        {
          id: 'dispatch-status',
          type: 'input-field',
          label: 'status',
          position: { x: 40, y: 308, width: 456, height: 52, zIndex: 2 },
          fieldName: 'status',
          inputType: 'select',
          defaultValue: 'pending',
          options: ['pending', 'dispatched', 'in_transit', 'delivered'],
          radius: 14,
        },
        {
          id: 'dispatch-submit',
          type: 'button',
          label: 'create waybill',
          position: { x: 40, y: 376, width: 456, height: 54, zIndex: 2 },
          text: 'Create Waybill',
          variant: 'primary',
          backgroundColor: '#8b5cf6',
          textColor: '#ffffff',
          radius: 14,
          events: [
            {
              id: 'dispatch-insert',
              trigger: 'click',
              action: {
                type: 'insert',
                table: 'deliveries',
                payload: {
                  tracking_code: '$$input.dispatch-tracking',
                  origin: '$$input.dispatch-origin',
                  destination: '$$input.dispatch-destination',
                  driver_name: '$$input.dispatch-driver',
                  status: '$$input.dispatch-status',
                },
                onSuccess: {
                  type: 'query',
                  table: 'deliveries',
                  columns: ['tracking_code', 'origin', 'destination', 'driver_name', 'status'],
                  targetElementId: 'dispatch-table',
                  limit: 25,
                  orderBy: 'created_at',
                  descending: true,
                },
              },
            },
          ],
        },
        {
          id: 'dispatch-table',
          type: 'table-view',
          label: 'delivery queue',
          position: { x: 520, y: 108, width: 720, height: 560, zIndex: 2 },
          source: 'business-table',
          title: 'Active Deliveries',
          subtitle: 'Live courier assignments and transit statuses.',
          tableName: 'deliveries',
          columns: ['tracking_code', 'origin', 'destination', 'driver_name', 'status'],
          pageSize: 12,
          autoRefreshMs: 5000,
          orderBy: 'created_at',
          descending: true,
          backgroundColor: '#1e293b',
          headerBackgroundColor: 'rgba(139,92,246,0.14)',
          textColor: '#f8fafc',
          striped: true,
        },
      ],
    },
  },
  {
    id: 'billing-station',
    presetKey: 'billing-ledger',
    category: 'industry',
    presetVersion: 1,
    name: 'Billing & Ledger Desk',
    description: 'Accounting & finance workstation for issuing client invoices, recording expenses, and watching spend mix.',
    icon: 'chart',
    layout: {
      version: 2,
      resolution: { width: 1280, height: 720 },
      theme: { ...DEFAULT_LAYOUT_THEME, canvasBackground: '#0f1715' },
      elements: [
        {
          id: 'billing-title',
          type: 'text',
          label: 'title',
          position: { x: 40, y: 28, width: 540, height: 36, zIndex: 1 },
          content: 'Billing & Ledger Desk',
          fontSize: 28,
          fontWeight: 'bold',
          color: '#ecfdf5',
          align: 'left',
        },
        {
          id: 'billing-subtitle',
          type: 'text',
          label: 'subtitle',
          position: { x: 40, y: 66, width: 680, height: 26, zIndex: 1 },
          content: 'Issue invoices, log operating expenses, and reconcile your receivables.',
          fontSize: 13,
          fontWeight: 'normal',
          color: 'rgba(236,253,245,0.7)',
          align: 'left',
        },
        {
          id: 'billing-inv-number',
          type: 'input-field',
          label: 'invoice number',
          position: { x: 40, y: 108, width: 210, height: 48, zIndex: 2 },
          fieldName: 'invoice_number',
          placeholder: 'Invoice # (INV-1001)',
          inputType: 'text',
          radius: 12,
        },
        {
          id: 'billing-inv-client',
          type: 'input-field',
          label: 'client name',
          position: { x: 262, y: 108, width: 210, height: 48, zIndex: 2 },
          fieldName: 'client_name',
          placeholder: 'Client / payer name',
          inputType: 'text',
          radius: 12,
        },
        {
          id: 'billing-inv-date',
          type: 'input-field',
          label: 'issue date',
          position: { x: 40, y: 168, width: 210, height: 48, zIndex: 2 },
          fieldName: 'issue_date',
          placeholder: 'Issue date',
          inputType: 'date',
          radius: 12,
        },
        {
          id: 'billing-inv-amount',
          type: 'input-field',
          label: 'invoice total',
          position: { x: 262, y: 168, width: 210, height: 48, zIndex: 2 },
          fieldName: 'total_amount',
          placeholder: 'Total amount',
          inputType: 'number',
          radius: 12,
        },
        {
          id: 'billing-inv-submit',
          type: 'button',
          label: 'issue invoice',
          position: { x: 40, y: 230, width: 432, height: 48, zIndex: 2 },
          text: 'Issue Invoice',
          variant: 'primary',
          backgroundColor: '#10b981',
          textColor: '#ffffff',
          radius: 12,
          events: [
            {
              id: 'billing-insert-invoice',
              trigger: 'click',
              action: {
                type: 'insert',
                table: 'invoices',
                payload: {
                  invoice_number: '$$input.billing-inv-number',
                  client_name: '$$input.billing-inv-client',
                  issue_date: '$$input.billing-inv-date',
                  due_date: '$$input.billing-inv-date',
                  total_amount: '$$input.billing-inv-amount',
                  paid: 0,
                },
                onSuccess: {
                  type: 'query',
                  table: 'invoices',
                  columns: ['invoice_number', 'client_name', 'issue_date', 'total_amount', 'paid'],
                  targetElementId: 'billing-invoices-table',
                  limit: 20,
                  orderBy: 'created_at',
                  descending: true,
                },
              },
            },
          ],
        },
        {
          id: 'billing-exp-desc',
          type: 'input-field',
          label: 'expense description',
          position: { x: 40, y: 310, width: 432, height: 48, zIndex: 2 },
          fieldName: 'description',
          placeholder: 'Expense description (e.g. Cloud hosting, supplies)',
          inputType: 'text',
          radius: 12,
        },
        {
          id: 'billing-exp-cat',
          type: 'input-field',
          label: 'expense category',
          position: { x: 40, y: 370, width: 210, height: 48, zIndex: 2 },
          fieldName: 'category',
          inputType: 'select',
          defaultValue: 'Operations',
          options: ['Operations', 'Payroll', 'Supplies', 'Utilities', 'Travel'],
          radius: 12,
        },
        {
          id: 'billing-exp-amount',
          type: 'input-field',
          label: 'expense amount',
          position: { x: 262, y: 370, width: 210, height: 48, zIndex: 2 },
          fieldName: 'amount',
          placeholder: 'Amount',
          inputType: 'number',
          radius: 12,
        },
        {
          id: 'billing-exp-date',
          type: 'input-field',
          label: 'expense date',
          position: { x: 40, y: 430, width: 210, height: 48, zIndex: 2 },
          fieldName: 'expense_date',
          placeholder: 'Expense date',
          inputType: 'date',
          radius: 12,
        },
        {
          id: 'billing-exp-submit',
          type: 'button',
          label: 'log expense',
          position: { x: 262, y: 430, width: 210, height: 48, zIndex: 2 },
          text: 'Log Expense',
          variant: 'secondary',
          backgroundColor: '#0f766e',
          textColor: '#ffffff',
          radius: 12,
          events: [
            {
              id: 'billing-insert-expense',
              trigger: 'click',
              action: {
                type: 'insert',
                table: 'expenses',
                payload: {
                  description: '$$input.billing-exp-desc',
                  category: '$$input.billing-exp-cat',
                  amount: '$$input.billing-exp-amount',
                  expense_date: '$$input.billing-exp-date',
                },
                onSuccess: {
                  type: 'query',
                  table: 'expenses',
                  columns: ['description', 'category', 'amount', 'expense_date'],
                  targetElementId: 'billing-expenses-table',
                  limit: 20,
                  orderBy: 'created_at',
                  descending: true,
                },
              },
            },
          ],
        },
        {
          id: 'billing-expense-chart',
          type: 'chart',
          label: 'expense breakdown',
          position: { x: 40, y: 494, width: 432, height: 184, zIndex: 2 },
          chartType: 'bar',
          source: 'business-table',
          title: 'Expenses by Category',
          tableName: 'expenses',
          labelColumn: 'category',
          valueColumn: 'amount',
          aggregation: 'sum',
          backgroundColor: '#132420',
          textColor: '#ecfdf5',
          colorPalette: ['#10b981', '#14b8a6', '#f59e0b', '#3b82f6'],
        },
        {
          id: 'billing-invoices-table',
          type: 'table-view',
          label: 'invoices ledger',
          position: { x: 496, y: 108, width: 744, height: 290, zIndex: 2 },
          source: 'business-table',
          title: 'Client Invoices',
          subtitle: 'Recent receivables and payment status.',
          tableName: 'invoices',
          columns: ['invoice_number', 'client_name', 'issue_date', 'total_amount', 'paid'],
          pageSize: 8,
          orderBy: 'created_at',
          descending: true,
          backgroundColor: '#132420',
          headerBackgroundColor: 'rgba(16,185,129,0.14)',
          textColor: '#ecfdf5',
          striped: true,
        },
        {
          id: 'billing-expenses-table',
          type: 'table-view',
          label: 'expenses ledger',
          position: { x: 496, y: 416, width: 744, height: 262, zIndex: 2 },
          source: 'business-table',
          title: 'Operating Expenses',
          subtitle: 'Logged expenses across cost categories.',
          tableName: 'expenses',
          columns: ['description', 'category', 'amount', 'expense_date'],
          pageSize: 8,
          orderBy: 'created_at',
          descending: true,
          backgroundColor: '#132420',
          headerBackgroundColor: 'rgba(20,184,166,0.14)',
          textColor: '#ecfdf5',
          striped: true,
        },
      ],
    },
  },
  {
    id: 'appointment-station',
    presetKey: 'appointment-desk',
    category: 'industry',
    presetVersion: 1,
    name: 'Appointments & Intake Desk',
    description: 'Front-desk scheduling and check-in board for clinics, salons, repair shops, and tutoring centers.',
    icon: 'list',
    layout: {
      version: 2,
      resolution: { width: 1280, height: 720 },
      theme: { ...DEFAULT_LAYOUT_THEME, canvasBackground: '#0f172a' },
      elements: [
        {
          id: 'appt-title',
          type: 'text',
          label: 'title',
          position: { x: 40, y: 28, width: 560, height: 36, zIndex: 1 },
          content: 'Appointments & Intake Desk',
          fontSize: 28,
          fontWeight: 'bold',
          color: '#f8fafc',
          align: 'left',
        },
        {
          id: 'appt-subtitle',
          type: 'text',
          label: 'subtitle',
          position: { x: 40, y: 66, width: 680, height: 26, zIndex: 1 },
          content: 'Book sessions, check arrivals in, and track active practitioner queues.',
          fontSize: 13,
          fontWeight: 'normal',
          color: 'rgba(248,250,252,0.7)',
          align: 'left',
        },
        {
          id: 'appt-customer',
          type: 'input-field',
          label: 'patient or client name',
          position: { x: 40, y: 116, width: 440, height: 52, zIndex: 2 },
          fieldName: 'customer_name',
          placeholder: 'Patient, client, or student name',
          inputType: 'text',
          radius: 14,
        },
        {
          id: 'appt-staff',
          type: 'input-field',
          label: 'assigned specialist',
          position: { x: 40, y: 182, width: 214, height: 52, zIndex: 2 },
          fieldName: 'staff_id',
          placeholder: 'Doctor / specialist / tutor',
          inputType: 'text',
          radius: 14,
        },
        {
          id: 'appt-duration',
          type: 'input-field',
          label: 'duration minutes',
          position: { x: 266, y: 182, width: 214, height: 52, zIndex: 2 },
          fieldName: 'duration_min',
          placeholder: 'Duration (min)',
          inputType: 'number',
          defaultValue: '30',
          radius: 14,
        },
        {
          id: 'appt-datetime',
          type: 'input-field',
          label: 'scheduled time',
          position: { x: 40, y: 248, width: 214, height: 52, zIndex: 2 },
          fieldName: 'scheduled_at',
          placeholder: 'Date/time (2026-11-12 09:30)',
          inputType: 'text',
          radius: 14,
        },
        {
          id: 'appt-status',
          type: 'input-field',
          label: 'appointment status',
          position: { x: 266, y: 248, width: 214, height: 52, zIndex: 2 },
          fieldName: 'status',
          inputType: 'select',
          defaultValue: 'scheduled',
          options: ['scheduled', 'checked_in', 'in_progress', 'completed'],
          radius: 14,
        },
        {
          id: 'appt-notes',
          type: 'input-field',
          label: 'visit notes',
          position: { x: 40, y: 314, width: 440, height: 52, zIndex: 2 },
          fieldName: 'notes',
          placeholder: 'Service requested, symptoms, or session focus',
          inputType: 'text',
          radius: 14,
        },
        {
          id: 'appt-submit',
          type: 'button',
          label: 'book appointment',
          position: { x: 40, y: 384, width: 440, height: 56, zIndex: 2 },
          text: 'Book Appointment',
          variant: 'primary',
          backgroundColor: '#3b82f6',
          textColor: '#ffffff',
          radius: 14,
          events: [
            {
              id: 'appt-insert',
              trigger: 'click',
              action: {
                type: 'insert',
                table: 'appointments',
                payload: {
                  customer_name: '$$input.appt-customer',
                  staff_id: '$$input.appt-staff',
                  scheduled_at: '$$input.appt-datetime',
                  duration_min: '$$input.appt-duration',
                  status: '$$input.appt-status',
                  notes: '$$input.appt-notes',
                },
                onSuccess: {
                  type: 'query',
                  table: 'appointments',
                  columns: ['customer_name', 'staff_id', 'scheduled_at', 'duration_min', 'status'],
                  targetElementId: 'appt-queue-table',
                  limit: 25,
                  orderBy: 'created_at',
                  descending: true,
                },
              },
            },
          ],
        },
        {
          id: 'appt-queue-table',
          type: 'table-view',
          label: 'appointments queue',
          position: { x: 504, y: 116, width: 736, height: 560, zIndex: 2 },
          source: 'business-table',
          title: 'Active Schedule & Queue',
          subtitle: 'Incoming visits, check-ins, and active sessions.',
          tableName: 'appointments',
          columns: ['customer_name', 'staff_id', 'scheduled_at', 'duration_min', 'status'],
          pageSize: 12,
          autoRefreshMs: 5000,
          orderBy: 'created_at',
          descending: true,
          backgroundColor: '#1e293b',
          headerBackgroundColor: 'rgba(59,130,246,0.14)',
          textColor: '#f8fafc',
          striped: true,
        },
      ],
    },
  },
  {
    id: 'directory-station',
    presetKey: 'service-directory',
    category: 'industry',
    presetVersion: 1,
    name: 'Directory & Roster Desk',
    description: 'Dedicated records desk for registering clients, patients, students, or loyalty members alongside your staff roster.',
    icon: 'database',
    layout: {
      version: 2,
      resolution: { width: 1280, height: 720 },
      theme: { ...DEFAULT_LAYOUT_THEME, canvasBackground: '#18181b' },
      elements: [
        {
          id: 'dir-title',
          type: 'text',
          label: 'title',
          position: { x: 40, y: 28, width: 560, height: 36, zIndex: 1 },
          content: 'Directory & Roster Desk',
          fontSize: 28,
          fontWeight: 'bold',
          color: '#fafafa',
          align: 'left',
        },
        {
          id: 'dir-subtitle',
          type: 'text',
          label: 'subtitle',
          position: { x: 40, y: 66, width: 680, height: 26, zIndex: 1 },
          content: 'Keep client, patient, or student profiles and your active team directory synchronized.',
          fontSize: 13,
          fontWeight: 'normal',
          color: 'rgba(250,250,250,0.68)',
          align: 'left',
        },
        {
          id: 'dir-cust-name',
          type: 'input-field',
          label: 'profile full name',
          position: { x: 40, y: 108, width: 210, height: 48, zIndex: 2 },
          fieldName: 'full_name',
          placeholder: 'Client / student / patient name',
          inputType: 'text',
          radius: 12,
        },
        {
          id: 'dir-cust-phone',
          type: 'input-field',
          label: 'profile phone',
          position: { x: 262, y: 108, width: 210, height: 48, zIndex: 2 },
          fieldName: 'phone',
          placeholder: 'Phone number',
          inputType: 'text',
          radius: 12,
        },
        {
          id: 'dir-cust-email',
          type: 'input-field',
          label: 'profile email',
          position: { x: 40, y: 168, width: 210, height: 48, zIndex: 2 },
          fieldName: 'email',
          placeholder: 'Email address',
          inputType: 'text',
          radius: 12,
        },
        {
          id: 'dir-cust-address',
          type: 'input-field',
          label: 'profile address',
          position: { x: 262, y: 168, width: 210, height: 48, zIndex: 2 },
          fieldName: 'address',
          placeholder: 'Address / branch',
          inputType: 'text',
          radius: 12,
        },
        {
          id: 'dir-cust-notes',
          type: 'input-field',
          label: 'profile notes',
          position: { x: 40, y: 228, width: 432, height: 48, zIndex: 2 },
          fieldName: 'notes',
          placeholder: 'Notes, loyalty tier, grade level, or medical alert',
          inputType: 'text',
          radius: 12,
        },
        {
          id: 'dir-cust-submit',
          type: 'button',
          label: 'save profile',
          position: { x: 40, y: 290, width: 432, height: 48, zIndex: 2 },
          text: 'Save Directory Profile',
          variant: 'primary',
          backgroundColor: '#f59e0b',
          textColor: '#18181b',
          radius: 12,
          events: [
            {
              id: 'dir-insert-customer',
              trigger: 'click',
              action: {
                type: 'insert',
                table: 'customers',
                payload: {
                  full_name: '$$input.dir-cust-name',
                  phone: '$$input.dir-cust-phone',
                  email: '$$input.dir-cust-email',
                  address: '$$input.dir-cust-address',
                  notes: '$$input.dir-cust-notes',
                },
                onSuccess: {
                  type: 'query',
                  table: 'customers',
                  columns: ['full_name', 'phone', 'email', 'notes'],
                  targetElementId: 'dir-customers-table',
                  limit: 25,
                  orderBy: 'created_at',
                  descending: true,
                },
              },
            },
          ],
        },
        {
          id: 'dir-staff-name',
          type: 'input-field',
          label: 'staff name',
          position: { x: 40, y: 380, width: 210, height: 48, zIndex: 2 },
          fieldName: 'full_name',
          placeholder: 'Staff member full name',
          inputType: 'text',
          radius: 12,
        },
        {
          id: 'dir-staff-role',
          type: 'input-field',
          label: 'staff role',
          position: { x: 262, y: 380, width: 210, height: 48, zIndex: 2 },
          fieldName: 'role',
          placeholder: 'Role (Specialist, Driver, Tutor)',
          inputType: 'text',
          radius: 12,
        },
        {
          id: 'dir-staff-phone',
          type: 'input-field',
          label: 'staff phone',
          position: { x: 40, y: 440, width: 210, height: 48, zIndex: 2 },
          fieldName: 'phone',
          placeholder: 'Staff phone',
          inputType: 'text',
          radius: 12,
        },
        {
          id: 'dir-staff-email',
          type: 'input-field',
          label: 'staff email',
          position: { x: 262, y: 440, width: 210, height: 48, zIndex: 2 },
          fieldName: 'email',
          placeholder: 'Staff email',
          inputType: 'text',
          radius: 12,
        },
        {
          id: 'dir-staff-submit',
          type: 'button',
          label: 'add staff member',
          position: { x: 40, y: 502, width: 432, height: 48, zIndex: 2 },
          text: 'Add Staff Member',
          variant: 'secondary',
          backgroundColor: '#14b8a6',
          textColor: '#042f2e',
          radius: 12,
          events: [
            {
              id: 'dir-insert-staff',
              trigger: 'click',
              action: {
                type: 'insert',
                table: 'staff',
                payload: {
                  full_name: '$$input.dir-staff-name',
                  role: '$$input.dir-staff-role',
                  phone: '$$input.dir-staff-phone',
                  email: '$$input.dir-staff-email',
                  active: 1,
                },
                onSuccess: {
                  type: 'query',
                  table: 'staff',
                  columns: ['full_name', 'role', 'phone', 'active'],
                  targetElementId: 'dir-staff-table',
                  limit: 25,
                  orderBy: 'created_at',
                  descending: true,
                },
              },
            },
          ],
        },
        {
          id: 'dir-customers-table',
          type: 'table-view',
          label: 'directory records',
          position: { x: 496, y: 108, width: 744, height: 290, zIndex: 2 },
          source: 'business-table',
          title: 'Client & Member Directory',
          subtitle: 'Registered clients, patients, students, or loyalty members.',
          tableName: 'customers',
          columns: ['full_name', 'phone', 'email', 'notes'],
          pageSize: 8,
          orderBy: 'created_at',
          descending: true,
          backgroundColor: '#27272a',
          headerBackgroundColor: 'rgba(245,158,11,0.14)',
          textColor: '#fafafa',
          striped: true,
        },
        {
          id: 'dir-staff-table',
          type: 'table-view',
          label: 'staff roster',
          position: { x: 496, y: 416, width: 744, height: 262, zIndex: 2 },
          source: 'business-table',
          title: 'Team & Staff Roster',
          subtitle: 'Active specialists, drivers, instructors, and staff.',
          tableName: 'staff',
          columns: ['full_name', 'role', 'phone', 'active'],
          pageSize: 8,
          orderBy: 'created_at',
          descending: true,
          backgroundColor: '#27272a',
          headerBackgroundColor: 'rgba(20,184,166,0.14)',
          textColor: '#fafafa',
          striped: true,
        },
      ],
    },
  },
];

export const ALL_BUILDER_PRESETS: BuilderPreset[] = [
  ...BUILDER_PRESETS,
  ...INDUSTRY_BUILDER_PRESETS,
];

export const BUILDER_PRESET_KEY_MAP: Record<string, PermissionPresetKey> = {
  'cashier-station': 'cashier-register',
  'catalog-station': 'catalog-registrar',
  'inventory-station': 'inventory-manager',
  'kitchen-station': 'kitchen-display',
  'reports-station': 'reports-viewer',
  'dispatch-station': 'dispatch-console',
  'billing-station': 'billing-ledger',
  'appointment-station': 'appointment-desk',
  'directory-station': 'service-directory',
};

export const PERMISSION_KEY_TO_BUILDER_ID: Record<PermissionPresetKey, string> = {
  'cashier-register': 'cashier-station',
  'catalog-registrar': 'catalog-station',
  'inventory-manager': 'inventory-station',
  'kitchen-display': 'kitchen-station',
  'reports-viewer': 'reports-station',
  'dispatch-console': 'dispatch-station',
  'billing-ledger': 'billing-station',
  'appointment-desk': 'appointment-station',
  'service-directory': 'directory-station',
};

export function findBuiltInBuilderPreset(identifier?: string | null): BuilderPreset | null {
  if (!identifier || typeof identifier !== 'string') return null;
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  const direct = ALL_BUILDER_PRESETS.find(
    (preset) => preset.id === trimmed || preset.presetKey === trimmed,
  );
  if (direct) return direct;

  const permissionPreset = presetByRoleOrKey(trimmed);
  if (!permissionPreset) return null;
  const builderId = PERMISSION_KEY_TO_BUILDER_ID[permissionPreset.key];
  return ALL_BUILDER_PRESETS.find((preset) => preset.id === builderId) ?? null;
}

export function resolvePresetVersionNumber(value: unknown, fallback = 1): number {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 1) {
    return Math.floor(num);
  }
  return fallback;
}

export function buildBuiltInLatestVersionMap(): Record<string, number> {
  const map: Record<string, number> = {};
  for (const preset of ALL_BUILDER_PRESETS) {
    map[preset.id] = preset.presetVersion;
    map[preset.presetKey] = preset.presetVersion;
  }
  return map;
}

export interface LayoutPresetMetadata {
  presetId: string | null;
  presetVersion: number | null;
  presetName: string | null;
}

export function extractPresetMetaFromLayout(rawLayout: unknown): LayoutPresetMetadata {
  let obj: Record<string, unknown> | null = null;
  if (typeof rawLayout === 'string') {
    try {
      const parsed = JSON.parse(rawLayout);
      if (parsed && typeof parsed === 'object') {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      obj = null;
    }
  } else if (rawLayout && typeof rawLayout === 'object') {
    obj = rawLayout as Record<string, unknown>;
  }

  const presetId = typeof obj?.presetId === 'string' && obj.presetId.trim()
    ? obj.presetId.trim()
    : null;
  const rawVer = obj?.presetVersion;
  const parsedVer = typeof rawVer === 'number' || (typeof rawVer === 'string' && rawVer.trim() !== '')
    ? Number(rawVer)
    : NaN;
  const presetVersion = Number.isFinite(parsedVer) && parsedVer >= 0 ? Math.floor(parsedVer) : null;
  const presetName = typeof obj?.presetName === 'string' && obj.presetName.trim()
    ? obj.presetName.trim()
    : null;

  return { presetId, presetVersion, presetName };
}

export function attachPresetMetaToLayout(
  layout: UiLayout,
  meta: {
    presetId?: string | null;
    presetVersion?: number | null;
    presetName?: string | null;
    brandConfig?: Record<string, unknown> | null;
    stationConfig?: Record<string, unknown> | null;
  },
): UiLayout & Record<string, unknown> {
  const out: UiLayout & Record<string, unknown> = { ...(layout as UiLayout & Record<string, unknown>) };
  if (meta.presetId) {
    out.presetId = meta.presetId;
  }
  if (typeof meta.presetVersion === 'number' && Number.isFinite(meta.presetVersion)) {
    out.presetVersion = Math.floor(meta.presetVersion);
  }
  if (meta.presetName) {
    out.presetName = meta.presetName;
  }
  if (meta.brandConfig && typeof meta.brandConfig === 'object') {
    out.brandConfig = meta.brandConfig;
  }
  if (meta.stationConfig && typeof meta.stationConfig === 'object') {
    out.stationConfig = meta.stationConfig;
  }
  return out;
}

export const MAX_PRESET_LAYOUT_BYTES = 512_000;
export const MAX_PRESET_SCHEMA_TABLES = 50;
export const MAX_PRESET_TABLE_COLUMNS = 100;
export const MAX_PRESET_ELEMENTS = 200;
export const MAX_PRESET_MODALS = 50;

export function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

export function parseBrandConfigFromBusinessPalette(colorPaletteRaw: unknown): WorkspaceBrandConfig | null {
  const obj = parseJsonObject(colorPaletteRaw);
  if (!obj || Object.keys(obj).length === 0) return null;
  return obj as WorkspaceBrandConfig;
}

export function sanitizePresetSchemaDefinition(raw: unknown): SchemaDef | null {
  if (raw == null) return null;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '{}') return null;
    parsed = JSON.parse(trimmed);
  }
  if (Array.isArray(parsed)) {
    parsed = { tables: parsed };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Schema definition must be an object containing a tables array.');
  }
  const obj = validateAndSanitizeRecord(parsed, {
    maxDepth: 6,
    maxStringLength: 1000,
    maxArrayLength: 250,
    maxObjectKeys: 50,
    rejectNullBytes: true,
    allowMultiline: false,
  });
  if (!('tables' in obj) || obj.tables == null) {
    return null;
  }
  if (!Array.isArray(obj.tables)) {
    throw new Error('Schema definition tables must be an array.');
  }
  if (obj.tables.length === 0) {
    return null;
  }
  if (obj.tables.length > MAX_PRESET_SCHEMA_TABLES) {
    throw new Error(`Schema definition cannot exceed ${MAX_PRESET_SCHEMA_TABLES} tables.`);
  }
  const cleanTables: TableDef[] = [];
  for (const tbl of obj.tables) {
    if (!tbl || typeof tbl !== 'object' || Array.isArray(tbl)) {
      throw new Error('Each table definition must be an object.');
    }
    const tableRecord = tbl as unknown as TableDef;
    if (!Array.isArray(tableRecord.columns) || tableRecord.columns.length > MAX_PRESET_TABLE_COLUMNS) {
      throw new Error(`Each table may contain at most ${MAX_PRESET_TABLE_COLUMNS} columns.`);
    }
    validateTableDef(tableRecord);
    cleanTables.push({
      name: tableRecord.name,
      columns: tableRecord.columns.map((col) => ({
        name: col.name,
        type: col.type,
        nullable: Boolean(col.nullable),
        ...(col.unique ? { unique: true } : {}),
        ...(col.default !== undefined && col.default !== '' ? { default: String(col.default).trim() } : {}),
        ...(col.references ? { references: { table: col.references.table, column: col.references.column } } : {}),
      })),
    });
  }
  return { tables: cleanTables };
}

export function sanitizePresetLayoutInput(rawLayout: unknown): UiLayout & Record<string, unknown> {
  let parsed: unknown = rawLayout;
  if (typeof rawLayout === 'string') {
    if (!rawLayout.trim()) {
      throw new Error('UI layout cannot be empty.');
    }
    parsed = JSON.parse(rawLayout);
  }
  const sanitized = validateAndSanitizeRecord(parsed, {
    maxDepth: 10,
    maxStringLength: 65_536,
    maxArrayLength: 500,
    maxObjectKeys: 200,
    rejectNullBytes: true,
    allowMultiline: true,
  });
  const elements = Array.isArray(sanitized.elements) ? sanitized.elements : [];
  const modals = Array.isArray(sanitized.modals) ? sanitized.modals : [];
  if (elements.length > MAX_PRESET_ELEMENTS) {
    throw new Error(`Preset layout cannot exceed ${MAX_PRESET_ELEMENTS} elements.`);
  }
  if (modals.length > MAX_PRESET_MODALS) {
    throw new Error(`Preset layout cannot exceed ${MAX_PRESET_MODALS} modals.`);
  }
  const serializedSize = JSON.stringify(sanitized).length;
  if (serializedSize > MAX_PRESET_LAYOUT_BYTES) {
    throw new Error(`Preset layout exceeds maximum size of ${MAX_PRESET_LAYOUT_BYTES} bytes.`);
  }
  const normalized = normalizeLayout(sanitized as unknown as UiLayout);
  const stationConfig = parseJsonObject(sanitized.stationConfig);
  return stationConfig ? { ...normalized, stationConfig } : (normalized as UiLayout & Record<string, unknown>);
}

export function normalizePresetPermissionsInput(
  rawPermissions: unknown,
  roleOrKey?: string | null,
): TerminalPermissions | null {
  if (rawPermissions == null && !roleOrKey) {
    return null;
  }
  let parsed: unknown = rawPermissions;
  if (typeof rawPermissions === 'string') {
    const trimmed = rawPermissions.trim();
    parsed = trimmed ? JSON.parse(trimmed) : {};
  }
  if (parsed && typeof parsed === 'object') {
    parsed = validateAndSanitizeRecord(parsed, {
      maxDepth: 6,
      maxStringLength: 500,
      maxArrayLength: 100,
      maxObjectKeys: 100,
      rejectNullBytes: true,
      allowMultiline: false,
    });
  } else if (parsed != null) {
    throw new Error('Permissions must be an object.');
  }
  return normalizePermissions(parsed as Partial<TerminalPermissions> | null, roleOrKey);
}

export interface BuildTerminalPresetLayoutOptions {
  templateLayout: UiLayout;
  presetId: string;
  presetVersion: number;
  presetName?: string | null;
  businessPaletteRaw?: unknown;
  existingTerminalLayout?: unknown;
}

export function buildBrandedTerminalLayoutForPreset(
  options: BuildTerminalPresetLayoutOptions,
): UiLayout & Record<string, unknown> {
  const existingObj = parseJsonObject(options.existingTerminalLayout);
  const templateObj = parseJsonObject(options.templateLayout);
  const existingStationConfig = parseJsonObject(existingObj?.stationConfig) ?? parseJsonObject(templateObj?.stationConfig);
  const existingBrandConfig = parseJsonObject(existingObj?.brandConfig);
  const businessBrandConfig = parseBrandConfigFromBusinessPalette(options.businessPaletteRaw);
  // The terminal keeps only its own style override; the workspace brand kit fills in everything else,
  // so later brand kit changes still reach this terminal.
  const terminalOverride = existingBrandConfig as Partial<WorkspaceBrandConfig> | null;
  const effectiveBrand = (businessBrandConfig || terminalOverride)
    ? mergeTerminalBrandConfig(businessBrandConfig, terminalOverride) as WorkspaceBrandConfig
    : null;

  const baseNormalized = normalizeLayout(cloneLayout(options.templateLayout));

  // Preserve custom terminal screen dimensions if previously configured
  const existingRes = parseJsonObject(existingObj?.resolution);
  if (
    existingRes &&
    typeof existingRes.width === 'number' &&
    typeof existingRes.height === 'number' &&
    Number.isFinite(existingRes.width) &&
    Number.isFinite(existingRes.height) &&
    existingRes.width >= 320 &&
    existingRes.height >= 240
  ) {
    baseNormalized.resolution = {
      width: Math.round(existingRes.width),
      height: Math.round(existingRes.height),
    };
  }

  let branded: UiLayout;
  if (effectiveBrand && Object.keys(effectiveBrand).length > 0) {
    branded = applyBrandingToLayout(baseNormalized, effectiveBrand);
  } else if (existingObj?.theme && typeof existingObj.theme === 'object') {
    branded = normalizeLayout({
      ...baseNormalized,
      theme: existingObj.theme as UiLayout['theme'],
    });
  } else {
    branded = baseNormalized;
  }

  return attachPresetMetaToLayout(branded, {
    presetId: options.presetId,
    presetVersion: options.presetVersion,
    presetName: options.presetName ?? null,
    brandConfig: terminalOverride ? (terminalOverride as Record<string, unknown>) : null,
    stationConfig: existingStationConfig,
  });
}

export interface ApiPresetRecord {
  id: string;
  business_id: string | null;
  name: string;
  description: string | null;
  category: string;
  preset_key: string | null;
  schema_definition: Record<string, unknown>;
  ui_layout: UiLayout | Record<string, unknown>;
  permissions: TerminalPermissions | Record<string, unknown>;
  version: number;
  is_custom: boolean;
  linked_terminal_count: number;
  created_at: string;
  updated_at: string;
}

export function terminalMatchesPreset(
  terminal: { ui_layout?: unknown },
  presetId: string,
  presetKey?: string | null,
): boolean {
  const meta = extractPresetMetaFromLayout(terminal.ui_layout);
  if (!meta.presetId) return false;
  if (meta.presetId === presetId) return true;
  if (presetKey && meta.presetId === presetKey) return true;
  return false;
}

export function normalizeDbPresetRow(
  row: Record<string, unknown>,
  linkedTerminalCount = 0,
): ApiPresetRecord {
  const rawSchema = parseJsonObject(row.schema_definition) ?? {};
  const rawLayout = parseJsonObject(row.ui_layout);
  const presetKey = typeof row.preset_key === 'string' && row.preset_key.trim()
    ? sanitizeTextInput(row.preset_key, 80, false).trim()
    : null;
  const rawPermissions = parseJsonObject(row.permissions);
  const permissions = rawPermissions
    ? normalizePermissions(rawPermissions as Partial<TerminalPermissions>, presetKey)
    : (presetKey ? normalizePermissions({}, presetKey) : DEFAULT_TERMINAL_PERMISSIONS);

  const normalizedLayout = rawLayout && Array.isArray(rawLayout.elements)
    ? normalizeLayout(rawLayout as unknown as UiLayout)
    : (rawLayout ?? {});

  const createdAt = typeof row.created_at === 'string' && row.created_at
    ? row.created_at
    : new Date().toISOString();
  const updatedAt = typeof row.updated_at === 'string' && row.updated_at
    ? row.updated_at
    : createdAt;
  const businessId = typeof row.business_id === 'string' && row.business_id.trim()
    ? row.business_id.trim()
    : null;

  return {
    id: String(row.id ?? ''),
    business_id: businessId,
    name: String(row.name ?? 'Custom Preset'),
    description: typeof row.description === 'string' ? row.description : null,
    category: typeof row.category === 'string' && row.category.trim()
      ? row.category.trim()
      : (businessId ? 'custom' : 'core'),
    preset_key: presetKey,
    schema_definition: rawSchema,
    ui_layout: normalizedLayout,
    permissions,
    version: resolvePresetVersionNumber(row.version, 1),
    is_custom: Boolean(businessId),
    linked_terminal_count: linkedTerminalCount,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function formatBuiltInPresetRecord(
  preset: BuilderPreset,
  options: {
    schemaDefinition?: Record<string, unknown>;
    permissions?: TerminalPermissions;
    linkedTerminalCount?: number;
  } = {},
): ApiPresetRecord {
  return {
    id: preset.id,
    business_id: null,
    name: preset.name,
    description: preset.description,
    category: preset.category,
    preset_key: preset.presetKey,
    schema_definition: options.schemaDefinition ?? {},
    ui_layout: attachPresetMetaToLayout(cloneLayout(preset.layout), {
      presetId: preset.id,
      presetVersion: preset.presetVersion,
      presetName: preset.name,
    }),
    permissions: options.permissions ?? normalizePermissions({}, preset.presetKey),
    version: preset.presetVersion,
    is_custom: false,
    linked_terminal_count: options.linkedTerminalCount ?? 0,
    created_at: '',
    updated_at: '',
  };
}

export interface PresetVersionStatus {
  presetId: string | null;
  presetName: string | null;
  presetVersion: number;
  latestVersion: number | null;
  updateAvailable: boolean;
  linked: boolean;
  canSync: boolean;
}

export function getTerminalPresetStatus(
  terminal: { ui_layout?: unknown; role?: string | null },
  latestVersionsById?: Record<string, number>,
): PresetVersionStatus {
  const meta = extractPresetMetaFromLayout(terminal.ui_layout);
  const builtInVersions = buildBuiltInLatestVersionMap();
  const versionsMap = { ...builtInVersions, ...(latestVersionsById ?? {}) };
  const inferredBuiltIn = !meta.presetId && terminal.role
    ? findBuiltInBuilderPreset(terminal.role)
    : null;

  const effectivePresetId = meta.presetId ?? inferredBuiltIn?.id ?? null;
  const latestVersion = effectivePresetId && typeof versionsMap[effectivePresetId] === 'number'
    ? versionsMap[effectivePresetId]
    : null;

  if (meta.presetId) {
    const currentVersion = meta.presetVersion ?? 0;
    const updateAvailable = latestVersion !== null && currentVersion < latestVersion;
    return {
      presetId: meta.presetId,
      presetName: meta.presetName ?? findBuiltInBuilderPreset(meta.presetId)?.name ?? null,
      presetVersion: currentVersion,
      latestVersion,
      updateAvailable,
      linked: true,
      canSync: latestVersion !== null,
    };
  }

  return {
    presetId: inferredBuiltIn?.id ?? null,
    presetName: inferredBuiltIn?.name ?? null,
    presetVersion: meta.presetVersion ?? 0,
    latestVersion,
    updateAvailable: false,
    linked: false,
    canSync: Boolean(inferredBuiltIn),
  };
}


