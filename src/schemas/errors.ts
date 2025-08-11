export function zodUnprocessableEntitySchema() {
  return {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: false,
      },
      error: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            example: 'ZodError',
          },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                validation: {
                  type: 'string',
                  example: 'string | number | boolean | etc.',
                },
                code: {
                  type: 'string',
                  example: 'invalid_string | too_small | too_big | etc.',
                },
                message: {
                  type: 'string',
                  example: 'Invalid value provided | Required | etc.',
                },
                path: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['field_name'],
                },
                expected: {
                  type: 'string',
                  example: 'string | number | boolean | etc.',
                },
                received: {
                  type: 'string',
                  example: 'string | number | boolean | etc.',
                },
              },
            },
          },
        },
      },
    },
  }
}

export function JWTUnauthorizedEntitySchema() {
  return {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        example: 'JWTError',
      },
      message: {
        type: 'string',
        example: 'Unauthorized',
      },
      cause: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            example: 'JwtTokenInvalid | JwtTokenExpired | etc.',
          },
          message: {
            type: 'string',
            example: 'Invalid JWT token: YOUR_TOKEN',
          },
        },
      },
    },
  }
}
