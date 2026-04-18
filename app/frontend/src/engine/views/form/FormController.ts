import { getChangedValues, type RecordState } from '../../state/RecordState'
import { fetchViewDefinition, fetchDefaults, callOnchange, callMethod, type ViewDefinition } from '../../ActionService'
import { erpClient } from '@/lib/erp-api'

export async function loadFormData(model: string, id: number | null): Promise<{ viewDef: ViewDefinition; record: Record<string, unknown> }> {
  const viewDef = await fetchViewDefinition(model, 'form')
  let record: Record<string, unknown> = {}

  if (id) {
    const { data } = await erpClient.raw.get(`/model/${model}/${id}`)
    record = data
  } else {
    record = await fetchDefaults(model)
    record.id = null
  }

  return { viewDef, record }
}

export async function saveRecord(model: string, state: RecordState): Promise<Record<string, unknown>> {
  const vals = getChangedValues(state)

  if (state.id) {
    const { data } = await erpClient.raw.put(`/model/${model}/${state.id}`, { vals })
    return data
  } else {
    const { data } = await erpClient.raw.post(`/model/${model}/create`, { vals: { ...state.data, ...vals } })
    return data
  }
}

export async function handleOnchange(model: string, recordId: number | null, fieldName: string, fieldValue: unknown, currentValues: Record<string, unknown>): Promise<Record<string, unknown>> {
  return callOnchange(model, recordId, fieldName, fieldValue, currentValues)
}

export async function executeButton(model: string, recordId: number, method: string): Promise<unknown> {
  return callMethod(model, [recordId], method)
}
