/**
 * Shared type definitions for UI layouts and elements.
 * These are used by both the builder (editor) and renderer (terminal viewer).
 */

// ── Element Types ────────────────────────────────────────────────────────────

export type ElementType =
  | 'button'
  | 'text'
  | 'image'
  | 'table-view'
  | 'input-field'
  | 'cart-widget';

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

// Shared props common to every element
export interface BaseElementDef {
  id: string;
  type: ElementType;
  position: ElementPosition;
  label?: string;
}

// Button element
export interface ButtonElementDef extends BaseElementDef {
  type: 'button';
  text: string;
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  action?: ElementAction;
}

// Static or dynamic text
export interface TextElementDef extends BaseElementDef {
  type: 'text';
  content: string;
  fontSize: number;
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
}

// Image element
export interface ImageElementDef extends BaseElementDef {
  type: 'image';
  src: string;
  fit: 'cover' | 'contain' | 'fill';
  radius?: number;
}

// Table view — links to a user-defined table
export interface TableViewElementDef extends BaseElementDef {
  type: 'table-view';
  tableName: string;
  columns: string[];
  pageSize?: number;
}

// Input field
export interface InputFieldElementDef extends BaseElementDef {
  type: 'input-field';
  fieldName: string;
  placeholder?: string;
  inputType: 'text' | 'number' | 'date' | 'select';
  options?: string[]; // for select type
}

// Cart / order widget
export interface CartWidgetElementDef extends BaseElementDef {
  type: 'cart-widget';
  productTable: string;
  orderTable: string;
  displayColumns: string[];
}

export type ElementDef =
  | ButtonElementDef
  | TextElementDef
  | ImageElementDef
  | TableViewElementDef
  | InputFieldElementDef
  | CartWidgetElementDef;

// ── Actions ─────────────────────────────────────────────────────────────────

export type ActionType =
  | 'none'
  | 'navigate'
  | 'insert-record'
  | 'custom-script';

export type ActionPayloadMapping =
  | { type: 'static'; value: string }
  | { type: 'element_value'; elementId: string };

export interface ElementAction {
  type: ActionType;
  payload: {
    // For navigate
    url?: string;
    // For insert-record
    tableName?: string;
    dataMapping?: Record<string, ActionPayloadMapping>;
    // For custom-script
    script?: string;
    [key: string]: any;
  };
}

// ── Layout ──────────────────────────────────────────────────────────────────

export interface UiLayout {
  version: number;
  resolution: { width: number; height: number };
  elements: ElementDef[];
}

export const DEFAULT_LAYOUT: UiLayout = {
  version: 1,
  resolution: { width: 1280, height: 720 },
  elements: [],
};
