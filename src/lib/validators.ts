import z from 'zod'

import Logger from '../core/logger.js'

export const UUIDValidator = (value: string) => {
  const uuidSchema = z.string().uuid()

  if (!value) {
    return false
  }

  try {
    uuidSchema.parse(value)
    return true
  } catch (e) {
    Logger.info(`UUIDValidator: ${e}`)
    return false
  }
}
