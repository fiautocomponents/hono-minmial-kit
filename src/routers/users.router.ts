import { Hono } from 'hono'
import { every } from 'hono/combine'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'
import { StatusCodes } from 'http-status-codes'

import type { Env } from '../core/config-factory.js'
import { Users } from '../entities/Users.js'
import { NotFoundError } from '../lib/errors.js'
import { JWTUnauthorizedEntitySchema } from '../schemas/errors.js'
import { userResponse } from '../schemas/responses.js'
import { findAuthUser, requiresJWTAuth } from '../utils/middlewares.js'

const usersRouter = new Hono<Env>()

usersRouter.get(
  '/:_id',
  describeRoute({
    description: 'Get user by ID',
    tags: ['Users'],
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: '_id',
        in: 'path',
        required: true,
        schema: {
          type: 'number',
          example: '1',
        },
      },
    ],
    validateResponse: true,
    responses: {
      [StatusCodes.OK]: {
        description: 'Users retrieved successfully',
        content: {
          'application/json': {
            schema: resolver(userResponse),
          },
        },
      },
      [StatusCodes.NOT_FOUND]: {
        description: 'Users not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Users not found' },
              },
            },
          },
        },
      },
      [StatusCodes.UNAUTHORIZED]: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: JWTUnauthorizedEntitySchema(),
          },
        },
      },
    },
  }),
  every(requiresJWTAuth, findAuthUser),
  async (ctx) => {
    const _id = ctx.req.param('_id')
    const user = await ctx.var.em.findOneOrFail(Users, _id, {
      failHandler: () => {
        throw new NotFoundError('Users not found')
      },
    })

    return ctx.json({ user }, StatusCodes.OK)
  }
)
export default usersRouter
