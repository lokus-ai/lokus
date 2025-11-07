/**
 * @fileoverview Network API types
 */

/**
 * Network API interface
 */
export interface NetworkAPI {
  // TODO: Add network API methods
  fetch(url: string, options?: RequestOptions): Promise<Response>
}

/**
 * Request options
 */
export interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: string | Uint8Array
  timeout?: number
}

/**
 * Response interface
 */
export interface Response {
  status: number
  statusText: string
  headers: Record<string, string>
  text(): Promise<string>
  json(): Promise<unknown>
  arrayBuffer(): Promise<ArrayBuffer>
}
