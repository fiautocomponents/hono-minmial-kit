import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { every } from 'hono/combine'
import { decode } from 'hono/jwt'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi/zod'
import { StatusCodes } from 'http-status-codes'

import type { Env } from '../core/config-factory.js'
import { createUserJWT } from '../core/security.js'
import { Tokens } from '../entities/Tokens.js'
import { Users } from '../entities/Users.js'
import { TokenScope } from '../lib/enums.js'
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../lib/errors.js'
import { defaultMailContext } from '../lib/mailer.js'
import { RecoverAccountTemplate } from '../lib/templater.js'
import { JWTUnauthorizedEntitySchema, zodUnprocessableEntitySchema } from '../schemas/errors.js'
import {
  activateUserRequest,
  createOrganizationRequest,
  loginRequest,
  recoverAccountRequest,
  resetPasswordRequest,
  xATokenHeader,
  xRTokenHeader,
} from '../schemas/requests.js'
import { mapToLoginResponse } from '../schemas/response-converter.js'
import { loginResponse } from '../schemas/responses.js'
import { findAuthUser, requiresJWTAuth } from '../utils/middlewares.js'

const authRouter = new Hono<Env>()
authRouter.post(
  '/login',
  describeRoute({
    description: 'Login a user',
    tags: ['Authentication'],
    security: [], // No security required
    requestBody: {
      content: {
        'application/json': {
          schema: resolver(createOrganizationRequest),
        },
      },
    },
    validateResponse: true,
    responses: {
      [StatusCodes.OK]: {
        description: 'Users logged in successfully',
        content: {
          'application/json': {
            schema: resolver(loginResponse),
          },
        },
        headers: {
          Authorization: {
            description: 'Bearer token',
            schema: {
              type: 'string',
              example: 'Bearer YOUR_TOKEN',
            },
          },
        },
      },
      [StatusCodes.FORBIDDEN]: {
        description: 'User belongs to a deleted organization',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'User belongs to a deleted organization. Please contact support.',
                },
              },
            },
          },
        },
      },
      [StatusCodes.UNAUTHORIZED]: {
        description: 'Invalid email or password',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Invalid email or password' },
              },
            },
          },
        },
      },
      [StatusCodes.UNPROCESSABLE_ENTITY]: {
        description: 'Invalid request body',
        content: {
          'application/json': {
            schema: zodUnprocessableEntitySchema(),
          },
        },
      },
    },
  }),
  zValidator('json', loginRequest),
  async (ctx) => {
    const { email, password } = ctx.req.valid('json')

    const user = await ctx.var.em.findOneOrFail(
      Users,
      { email },
      {
        populate: ['role', 'organization'],
        failHandler: () => {
          throw new UnauthorizedError('Invalid email or password')
        },
      }
    )

    if (user.organization && user.organization.deletedAt) {
      throw new ForbiddenError('User belongs to a deleted organization. Please contact support.')
    }

    if (!user.validatePassword(password)) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
    const token = await createUserJWT(ctx, user, TokenScope.ACCESS, exp)

    user.lastLoginAt = new Date()
    await ctx.var.em.flush()

    await ctx.var.em.populate(user, ['role', 'organization'])
    ctx.header('Authorization', `Bearer ${token}`)
    ctx.header('Access-Control-Expose-Headers', 'Authorization')

    return ctx.json(mapToLoginResponse(user), StatusCodes.OK)
  }
)

authRouter.get(
  '/refresh',
  describeRoute({
    description: 'Get a new access token',
    tags: ['Authentication'],
    validateResponse: true,
    responses: {
      [StatusCodes.OK]: {
        description: 'New access token generated',
        content: {
          'application/json': {
            schema: resolver(loginResponse),
          },
        },
        headers: {
          Authorization: {
            description: 'Bearer token',
            schema: {
              type: 'string',
              example: 'Bearer YOUR_TOKEN',
            },
          },
        },
      },
      [StatusCodes.UNAUTHORIZED]: {
        description: 'Invalid token',
        content: {
          'application/json': {
            schema: JWTUnauthorizedEntitySchema(),
          },
        },
      },
      [StatusCodes.FORBIDDEN]: {
        description: 'User belongs to a deleted organization',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'User belongs to a deleted organization. Please contact support.',
                },
              },
            },
          },
        },
      },
    },
  }),
  every(requiresJWTAuth, findAuthUser),
  async (ctx) => {
    const user = ctx.var.user

    if (user.organization && user.organization.deletedAt) {
      throw new BadRequestError('User belongs to a deleted organization. Please contact support.')
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
    const token = await createUserJWT(ctx, user, TokenScope.ACCESS, exp)

    ctx.header('Authorization', `Bearer ${token}`)
    ctx.header('Access-Control-Expose-Headers', 'Authorization')

    return ctx.json(mapToLoginResponse(user), StatusCodes.OK)
  }
)

authRouter.patch(
  '/activate',
  describeRoute({
    description:
      'Activate a user that was created by someone inside the application and fulfill the registration process',
    tags: ['Authentication'],
    validateResponse: true,
    security: [],
    responses: {
      [StatusCodes.OK]: {
        description: 'User activated successfully',
        content: {
          'application/json': {
            schema: resolver(loginResponse),
          },
        },
        headers: {
          Authorization: {
            description: 'Bearer token',
            schema: {
              type: 'string',
              example: 'Bearer YOUR_TOKEN',
            },
          },
        },
      },
      [StatusCodes.BAD_REQUEST]: {
        description: 'Activation token not provided | already used',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Activation token not provided' },
              },
            },
          },
        },
      },
      [StatusCodes.UNAUTHORIZED]: {
        description: 'Invalid token',
        content: {
          'application/json': {
            schema: JWTUnauthorizedEntitySchema(),
          },
        },
      },
      [StatusCodes.FORBIDDEN]: {
        description: 'User belongs to a deleted organization',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'User belongs to a deleted organization. Please contact support.',
                },
              },
            },
          },
        },
      },
      [StatusCodes.NOT_FOUND]: {
        description: 'User | Token not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'User | Token not found' },
              },
            },
          },
        },
      },
    },
  }),
  zValidator('json', activateUserRequest),
  zValidator('header', xATokenHeader),
  async (ctx) => {
    const { password, firstName, lastName } = ctx.req.valid('json')

    const activateTokenHeader = ctx.req.header('X-A-Token')
    if (!activateTokenHeader) {
      throw new BadRequestError('Activation token not provided')
    }

    const { payload } = decode(activateTokenHeader)

    if (!payload.sub) {
      throw new BadRequestError('Invalid token')
    }

    if (payload.scope !== TokenScope.ACTIVATE) {
      throw new UnauthorizedError('Invalid JWT Token: Scope is not ACTIVATE')
    }

    const activateToken = await ctx.var.em.findOneOrFail(
      Tokens,
      { token: activateTokenHeader },
      {
        failHandler: () => {
          throw new NotFoundError('Token not found')
        },
      }
    )

    if (activateToken.usedAt) {
      throw new BadRequestError('Activation token is already used')
    }

    const user = await ctx.var.em.findOneOrFail(
      Users,
      { _id: payload.sub },
      {
        populate: ['role', 'organization'],
        failHandler: () => {
          throw new NotFoundError('User not found')
        },
      }
    )

    if (user.organization && user.organization.deletedAt) {
      throw new ForbiddenError('User belongs to a deleted organization. Please contact support.')
    }

    if (user.activeAt) {
      throw new BadRequestError('User is already active')
    }

    if (!user.hashedPassword && !user.salt && !password) {
      throw new BadRequestError('Password is required to activate the user')
    }

    const now = new Date()
    user.activeAt = now
    user.lastLoginAt = now

    if (!user.hashedPassword && !user.salt && password) {
      user.changePassword(password)
    }

    user.firstName = firstName ?? undefined
    user.lastName = lastName ?? undefined

    activateToken.usedAt = now

    await ctx.var.em.flush()

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
    const token = await createUserJWT(ctx, user, TokenScope.ACCESS, exp)

    ctx.header('Authorization', `Bearer ${token}`)
    ctx.header('Access-Control-Expose-Headers', 'Authorization')

    return ctx.json(mapToLoginResponse(user), StatusCodes.OK)
  }
)

authRouter.post(
  '/recover',
  describeRoute({
    description: 'Recover the account of a user, sending an email with instructions',
    tags: ['Authentication'],
    validateResponse: true,
    security: [],
    responses: {
      [StatusCodes.OK]: {
        description: 'Email sent with recovery instructions',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Email sent with recovery instructions' },
              },
            },
          },
        },
      },
    },
  }),
  zValidator('json', recoverAccountRequest),
  async (ctx) => {
    const { email } = ctx.req.valid('json')

    const user = await ctx.var.em.findOne(Users, { email })

    if (!user) {
      const randomDelay = Math.floor(Math.random() * 150) + 150 // between 150 and 300
      await new Promise((resolve) => setTimeout(resolve, randomDelay))
      return ctx.json({ message: 'Email sent with recovery instructions' }, StatusCodes.OK)
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
    const token = await createUserJWT(ctx, user, TokenScope.RESET, exp)

    defaultMailContext
      .sendMail(
        [user.email],
        'We are here to help you recover your account',
        undefined,
        new RecoverAccountTemplate()
          .setResetPasswordURL(`https://${env(ctx).DOMAIN}/reset-password?t=${token}`)
          .build()
      )
      .catch((error) => {
        console.error(error)
      })

    return ctx.json({ message: 'Email sent with recovery instructions' }, StatusCodes.OK)
  }
)

authRouter.patch(
  '/reset-password',
  describeRoute({
    description: 'Reset the password of a user',
    tags: ['Authentication'],
    validateResponse: true,
    security: [],
    responses: {
      [StatusCodes.OK]: {
        description: 'Password reset successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Password reset successfully' },
              },
            },
          },
        },
      },
      [StatusCodes.BAD_REQUEST]: {
        description: 'Reset token not provided | already used',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Reset token not provided' },
              },
            },
          },
        },
      },
      [StatusCodes.UNAUTHORIZED]: {
        description: 'Invalid token',
        content: {
          'application/json': {
            schema: JWTUnauthorizedEntitySchema(),
          },
        },
      },
      [StatusCodes.FORBIDDEN]: {
        description: 'User belongs to a deleted organization',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'User belongs to a deleted organization. Please contact support.',
                },
              },
            },
          },
        },
      },
      [StatusCodes.NOT_FOUND]: {
        description: 'User | Token not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'User | Token not found' },
              },
            },
          },
        },
      },
    },
  }),
  zValidator('json', resetPasswordRequest),
  zValidator('header', xRTokenHeader),
  async (ctx) => {
    const { password, email } = ctx.req.valid('json')

    const resetTokenHeader = ctx.req.header('X-R-Token')
    if (!resetTokenHeader) {
      throw new BadRequestError('Reset token not provided')
    }

    const { payload } = decode(resetTokenHeader)

    if (!payload.sub) {
      throw new BadRequestError('Invalid token')
    }

    if (payload.scope !== TokenScope.RESET) {
      throw new UnauthorizedError('Invalid JWT Token: Scope is not RESET')
    }

    const token = await ctx.var.em.findOneOrFail(
      Tokens,
      { token: resetTokenHeader },
      {
        failHandler: () => {
          throw new NotFoundError('Token not found')
        },
      }
    )

    if (token.usedAt) {
      throw new BadRequestError('Reset token is already used')
    }

    const user = await ctx.var.em.findOneOrFail(
      Users,
      { _id: payload.sub },
      {
        populate: ['role', 'organization'],
        failHandler: () => {
          throw new NotFoundError('User not found')
        },
      }
    )

    if (user.organization && user.organization.deletedAt) {
      throw new ForbiddenError('User belongs to a deleted organization. Please contact support.')
    }

    if (user.email !== email) {
      throw new UnauthorizedError('Invalid JWT Token: Email does not match')
    }

    user.changePassword(password)

    token.usedAt = new Date()

    await ctx.var.em.flush()

    return ctx.json({ message: 'Password reset successfully' }, StatusCodes.OK)
  }
)

export default authRouter
