import type { TokenScope } from './enums.js'

export interface JWTPayload {
  sub: string
  exp?: number
  scope: TokenScope

  [key: string]: unknown
}

export interface TCursor<T> {
  items: T[]
  startCursor: string | null
  endCursor: string | null
  totalCount: number
  hasPrevPage: boolean
  hasNextPage: boolean
  length: number
}

export type Comparator<T> = (a: T, b: T) => number
