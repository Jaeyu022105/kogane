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
  | 'cart-widget'
  | 'upload';

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

export interface RuntimeActionDefinition {
  type: RuntimeActionType;
  table?: string;
  payload?: RuntimePayloadValue;
  rowId?: RuntimePayloadValue;
  where?: Record<string, RuntimePayloadValue>;
  columns?: string[];
  limit?: number;
  offset?: number;
  targetElementId?: string;
  event?: string;
  bucket?: 'assets' | 'products' | 'backgrounds';
  path?: RuntimePayloadValue;
  accept?: string[];
  url?: string;
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
  tableName?: string;
  columns: string[];
  pageSize?: number;
  emptyLabel?: string;
}

export interface InputFieldElementDef extends BaseElementDef {
  type: 'input-field';
  fieldName: string;
  placeholder?: string;
  inputType: 'text' | 'number' | 'date' | 'select';
  options?: string[];
  submitGroup?: string;
  defaultValue?: string;
}

export interface CartWidgetElementDef extends BaseElementDef {
  type: 'cart-widget';
  productTable: string;
  orderTable: string;
  displayColumns: string[];
  priceColumn?: string;
}

export interface UploadElementDef extends BaseElementDef {
  type: 'upload';
  bucket: 'assets' | 'products' | 'backgrounds';
  pathTemplate?: string;
  accept?: string[];
  buttonLabel?: string;
}

export type ElementDef =
  | ButtonElementDef
  | TextElementDef
  | ImageElementDef
  | TableViewElementDef
  | InputFieldElementDef
  | CartWidgetElementDef
  | UploadElementDef;

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
  elements: ElementDef[];
  modals?: ModalLayerDef[];
}

export const DEFAULT_LAYOUT: UiLayout = {
  version: 2,
  resolution: { width: 1280, height: 720 },
  elements: [],
  modals: [],
};

export const TRIGGERS_BY_ELEMENT_TYPE: Record<ElementType, EventTrigger[]> = {
  button: ['click'],
  text: [],
  image: ['click'],
  'table-view': ['load'],
  'input-field': ['input:commit', 'submit', 'select:change'],
  'cart-widget': ['load'],
  upload: ['click'],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
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
        tableName: source.tableName ? String(source.tableName) : undefined,
        columns: Array.isArray(source.columns) ? source.columns.map(String) : [],
        pageSize: source.pageSize != null ? Number(source.pageSize) : undefined,
        emptyLabel: typeof source.emptyLabel === 'string' ? source.emptyLabel : undefined,
      } as TableViewElementDef;
    case 'input-field':
      return {
        ...base,
        type: 'input-field',
        fieldName: String(source.fieldName ?? 'value'),
        placeholder: typeof source.placeholder === 'string' ? source.placeholder : undefined,
        inputType: source.inputType ?? 'text',
        options: Array.isArray(source.options) ? source.options.map(String) : undefined,
        submitGroup: typeof source.submitGroup === 'string' ? source.submitGroup : undefined,
        defaultValue: typeof source.defaultValue === 'string' ? source.defaultValue : undefined,
      } as InputFieldElementDef;
    case 'cart-widget':
      return {
        ...base,
        type: 'cart-widget',
        productTable: String(source.productTable ?? ''),
        orderTable: String(source.orderTable ?? ''),
        displayColumns: Array.isArray(source.displayColumns) ? source.displayColumns.map(String) : [],
        priceColumn: typeof source.priceColumn === 'string' ? source.priceColumn : undefined,
      } as CartWidgetElementDef;
    case 'upload':
      return {
        ...base,
        type: 'upload',
        bucket: source.bucket ?? 'assets',
        pathTemplate: typeof source.pathTemplate === 'string' ? source.pathTemplate : undefined,
        accept: Array.isArray(source.accept) ? source.accept.map(String) : undefined,
        buttonLabel: typeof source.buttonLabel === 'string' ? source.buttonLabel : undefined,
      } as UploadElementDef;
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
