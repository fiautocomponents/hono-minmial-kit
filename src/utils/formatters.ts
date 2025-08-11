import { ImplementationError } from '../lib/errors.js'

export const formatUnionStringOrArrayToArray = (
  value: string | string[] | undefined
): string[] | undefined => {
  if (value && typeof value === 'string') {
    return [value]
  }

  if (value && Array.isArray(value)) {
    return value
  }

  if (value === undefined) {
    return undefined
  }

  throw new ImplementationError(
    `Expected value to be a string or an array, but got ${typeof value}`
  )
}
