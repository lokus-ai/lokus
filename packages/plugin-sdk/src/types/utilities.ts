/**
 * @fileoverview Utility types and interfaces
 */

/**
 * Disposable interface for resource cleanup
 */
export interface Disposable {
  /**
   * Dispose the resource
   */
  dispose(): void
}

/**
 * Event interface
 */
export interface Event<T> {
  /**
   * Subscribe to event
   */
  (listener: (e: T) => unknown, thisArgs?: unknown, disposables?: Disposable[]): Disposable
}

/**
 * URI interface
 */
export interface URI {
  /** URI scheme */
  scheme: string
  
  /** URI authority */
  authority: string
  
  /** URI path */
  path: string
  
  /** URI query */
  query: string
  
  /** URI fragment */
  fragment: string
  
  /** File system path */
  fsPath: string
  
  /** Convert to string */
  toString(): string
  
  /** Convert to JSON */
  toJSON(): object
}

/**
 * Thenable interface
 */
export interface Thenable<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | Thenable<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | Thenable<TResult2>) | undefined | null
  ): Thenable<TResult1 | TResult2>
}

/**
 * Readonly array type
 */
export type ReadonlyArray<T> = readonly T[]

/**
 * Deep readonly type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

/**
 * Partial deep type
 */
export type PartialDeep<T> = {
  [P in keyof T]?: T[P] extends object ? PartialDeep<T[P]> : T[P]
}

/**
 * Required deep type
 */
export type RequiredDeep<T> = {
  [P in keyof T]-?: T[P] extends object ? RequiredDeep<T[P]> : T[P]
}

/**
 * JSON serializable types
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONArray

export interface JSONObject {
  [key: string]: JSONValue
}

export interface JSONArray extends Array<JSONValue> {}

/**
 * Constructor type
 */
export type Constructor<T = {}> = new (...args: any[]) => T

/**
 * Class decorator
 */
export type ClassDecorator = <TFunction extends Function>(target: TFunction) => TFunction | void

/**
 * Method decorator
 */
export type MethodDecorator = <T>(
  target: any,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> | void

/**
 * Property decorator
 */
export type PropertyDecorator = (target: any, propertyKey: string | symbol) => void

/**
 * Parameter decorator
 */
export type ParameterDecorator = (
  target: any,
  propertyKey: string | symbol | undefined,
  parameterIndex: number
) => void