/**
 * Shared type definitions for layout screens, canvas elements, and runtime events.
 * These are used by both the builder (editor) and runtime renderer.
 */

export type ElementType =
  | 'button'
  | 'text'
  | 'image'
  | 'table-view'
  | 'input-field'
  | 'chart'
  | 'upload'
  | 'cart-widget'
  | 'scan-field';

export type QuerySource = 'business-table' | 'audit-log';

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export type EventTrigger =
  | 'click'
  | 'input:commit'
  | 'select:change'
  | 'load'
  | 'submit';

export type RuntimeActionType =
  | 'insert'
  | 'update'
  | 'delete'
  | 'query'
  | 'emit'
  | 'navigate'
  | 'upload';

export type RuntimePayloadValue =
  | string
  | number
  | boolean
  | null
  | RuntimePayloadValue[]
  | { [key: string]: RuntimePayloadValue };

export interface UiLayoutTheme {
  frameBackground: string;
  topBarBackground: string;
  topBarText: string;
  canvasBackground: string;
  gridColor: string;
  accentColor: string;
  panelBackground: string;
  panelHeaderBackground: string;
  panelText: string;
  panelMutedText: string;
  panelBorder: string;
}

export interface RuntimeActionDefinition {
  type: RuntimeActionType;
  source?: QuerySource;
  table?: string;
  payload?: RuntimePayloadValue;
  rowId?: RuntimePayloadValue;
  where?: Record<string, RuntimePayloadValue>;
  columns?: string[];
  limit?: number;
  offset?: number;
  orderBy?: string;
  descending?: boolean;
  targetElementId?: string;
  event?: string;
  bucket?: 'assets' | 'products' | 'backgrounds';
  path?: RuntimePayloadValue;
  accept?: string[];
  url?: string;
  /** Optional JS expression string evaluated against runtime context. Action is skipped if falsy. */
  condition?: string;
  /** Action to fire when this action succeeds (or condition passes). */
  onSuccess?: RuntimeActionDefinition;
  /** Action to fire when this action fails or condition is falsy. */
  onFailure?: RuntimeActionDefinition;
}

export interface ElementEventBinding {
  id?: string;
  trigger: EventTrigger;
  action: RuntimeActionDefinition;
}

export interface BaseElementDef {
  id: string;
  type: ElementType;
  position: ElementPosition;
  label?: string;
  events?: ElementEventBinding[];
}

export interface ButtonElementDef extends BaseElementDef {
  type: 'button';
  text: string;
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  backgroundColor?: string;
  textColor?: string;
  radius?: number;
  action?: LegacyElementAction;
}

export interface TextElementDef extends BaseElementDef {
  type: 'text';
  content: string;
  fontSize: number;
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export interface ImageElementDef extends BaseElementDef {
  type: 'image';
  src: string;
  fit: 'cover' | 'contain' | 'fill';
  radius?: number;
}

export interface TableViewElementDef extends BaseElementDef {
  type: 'table-view';
  source?: QuerySource;
  title?: string;
  subtitle?: string;
  tableName?: string;
  columns: string[];
  pageSize?: number;
  autoRefreshMs?: number;
  orderBy?: string;
  descending?: boolean;
  emptyLabel?: string;
  filters?: Record<string, string>;
  backgroundColor?: string;
  headerBackgroundColor?: string;
  textColor?: string;
  striped?: boolean;
}

export interface InputFieldElementDef extends BaseElementDef {
  type: 'input-field';
  fieldName: string;
  placeholder?: string;
  inputType: 'text' | 'number' | 'date' | 'select' | 'scan';
  options?: string[];
  submitGroup?: string;
  defaultValue?: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  radius?: number;
}

export type ChartType = 'pie' | 'bar' | 'line';

export interface ChartElementDef extends BaseElementDef {
  type: 'chart';
  chartType: ChartType;
  source?: QuerySource;
  title?: string;
  subtitle?: string;
  tableName?: string;
  labelColumn?: string;
  valueColumn?: string;
  aggregation?: 'sum' | 'count';
  filters?: Record<string, string>;
  colorPalette?: string[];
  backgroundColor?: string;
  textColor?: string;
  emptyLabel?: string;
}

export interface UploadElementDef extends BaseElementDef {
  type: 'upload';
  bucket: 'assets' | 'products' | 'backgrounds';
  pathTemplate?: string;
  accept?: string[];
  buttonLabel?: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  radius?: number;
}

export interface CartWidgetElementDef extends BaseElementDef {
  type: 'cart-widget';
  title?: string;
  subtitle?: string;
  productTable?: string;
  displayColumns: string[];
  priceColumn?: string;
  orderTable?: string;
  submitLabel?: string;
  emptyLabel?: string;
  backgroundColor?: string;
  panelColor?: string;
  textColor?: string;
  accentColor?: string;
  borderColor?: string;
  radius?: number;
}

export interface ScanFieldElementDef extends BaseElementDef {
  type: 'scan-field';
  fieldName: string;
  placeholder?: string;
  /** Milliseconds between keystrokes — bursts faster than this are treated as scanner input. */
  burstThresholdMs?: number;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  radius?: number;
}

export type ElementDef =
  | ButtonElementDef
  | TextElementDef
  | ImageElementDef
  | TableViewElementDef
  | InputFieldElementDef
  | ChartElementDef
  | UploadElementDef
  | CartWidgetElementDef
  | ScanFieldElementDef;

export type LegacyActionType =
  | 'none'
  | 'navigate'
  | 'insert-record'
  | 'custom-script';

export type ActionPayloadMapping =
  | { type: 'static'; value: string }
  | { type: 'element_value'; elementId: string };

export interface LegacyElementAction {
  type: LegacyActionType;
  payload: {
    url?: string;
    tableName?: string;
    dataMapping?: Record<string, ActionPayloadMapping>;
    script?: string;
    [key: string]: unknown;
  };
}

export type ModalPresentation = 'custom' | 'drawer' | 'fullscreen';

export interface ModalLayerDef {
  id: string;
  name: string;
  presentation: ModalPresentation;
  elements: ElementDef[];
}

export interface UiLayout {
  version: number;
  resolution: { width: number; height: number };
  theme: UiLayoutTheme;
  elements: ElementDef[];
  modals?: ModalLayerDef[];
}

export const DEFAULT_LAYOUT_THEME: UiLayoutTheme = {
  frameBackground: '#130d11',
  topBarBackground: 'rgba(255,255,255,0.03)',
  topBarText: '#f5ede4',
  canvasBackground: '#111118',
  gridColor: 'rgba(255,255,255,0.4)',
  accentColor: '#e8748a',
  panelBackground: '#161116',
  panelHeaderBackground: 'rgba(255,255,255,0.06)',
  panelText: '#f5ede4',
  panelMutedText: 'rgba(245,237,228,0.68)',
  panelBorder: 'rgba(255,255,255,0.08)',
};

export const DEFAULT_LAYOUT: UiLayout = {
  version: 2,
  resolution: { width: 1280, height: 720 },
  theme: { ...DEFAULT_LAYOUT_THEME },
  elements: [],
  modals: [],
};

export const TRIGGERS_BY_ELEMENT_TYPE: Record<ElementType, EventTrigger[]> = {
  button: ['click'],
  text: [],
  image: ['click'],
  'table-view': ['load'],
  'input-field': ['input:commit', 'submit', 'select:change'],
  chart: ['load'],
  upload: ['click'],
  'cart-widget': [],
  'scan-field': ['input:commit'],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTheme(value: unknown): UiLayoutTheme {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};

  return {
    frameBackground: typeof source.frameBackground === 'string' ? source.frameBackground : DEFAULT_LAYOUT_THEME.frameBackground,
    topBarBackground: typeof source.topBarBackground === 'string' ? source.topBarBackground : DEFAULT_LAYOUT_THEME.topBarBackground,
    topBarText: typeof source.topBarText === 'string' ? source.topBarText : DEFAULT_LAYOUT_THEME.topBarText,
    canvasBackground: typeof source.canvasBackground === 'string' ? source.canvasBackground : DEFAULT_LAYOUT_THEME.canvasBackground,
    gridColor: typeof source.gridColor === 'string' ? source.gridColor : DEFAULT_LAYOUT_THEME.gridColor,
    accentColor: typeof source.accentColor === 'string' ? source.accentColor : DEFAULT_LAYOUT_THEME.accentColor,
    panelBackground: typeof source.panelBackground === 'string' ? source.panelBackground : DEFAULT_LAYOUT_THEME.panelBackground,
    panelHeaderBackground: typeof source.panelHeaderBackground === 'string' ? source.panelHeaderBackground : DEFAULT_LAYOUT_THEME.panelHeaderBackground,
    panelText: typeof source.panelText === 'string' ? source.panelText : DEFAULT_LAYOUT_THEME.panelText,
    panelMutedText: typeof source.panelMutedText === 'string' ? source.panelMutedText : DEFAULT_LAYOUT_THEME.panelMutedText,
    panelBorder: typeof source.panelBorder === 'string' ? source.panelBorder : DEFAULT_LAYOUT_THEME.panelBorder,
  };
}

function normalizeStringMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item != null && String(item).trim().length > 0)
    .map(([key, item]) => [String(key), String(item)]);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeLegacyOrderColumn(tableName: unknown, column: unknown) {
  if (tableName === 'orders' && column === 'customer_name') {
    return 'table_number';
  }

  return String(column);
}

function legacyActionToEvents(action?: LegacyElementAction): ElementEventBinding[] {
  if (!action || action.type === 'none') return [];

  if (action.type === 'navigate') {
    return [{
      trigger: 'click',
      action: {
        type: 'navigate',
        url: String(action.payload.url ?? ''),
      },
    }];
  }

  if (action.type === 'insert-record') {
    const payload = Object.fromEntries(
      Object.entries(action.payload.dataMapping ?? {}).map(([key, value]) => {
        if (value.type === 'static') return [key, value.value];
        return [key, `$$input.${value.elementId}`];
      }),
    ) as RuntimePayloadValue;

    return [{
      trigger: 'click',
      action: {
        type: 'insert',
        table: action.payload.tableName,
        payload,
      },
    }];
  }

  if (action.type === 'custom-script') {
    return [{
      trigger: 'click',
      action: {
        type: 'emit',
        event: 'runtime:legacy-script',
        payload: {
          script: String(action.payload.script ?? ''),
        },
      },
    }];
  }

  return [];
}

function normalizeEvents(events: unknown, fallbackAction?: LegacyElementAction): ElementEventBinding[] {
  const safeEvents = Array.isArray(events) ? events : [];
  const mapped = safeEvents
    .filter((event): event is Record<string, unknown> => Boolean(event && typeof event === 'object'))
    .map((event) => ({
      id: typeof event.id === 'string' ? event.id : crypto.randomUUID(),
      trigger: (event.trigger as EventTrigger) ?? 'click',
      action: {
        ...(typeof event.action === 'object' && event.action ? event.action : {}),
      } as RuntimeActionDefinition,
    }))
    .filter((event) => event.action?.type);

  if (mapped.length > 0) return mapped;
  return legacyActionToEvents(fallbackAction).map((event) => ({
    ...event,
    id: event.id ?? crypto.randomUUID(),
  }));
}

function normalizeElement(raw: unknown): ElementDef | null {
  if (!raw || typeof raw !== 'object') return null;

  const source = raw as Record<string, any>;
  const position = source.position ?? {
    x: source.x ?? 0,
    y: source.y ?? 0,
    width: source.width ?? 200,
    height: source.height ?? 60,
    zIndex: source.zIndex ?? 1,
  };

  const base = {
    id: String(source.id ?? crypto.randomUUID()),
    type: source.type as ElementType,
    label: typeof source.label === 'string' ? source.label : undefined,
    position: {
      x: Number(position.x ?? 0),
      y: Number(position.y ?? 0),
      width: Number(position.width ?? 200),
      height: Number(position.height ?? 60),
      zIndex: Number(position.zIndex ?? 1),
    },
    events: normalizeEvents(source.events, source.action),
  } satisfies Partial<BaseElementDef>;

  switch (source.type) {
    case 'button':
      return {
        ...base,
        type: 'button',
        text: String(source.text ?? source.props?.label ?? source.label ?? 'Button'),
        variant: source.variant ?? 'primary',
        backgroundColor: typeof source.backgroundColor === 'string' ? source.backgroundColor : undefined,
        textColor: typeof source.textColor === 'string' ? source.textColor : undefined,
        radius: source.radius != null ? Number(source.radius) : undefined,
      } as ButtonElementDef;
    case 'text':
      return {
        ...base,
        type: 'text',
        content: String(source.content ?? ''),
        fontSize: Number(source.fontSize ?? 16),
        fontWeight: source.fontWeight ?? 'normal',
        color: source.color,
        align: source.align ?? 'left',
      } as TextElementDef;
    case 'image':
      return {
        ...base,
        type: 'image',
        src: String(source.src ?? ''),
        fit: source.fit ?? 'cover',
        radius: source.radius != null ? Number(source.radius) : undefined,
      } as ImageElementDef;
    case 'table-view':
      return {
        ...base,
        type: 'table-view',
        source: source.source ?? 'business-table',
        title: typeof source.title === 'string' ? source.title : undefined,
        subtitle: typeof source.subtitle === 'string' ? source.subtitle : undefined,
        tableName: source.tableName ? String(source.tableName) : undefined,
        columns: Array.isArray(source.columns)
          ? source.columns.map((column) => normalizeLegacyOrderColumn(source.tableName, column))
          : [],
        pageSize: source.pageSize != null ? Number(source.pageSize) : undefined,
        autoRefreshMs: source.autoRefreshMs != null ? Number(source.autoRefreshMs) : undefined,
        orderBy: typeof source.orderBy === 'string' ? source.orderBy : undefined,
        descending: typeof source.descending === 'boolean' ? source.descending : undefined,
        emptyLabel: typeof source.emptyLabel === 'string' ? source.emptyLabel : undefined,
        filters: normalizeStringMap(source.filters),
        backgroundColor: typeof source.backgroundColor === 'string' ? source.backgroundColor : undefined,
        headerBackgroundColor: typeof source.headerBackgroundColor === 'string' ? source.headerBackgroundColor : undefined,
        textColor: typeof source.textColor === 'string' ? source.textColor : undefined,
        striped: typeof source.striped === 'boolean' ? source.striped : undefined,
      } as TableViewElementDef;
    case 'input-field':
      return {
        ...base,
        type: 'input-field',
        fieldName: source.fieldName === 'customer_name' ? 'table_number' : String(source.fieldName ?? 'value'),
        placeholder: source.fieldName === 'customer_name'
          ? 'Table number'
          : typeof source.placeholder === 'string'
            ? source.placeholder
            : undefined,
        inputType: source.inputType ?? 'text',
        options: Array.isArray(source.options) ? source.options.map(String) : undefined,
        submitGroup: typeof source.submitGroup === 'string' ? source.submitGroup : undefined,
        defaultValue: typeof source.defaultValue === 'string' ? source.defaultValue : undefined,
        backgroundColor: typeof source.backgroundColor === 'string' ? source.backgroundColor : undefined,
        textColor: typeof source.textColor === 'string' ? source.textColor : undefined,
        borderColor: typeof source.borderColor === 'string' ? source.borderColor : undefined,
        radius: source.radius != null ? Number(source.radius) : undefined,
      } as InputFieldElementDef;
    case 'chart':
      return {
        ...base,
        type: 'chart',
        chartType: source.chartType ?? 'bar',
        source: source.source ?? 'business-table',
        title: typeof source.title === 'string' ? source.title : undefined,
        subtitle: typeof source.subtitle === 'string' ? source.subtitle : undefined,
        tableName: typeof source.tableName === 'string' ? source.tableName : undefined,
        labelColumn: typeof source.labelColumn === 'string' ? source.labelColumn : undefined,
        valueColumn: typeof source.valueColumn === 'string' ? source.valueColumn : undefined,
        aggregation: source.aggregation ?? 'sum',
        filters: normalizeStringMap(source.filters),
        colorPalette: Array.isArray(source.colorPalette) ? source.colorPalette.map(String) : undefined,
        backgroundColor: typeof source.backgroundColor === 'string' ? source.backgroundColor : undefined,
        textColor: typeof source.textColor === 'string' ? source.textColor : undefined,
        emptyLabel: typeof source.emptyLabel === 'string' ? source.emptyLabel : undefined,
      } as ChartElementDef;
    case 'upload':
      return {
        ...base,
        type: 'upload',
        bucket: source.bucket ?? 'assets',
        pathTemplate: typeof source.pathTemplate === 'string' ? source.pathTemplate : undefined,
        accept: Array.isArray(source.accept) ? source.accept.map(String) : undefined,
        buttonLabel: typeof source.buttonLabel === 'string' ? source.buttonLabel : undefined,
        backgroundColor: typeof source.backgroundColor === 'string' ? source.backgroundColor : undefined,
        textColor: typeof source.textColor === 'string' ? source.textColor : undefined,
        borderColor: typeof source.borderColor === 'string' ? source.borderColor : undefined,
        radius: source.radius != null ? Number(source.radius) : undefined,
      } as UploadElementDef;
    case 'cart-widget':
      return {
        ...base,
        type: 'cart-widget',
        title: typeof source.title === 'string' ? source.title : undefined,
        subtitle: typeof source.subtitle === 'string' ? source.subtitle : undefined,
        productTable: typeof source.productTable === 'string' ? source.productTable : undefined,
        displayColumns: Array.isArray(source.displayColumns) ? source.displayColumns.map(String) : ['name'],
        priceColumn: typeof source.priceColumn === 'string' ? source.priceColumn : undefined,
        orderTable: typeof source.orderTable === 'string' ? source.orderTable : undefined,
        submitLabel: typeof source.submitLabel === 'string' ? source.submitLabel : undefined,
        emptyLabel: typeof source.emptyLabel === 'string' ? source.emptyLabel : undefined,
        backgroundColor: typeof source.backgroundColor === 'string' ? source.backgroundColor : undefined,
        panelColor: typeof source.panelColor === 'string' ? source.panelColor : undefined,
        textColor: typeof source.textColor === 'string' ? source.textColor : undefined,
        accentColor: typeof source.accentColor === 'string' ? source.accentColor : undefined,
        borderColor: typeof source.borderColor === 'string' ? source.borderColor : undefined,
        radius: source.radius != null ? Number(source.radius) : undefined,
      } as CartWidgetElementDef;
    case 'scan-field':
      return {
        ...base,
        type: 'scan-field',
        fieldName: String(source.fieldName ?? 'scan_value'),
        placeholder: typeof source.placeholder === 'string' ? source.placeholder : undefined,
        burstThresholdMs: source.burstThresholdMs != null ? Number(source.burstThresholdMs) : undefined,
        backgroundColor: typeof source.backgroundColor === 'string' ? source.backgroundColor : undefined,
        textColor: typeof source.textColor === 'string' ? source.textColor : undefined,
        borderColor: typeof source.borderColor === 'string' ? source.borderColor : undefined,
        radius: source.radius != null ? Number(source.radius) : undefined,
      } as ScanFieldElementDef;
    default:
      return null;
  }
}

function normalizeModal(raw: unknown): ModalLayerDef | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, any>;

  return {
    id: String(source.id ?? crypto.randomUUID()),
    name: String(source.name ?? 'Modal'),
    presentation: source.presentation ?? 'custom',
    elements: Array.isArray(source.elements)
      ? source.elements.map(normalizeElement).filter((item): item is ElementDef => Boolean(item))
      : [],
  };
}

export function normalizeLayout(layout?: Partial<UiLayout> | null): UiLayout {
  const source = layout && typeof layout === 'object' ? layout : {};

  return {
    version: Number(source.version ?? DEFAULT_LAYOUT.version),
    resolution: {
      width: Number(source.resolution?.width ?? DEFAULT_LAYOUT.resolution.width),
      height: Number(source.resolution?.height ?? DEFAULT_LAYOUT.resolution.height),
    },
    theme: normalizeTheme(source.theme),
    elements: Array.isArray(source.elements)
      ? source.elements.map(normalizeElement).filter((item): item is ElementDef => Boolean(item))
      : [],
    modals: Array.isArray(source.modals)
      ? source.modals.map(normalizeModal).filter((item): item is ModalLayerDef => Boolean(item))
      : [],
  };
}

export function cloneLayout(layout: UiLayout): UiLayout {
  return clone(layout);
}

export function getElementEvents(element: ElementDef): ElementEventBinding[] {
  return normalizeEvents(element.events, 'action' in element ? element.action : undefined);
}
