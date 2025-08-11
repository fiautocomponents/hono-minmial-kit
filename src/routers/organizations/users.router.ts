import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { every, some } from 'hono/combine'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi/zod'
import { StatusCodes } from 'http-status-codes'

import type { Env } from '../../core/config-factory.js'
import { createUserJWT } from '../../core/security.js'
import { Roles } from '../../entities/Roles.js'
import { Users } from '../../entities/Users.js'
import { TokenScope, UserRoles } from '../../lib/enums.js'
import { ForbiddenError, NotFoundError } from '../../lib/errors.js'
import { defaultMailContext } from '../../lib/mailer.js'
import { NewUserInOrganizationTemplate } from '../../lib/templater.js'
import { JWTUnauthorizedEntitySchema } from '../../schemas/errors.js'
import {
  createOrganizationUserRequest,
  filterOrganizationUsersRequest,
  patchOrganizationUserRequest,
} from '../../schemas/requests.js'
import { mapToUserResponse, mapToUsersResponse } from '../../schemas/response-converter.js'
import { userResponse, usersResponse } from '../../schemas/responses.js'
import {
  requiresJWTAuth,
  requiresOrganizationSubscriptionPlanOneActive,
  requiresOrganizationSubscriptionPlanTwoActive,
  requiresSchoolAdmin,
} from '../../utils/middlewares.js'

const usersRouter = new Hono<Env>()

usersRouter.get(
  '/',
  describeRoute({
    description:
      'Get all organization users. Available for: plan one and plan two subscription plans',
    tags: ['Organization Users'],
    validateResponse: true,
    responses: {
      [StatusCodes.OK]: {
        description: 'Organization users retrieved successfully',
        content: {
          'application/json': {
            schema: resolver(usersResponse),
          },
        },
      },
    },
  }),
  zValidator('query', filterOrganizationUsersRequest),
  every(
    requiresJWTAuth,
    requiresSchoolAdmin,
    some(
      requiresOrganizationSubscriptionPlanOneActive,
      requiresOrganizationSubscriptionPlanTwoActive
    )
  ),
  async (ctx) => {
    const { size, endCursor, email, firstName, lastName, role } = ctx.req.valid('query')

    const users = await ctx.var.em.findByCursor(
      Users,
      {
        organization: ctx.var.organization,
        ...(email ? { email: { $ilike: `%${email}%` } } : {}),
        ...(firstName ? { firstName: { $ilike: `%${firstName}%` } } : {}),
        ...(lastName ? { lastName: { $ilike: `%${lastName}%` } } : {}),
        ...(role ? { role: { name: { $eq: role } } } : {}),
      },
      {
        populate: ['organization', 'role'],
        first: size,
        after: endCursor,
        orderBy: {
          createdAt: 'desc',
          _id: 'desc',
        },
      }
    )

    return ctx.json(mapToUsersResponse(users), StatusCodes.OK)
  }
)

usersRouter.get(
  '/:_id',
  describeRoute({
    description:
      'Get an organization user. Available for: plan one and plan two subscription plans',
    tags: ['Organization Users'],
    validateResponse: true,
    responses: {
      [StatusCodes.OK]: {
        description: 'Organization user retrieved successfully',
        content: {
          'application/json': {
            schema: resolver(userResponse),
          },
        },
      },
      [StatusCodes.NOT_FOUND]: {
        description: 'Organization user not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Organization user not found' },
              },
            },
          },
        },
      },
    },
  }),
  every(
    requiresJWTAuth,
    requiresSchoolAdmin,
    some(
      requiresOrganizationSubscriptionPlanOneActive,
      requiresOrganizationSubscriptionPlanTwoActive
    )
  ),
  async (ctx) => {
    const _id = ctx.req.param('_id')
    const user = await ctx.var.em.findOneOrFail(
      Users,
      {
        _id,
        organization: ctx.var.organization,
      },
      {
        failHandler: () => {
          throw new NotFoundError('Organization user not found')
        },
      }
    )

    await ctx.var.em.populate(user, ['organization', 'role'])

    return ctx.json(mapToUserResponse(user), StatusCodes.OK)
  }
)

usersRouter.post(
  '/',
  describeRoute({
    description:
      'Create an organization user. Available for: plan one and plan two subscription plans',
    tags: ['Organization Users'],
    validateResponse: true,
    responses: {
      [StatusCodes.CREATED]: {
        description: 'Organization user created successfully',
        content: {
          'application/json': {
            schema: resolver(userResponse),
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
      [StatusCodes.NOT_FOUND]: {
        description: 'Organization | Role not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Organization | Role not found' },
              },
            },
          },
        },
      },
      [StatusCodes.CONFLICT]: {
        description: 'Organization user already exists',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Organization user already exists' },
              },
            },
          },
        },
      },
    },
  }),
  zValidator('json', createOrganizationUserRequest),
  every(
    requiresJWTAuth,
    requiresSchoolAdmin,
    some(
      requiresOrganizationSubscriptionPlanOneActive,
      requiresOrganizationSubscriptionPlanTwoActive
    )
  ),
  async (ctx) => {
    const { email, firstName, lastName, role } = ctx.req.valid('json')

    const user = new Users(email, undefined, firstName, lastName)
    user.role = await ctx.var.em.findOneOrFail(
      Roles,
      { name: role },
      {
        failHandler: () => {
          throw new NotFoundError('Role not found')
        },
      }
    )

    user.organization = ctx.var.organization

    await ctx.var.em.persistAndFlush(user)
    await ctx.var.em.populate(user, ['organization', 'role'])

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 // 30 days
    const token = await createUserJWT(ctx, user, TokenScope.ACTIVATE, exp)

    defaultMailContext
      .sendMail(
        [user.email],
        `Management App: ${ctx.var.organization.name} - Activate your account`,
        undefined,
        new NewUserInOrganizationTemplate()
          .setOrganizationName(ctx.var.organization.name)
          .setOrganizationAdmin(`${ctx.var.user.firstName} ${ctx.var.user.lastName}`)
          .setUserName(`${user.firstName} ${user.lastName}`)
          .setUserRole(user.role.name)
          .setOrganizationURL(
            `https://${env(ctx).DOMAIN}/organizations/${user.organization._id}?t=${token}`
          )
          .build()
      )
      .catch((error) => {
        console.error(error)
      })

    return ctx.json(mapToUserResponse(user), StatusCodes.CREATED)
  }
)

usersRouter.patch(
  '/:_id',
  describeRoute({
    description:
      'Update an organization user. Available for: plan one and plan two subscription plans',
    tags: ['Organization Users'],
    validateResponse: true,
    responses: {
      [StatusCodes.OK]: {
        description: 'Organization user updated successfully',
        content: {
          'application/json': {
            schema: resolver(userResponse),
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
      [StatusCodes.FORBIDDEN]: {
        description: 'You cannot change the role of a School Admin to Faculty',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'You cannot change the role of a School Admin to Faculty',
                },
              },
            },
          },
        },
      },
      [StatusCodes.NOT_FOUND]: {
        description: 'Organization user not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Organization user not found' },
              },
            },
          },
        },
      },
    },
  }),
  zValidator('json', patchOrganizationUserRequest),
  every(
    requiresJWTAuth,
    requiresSchoolAdmin,
    some(
      requiresOrganizationSubscriptionPlanOneActive,
      requiresOrganizationSubscriptionPlanTwoActive
    )
  ),
  async (ctx) => {
    const _id = ctx.req.param('_id')
    let { role, ...keysToUpdate } = ctx.req.valid('json')
    keysToUpdate = Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      Object.entries(keysToUpdate).filter(([_, v]) => v !== undefined && v !== null)
    )
    const user = await ctx.var.em.findOneOrFail(
      Users,
      {
        _id,
        organization: ctx.var.organization,
      },
      {
        failHandler: () => {
          throw new NotFoundError('Organization user not found')
        },
      }
    )

    if (role) {
      const roleEntity = await ctx.var.em.findOneOrFail(
        Roles,
        { name: role },
        {
          failHandler: () => {
            throw new NotFoundError('Role not found')
          },
        }
      )

      if (roleEntity.name === UserRoles.FACULTY && user.role.name === UserRoles.SCHOOL_ADMIN) {
        throw new ForbiddenError('You cannot change the role of a School Admin to Faculty')
      }

      user.role = roleEntity
    }

    Object.assign(user, keysToUpdate)
    user.updatedAt = new Date()

    await ctx.var.em.persistAndFlush(user)
    await ctx.var.em.populate(user, ['organization', 'role'])

    return ctx.json(mapToUserResponse(user), StatusCodes.OK)
  }
)

usersRouter.delete(
  '/:_id',
  describeRoute({
    description:
      'Delete an organization user. Available for: plan one and plan two subscription plans',
    tags: ['Organization Users'],
    validateResponse: true,
    responses: {
      [StatusCodes.NO_CONTENT]: {
        description: 'Organization user deleted successfully',
      },
      [StatusCodes.UNAUTHORIZED]: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: JWTUnauthorizedEntitySchema(),
          },
        },
      },
      [StatusCodes.NOT_FOUND]: {
        description: 'Homeschool not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Organization user not found' },
              },
            },
          },
        },
      },
    },
  }),
  every(
    requiresJWTAuth,
    requiresSchoolAdmin,
    some(
      requiresOrganizationSubscriptionPlanOneActive,
      requiresOrganizationSubscriptionPlanTwoActive
    )
  ),
  async (ctx) => {
    const _id = ctx.req.param('_id')

    const user = await ctx.var.em.findOneOrFail(
      Users,
      {
        _id,
        organization: ctx.var.organization,
      },
      {
        failHandler: () => {
          throw new NotFoundError('Organization user not found')
        },
      }
    )

    const now = new Date()

    user.deletedAt = now
    user.updatedAt = now

    await ctx.var.em.persistAndFlush(user)

    return ctx.body(null, StatusCodes.NO_CONTENT)
  }
)

export default usersRouter
