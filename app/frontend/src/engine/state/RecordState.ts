export interface RecordState {
  model: string
  id: number | null  // null = new record (create mode)
  data: Record<string, any>
  originalData: Record<string, any>
  dirtyFields: Set<string>
  errors: Record<string, string>
  isLoading: boolean
  isSaving: boolean
}

export function createRecordState(model: string, id: number | null, data: Record<string, any> = {}): RecordState {
  return {
    model,
    id,
    data: { ...data },
    originalData: { ...data },
    dirtyFields: new Set(),
    errors: {},
    isLoading: false,
    isSaving: false,
  }
}

export function updateField(state: RecordState, field: string, value: unknown): RecordState {
  const newData = { ...state.data, [field]: value }
  const newDirty = new Set(state.dirtyFields)
  if (JSON.stringify(value) !== JSON.stringify(state.originalData[field])) {
    newDirty.add(field)
  } else {
    newDirty.delete(field)
  }
  return { ...state, data: newData, dirtyFields: newDirty }
}

export function mergeOnchangeResult(state: RecordState, updates: Record<string, any>): RecordState {
  const newData = { ...state.data, ...updates }
  return { ...state, data: newData }
}

export function markSaved(state: RecordState, newData?: Record<string, any>): RecordState {
  const data = newData || state.data
  return {
    ...state,
    data: { ...data },
    originalData: { ...data },
    dirtyFields: new Set(),
    errors: {},
    isSaving: false,
  }
}

export function isDirty(state: RecordState): boolean {
  return state.dirtyFields.size > 0
}

export function getChangedValues(state: RecordState): Record<string, any> {
  const vals: Record<string, any> = {}
  for (const field of state.dirtyFields) {
    vals[field] = state.data[field]
  }
  return vals
}
