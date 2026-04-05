/**
 * High-level ERP API client with typed CRUD operations.
 * Wraps the base API client with Mashora-specific methods.
 */
import { type AxiosInstance } from 'axios'
import { createApiClient, type ApiClientConfig } from './client'
import { type SearchParams, type SearchResult, type MethodCallParams, type FieldDefinition } from './types'

export interface ErpClient {
  /** Raw axios instance for custom requests */
  raw: AxiosInstance

  /** Search and read records from any model */
  list<T = Record<string, any>>(model: string, params?: SearchParams): Promise<SearchResult<T>>

  /** Read a single record by ID */
  get<T = Record<string, any>>(model: string, id: number, fields?: string[]): Promise<T>

  /** Create a new record */
  create<T = Record<string, any>>(model: string, vals: Record<string, any>): Promise<T>

  /** Update an existing record */
  update<T = Record<string, any>>(model: string, id: number, vals: Record<string, any>): Promise<T>

  /** Delete a record */
  remove(model: string, id: number): Promise<void>

  /** Call a model method (e.g., action_confirm, action_post) */
  call(model: string, params: MethodCallParams): Promise<any>

  /** Get field definitions for a model */
  fields(model: string, attributes?: string[]): Promise<Record<string, FieldDefinition>>

  /** Trigger an onchange computation */
  onchange(model: string, recordId: number | null, fieldName: string, fieldValue: any, currentValues: Record<string, any>): Promise<Record<string, any>>
}

export function createErpClient(config: ApiClientConfig): ErpClient {
  const client = createApiClient(config)

  return {
    raw: client,

    async list<T = Record<string, any>>(model: string, params?: SearchParams): Promise<SearchResult<T>> {
      const response = await client.post(`/model/${model}`, params ?? {})
      return response.data
    },

    async get<T = Record<string, any>>(model: string, id: number, fields?: string[]): Promise<T> {
      const query = fields ? `?fields=${fields.join(',')}` : ''
      const response = await client.get(`/model/${model}/${id}${query}`)
      return response.data
    },

    async create<T = Record<string, any>>(model: string, vals: Record<string, any>): Promise<T> {
      const response = await client.post(`/model/${model}/create`, { vals })
      return response.data
    },

    async update<T = Record<string, any>>(model: string, id: number, vals: Record<string, any>): Promise<T> {
      const response = await client.put(`/model/${model}/${id}`, { vals })
      return response.data
    },

    async remove(model: string, id: number): Promise<void> {
      await client.delete(`/model/${model}/${id}`)
    },

    async call(model: string, params: MethodCallParams): Promise<any> {
      const response = await client.post(`/model/${model}/call`, params)
      return response.data.result
    },

    async fields(model: string, attributes?: string[]): Promise<Record<string, FieldDefinition>> {
      const query = attributes ? `?attributes=${attributes.join(',')}` : ''
      const response = await client.get(`/model/${model}/fields${query}`)
      return response.data
    },

    async onchange(
      model: string,
      recordId: number | null,
      fieldName: string,
      fieldValue: any,
      currentValues: Record<string, any>
    ): Promise<Record<string, any>> {
      const response = await client.post(`/model/${model}/onchange`, {
        record_id: recordId,
        field_name: fieldName,
        field_value: fieldValue,
        current_values: currentValues,
      })
      return response.data.updated_fields
    },
  }
}
