import { HTTPException } from 'hono/http-exception'
import { StatusCodes } from 'http-status-codes'
import { ZodError } from 'zod'

export class ImplementationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImplementationError'
    this.message = message
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BadRequestError'
    this.message = message
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
    this.message = message
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
    this.message = message
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
    this.message = message
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
    this.message = message
  }
}

interface ErrorCause {
  name?: string
  message?: string
}

interface ErrorDetails {
  name: string
  message: string
  cause?: {
    name?: string
    message?: string
  }
  validationError?: object
  issues?: unknown
}

type DetailedError = Error & { detail?: string }

export function makeError<TError extends Error>(
  error: TError
): { statusCode: number; error: ErrorDetails } {
  const defaultError = {
    name: error.name,
    message: error.message,
    cause: error.cause
      ? {
          name: (error.cause as ErrorCause).name || undefined,
          message: (error.cause as ErrorCause).message || undefined,
        }
      : undefined,
  }

  /* Custom Errors */
  if (error.message.includes('Malformed JSON')) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      error: { name: 'BadRequestError', message: error.message },
    }
  }

  if (error instanceof ImplementationError) {
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      error: defaultError,
    }
  }

  if (error instanceof BadRequestError) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      error: defaultError,
    }
  }

  if (error instanceof UnauthorizedError) {
    return {
      statusCode: StatusCodes.UNAUTHORIZED,
      error: defaultError,
    }
  }

  if (error instanceof ForbiddenError) {
    return {
      statusCode: StatusCodes.FORBIDDEN,
      error: defaultError,
    }
  }

  if (error instanceof NotFoundError) {
    return {
      statusCode: StatusCodes.NOT_FOUND,
      error: defaultError,
    }
  }

  if (error instanceof ConflictError) {
    return {
      statusCode: StatusCodes.CONFLICT,
      error: defaultError,
    }
  }

  /* Library Errors */
  if (error instanceof ZodError) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      error: {
        ...defaultError,
        issues: error.issues,
      },
    }
  }

  if (error instanceof HTTPException) {
    if (defaultError?.cause?.name?.toUpperCase().includes('JWT')) {
      defaultError.name = 'JWTError'
      return {
        statusCode: error.status,
        error: defaultError,
      }
    }

    if (defaultError?.cause?.name?.toUpperCase().includes('ZOD')) {
      console.error('ZodError', defaultError?.message)
      if (defaultError?.message?.toUpperCase().includes('RESPONSE VALIDATION FAILED!')) {
        defaultError.name = 'ResponseValidationError'
        return {
          statusCode: error.status,
          error: {
            name: defaultError.name,
            message: 'Please check the response validation. Contact the server administrator.',
            validationError: JSON.parse(defaultError?.cause?.message || '{}'),
          },
        }
      }

      defaultError.name = 'ZodError'
      return {
        statusCode: error.status,
        error: {
          name: defaultError.name,
          message: defaultError.message,
        },
      }
    }

    if (
      error?.res?.headers.get('WWW-Authenticate')?.includes('no authorization included in request')
    ) {
      return {
        statusCode: StatusCodes.UNAUTHORIZED,
        error: {
          name: 'UnauthorizedError',
          message: 'No authorization included in the request',
        },
      }
    }
  }

  if (error.name === 'UniqueConstraintViolationException') {
    /**
     * It is recommended to handle this type of error inside the service.
     * This acts like a last resort.
     */

    return {
      statusCode: StatusCodes.CONFLICT,
      error: {
        name: 'ConflictError',
        message: `Resource already exists: ${(error as unknown as DetailedError).detail}`,
      },
    }
  }

  return {
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    error: defaultError,
  }
}

export function makeUniqueError(error: unknown, message: string): void {
  if (error instanceof Error) {
    if (error.name === 'UniqueConstraintViolationException') {
      throw new ConflictError(message)
    }

    throw error
  }

  throw new Error('Unknown error')
}
