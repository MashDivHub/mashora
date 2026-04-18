import type { ComponentType } from 'react'
import CharFieldComponent from './CharField'
import TextFieldComponent from './TextField'
import IntegerFieldComponent from './IntegerField'
import FloatFieldComponent from './FloatField'
import MonetaryFieldComponent from './MonetaryField'
import BooleanFieldComponent from './BooleanField'
import DateFieldComponent from './DateField'
import DateTimeFieldComponent from './DateTimeField'
import SelectionFieldComponent from './SelectionField'
import Many2OneFieldComponent from './Many2OneField'
import One2ManyFieldComponent from './One2ManyField'
import Many2ManyFieldComponent from './Many2ManyField'
import BinaryFieldComponent from './BinaryField'

// FieldProps is the shared contract for all field components. Because fields
// accept arbitrary ERP field values (strings, numbers, tuples, arrays, etc.),
// `value`/`onChange`/`record`/`fieldMeta[key]` are intentionally typed `any` —
// narrowing to `unknown` cascades errors into 13+ field component files where
// the value is unpacked by widget-specific code. Each field already narrows
// internally via `typeof`/`Array.isArray`. See DataTable.tsx Column<T> for the
// same trade-off.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface FieldProps {
  name: string
  value: any
  fieldMeta: {
    type: string
    string: string
    required?: boolean
    readonly?: boolean
    help?: string
    selection?: [string, string][]
    relation?: string
    digits?: [number, number]
    currency_field?: string
    [key: string]: any
  }
  record: Record<string, any>
  onChange?: (value: any) => void
  readonly?: boolean
  required?: boolean
  invisible?: boolean
  widget?: string
  className?: string
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Registry populated at module load time
const registry: Record<string, ComponentType<FieldProps>> = {
  char: CharFieldComponent,
  text: TextFieldComponent,
  html: TextFieldComponent,
  integer: IntegerFieldComponent,
  float: FloatFieldComponent,
  monetary: MonetaryFieldComponent,
  boolean: BooleanFieldComponent,
  date: DateFieldComponent,
  datetime: DateTimeFieldComponent,
  selection: SelectionFieldComponent,
  many2one: Many2OneFieldComponent,
  one2many: One2ManyFieldComponent,
  many2many: Many2ManyFieldComponent,
  binary: BinaryFieldComponent,
  // Aliases
  reference: CharFieldComponent,
  json: CharFieldComponent,
  properties: CharFieldComponent,
  many2one_reference: IntegerFieldComponent,
}

export function registerField(type: string, component: ComponentType<FieldProps>, widget?: string): void {
  const key = widget ? `${type}:${widget}` : type
  registry[key] = component
}

export function getFieldComponent(type: string, widget?: string): ComponentType<FieldProps> {
  if (widget) {
    const specific = registry[`${type}:${widget}`]
    if (specific) return specific
  }
  return registry[type] || registry['char']
}

// Re-export for direct imports
export { default as CharField } from './CharField'
export { default as TextField } from './TextField'
export { default as IntegerField } from './IntegerField'
export { default as FloatField } from './FloatField'
export { default as MonetaryField } from './MonetaryField'
export { default as BooleanField } from './BooleanField'
export { default as DateField } from './DateField'
export { default as DateTimeField } from './DateTimeField'
export { default as SelectionField } from './SelectionField'
export { default as Many2OneField } from './Many2OneField'
export { default as One2ManyField } from './One2ManyField'
export { default as Many2ManyField } from './Many2ManyField'
export { default as BinaryField } from './BinaryField'
