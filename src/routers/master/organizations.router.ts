import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { every, some } from 'hono/combine'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi/zod'
import { StatusCodes } from 'http-status-codes'

import type { Env } from '../../core/config-factory.js'
import { createUserJWT } from '../../core/security.js'
import { Organizations } from '../../entities/Organizations.js'
import { Plans } from '../../entities/Plans.js'
import { Roles } from '../../entities/Roles.js'
import { Subscriptions } from '../../entities/Subscriptions.js'
import { SubscriptionsPlans } from '../../entities/SubscriptionsPlans.js'
import { Users } from '../../entities/Users.js'
import { SubscriptionStatus, TokenScope, UserRoles } from '../../lib/enums.js'
import {
  BadRequestError,
  ConflictError,
  ImplementationError,
  NotFoundError,
} from '../../lib/errors.js'
import { defaultMailContext } from '../../lib/mailer.js'
import { NewOrganizationTemplate } from '../../lib/templater.js'
import { JWTUnauthorizedEntitySchema } from '../../schemas/errors.js'
import {
  createOrganizationRequest,
  filterOrganizationsRequest,
  patchOrganizationRequest,
} from '../../schemas/requests.js'
import {
  mapToOrganizationResponse,
  mapToOrganizationsResponse,
} from '../../schemas/response-converter.js'
import { organizationResponse, organizationsResponse } from '../../schemas/responses.js'
import {
  requiresJWTAuth,
  requiresSchoolAdmin,
  requiresSuperAdmin,
} from '../../utils/middlewares.js'

const organizationsRouter = new Hono<Env>()

organizationsRouter.get(
  '/',
  describeRoute({
    description: 'Get all organizations',
    tags: ['Organizations'],
    validateResponse: true,
    responses: {
      [StatusCodes.OK]: {
        description: 'Organizations retrieved successfully',
        content: {
          'application/json': {
            schema: resolver(organizationsResponse),
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
  zValidator('query', filterOrganizationsRequest),
  every(requiresJWTAuth, requiresSuperAdmin),
  async (ctx) => {
    const { size, endCursor, name, ownerEmail, plan, withUsers } = ctx.req.valid('query')

    const organizations = await ctx.var.em.findByCursor(
      Organizations,
      {
        ...(name ? { name: { $ilike: `%${name}%` } } : {}),
        ...(ownerEmail
          ? {
              users: {
                email: { $ilike: `%${ownerEmail}%` },
                role: { name: UserRoles.SCHOOL_ADMIN },
              },
            }
          : {}),
        ...(plan
          ? {
              subscription: {
                subscriptionPlans: {
                  plan: { _id: plan },
                },
              },
            }
          : {}),
      },
      {
        populate: [
          'users',
          'users.role',
          'subscription',
          'subscription.subscriptionPlans',
          'subscription.subscriptionPlans.plan',
        ],
        first: size,
        after: endCursor,
        orderBy: {
          createdAt: 'desc',
          _id: 'desc',
        },
      }
    )
    return ctx.json(mapToOrganizationsResponse(organizations, withUsers), StatusCodes.OK)
  }
)

organizationsRouter.get(
  '/:id',
  describeRoute({
    description: 'Get organization by ID',
    tags: ['Organizations'],
    validateResponse: true,
    responses: {
      [StatusCodes.OK]: {
        description: 'Organization retrieved successfully',
        content: {
          'application/json': {
            schema: resolver(organizationResponse),
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
        description: 'Organization not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Organization not found' },
              },
            },
          },
        },
      },
    },
  }),
  every(requiresJWTAuth, some(requiresSuperAdmin, requiresSchoolAdmin)),
  async (ctx) => {
    const _id = ctx.req.param('id')
    const organization = await ctx.var.em.findOneOrFail(
      Organizations,
      {
        _id,
        ...(ctx.var.user?.role.name === UserRoles.SCHOOL_ADMIN
          ? { users: { _id: ctx.var.user._id } }
          : {}),
      },
      {
        populate: [
          'users',
          'users.role',
          'subscription',
          'subscription.subscriptionPlans',
          'subscription.subscriptionPlans.plan',
        ],
        failHandler: () => {
          throw new NotFoundError('Organization not found')
        },
      }
    )

    return ctx.json(mapToOrganizationResponse(organization, true), StatusCodes.OK)
  }
)

organizationsRouter.post(
  '/',
  describeRoute({
    description: 'Create a new organization',
    tags: ['Organizations'],
    security: [{ bearerAuth: [] }],

    validateResponse: true,
    responses: {
      [StatusCodes.CREATED]: {
        description: 'Organization created successfully',
        content: {
          'application/json': {
            schema: resolver(organizationResponse),
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
        description: 'Plan | Role not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Plan | Role not found' },
              },
            },
          },
        },
      },
    },
  }),
  zValidator('json', createOrganizationRequest),
  every(requiresJWTAuth, requiresSuperAdmin),
  async (ctx) => {
    const { name, plans, schoolAdminEmail } = ctx.req.valid('json')

    const planEntities = await ctx.var.em.find(Plans, { _id: { $in: plans } })

    if (planEntities.length !== plans.length) {
      throw new NotFoundError('Plan not found')
    }

    const schoolAdminRole = await ctx.var.em.findOneOrFail(
      Roles,
      { name: UserRoles.SCHOOL_ADMIN },
      {
        failHandler: () => {
          throw new NotFoundError('Role not found')
        },
      }
    )
    const schoolAdminUser = new Users(schoolAdminEmail)
    schoolAdminUser.role = schoolAdminRole

    const subscription = new Subscriptions(schoolAdminUser, SubscriptionStatus.ACTIVE)
    ctx.var.em.persist(subscription)

    for (const plan of planEntities) {
      const startDateSubscription = new Date()
      const endDateSubscription = new Date(startDateSubscription)
      endDateSubscription.setDate(startDateSubscription.getDate() + plan.duration)
      const subscriptionPlan = new SubscriptionsPlans(
        subscription,
        plan,
        startDateSubscription,
        endDateSubscription
      )
      ctx.var.em.persist(subscriptionPlan)
    }

    await ctx.var.em.flush()

    const organization = new Organizations(name)
    organization.subscription = subscription

    organization.users.add(schoolAdminUser)

    await ctx.var.em.persistAndFlush(organization)

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 // 30 days
    const token = await createUserJWT(ctx, schoolAdminUser, TokenScope.ACTIVATE, exp)

    defaultMailContext
      .sendMail(
        [schoolAdminUser.email],
        'Welcome to the management-app',
        undefined,
        new NewOrganizationTemplate()
          .setOrganizationName(organization.name)
          .setOrganizationAdmin(schoolAdminUser.email)
          .setOrganizationActivePlans(planEntities.map((plan) => plan.name))
          .setOrganizationURL(
            `https://${env(ctx).DOMAIN}/organizations/${organization._id}?t=${token}`
          )
          .build()
      )
      .catch((error) => {
        console.error(error)
      })

    await ctx.var.em.populate(organization, [
      'users',
      'users.role',
      'subscription',
      'subscription.subscriptionPlans',
      'subscription.subscriptionPlans.plan',
    ])

    return ctx.json(mapToOrganizationResponse(organization, true), StatusCodes.CREATED)
  }
)

organizationsRouter.patch(
  ':_id',
  describeRoute({
    description: 'Update an organization',
    tags: ['Organizations'],
    validateResponse: true,
    responses: {
      [StatusCodes.OK]: {
        description: 'Organization updated successfully',
        content: {
          'application/json': {
            schema: resolver(organizationResponse),
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
      [StatusCodes.BAD_REQUEST]: {
        description:
          'Organization is deleted, cannot update | School admin email is required to activate the organization',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example:
                    'Organization is deleted, cannot update | School admin email is required to activate the organization',
                },
              },
            },
          },
        },
      },
      [StatusCodes.NOT_FOUND]: {
        description: 'Organization not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Organization not found' },
              },
            },
          },
        },
      },
      [StatusCodes.CONFLICT]: {
        description: 'Organization name | School admin mail already exists',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'Organization name | School admin mail already exists',
                },
              },
            },
          },
        },
      },
      [StatusCodes.INTERNAL_SERVER_ERROR]: {
        description:
          'This organization does not have a school admin. This should not happen, please contact the support team.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example:
                    'This organization does not have a school admin. This should not happen, please contact the support team.',
                },
              },
            },
          },
        },
      },
    },
  }),
  zValidator('json', patchOrganizationRequest),
  every(requiresJWTAuth, requiresSuperAdmin),
  async (ctx) => {
    const _id = ctx.req.param('_id')
    let { activate, addPlans, removePlans, schoolAdminEmail, ...keysToUpdate } =
      ctx.req.valid('json')
    keysToUpdate = Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      Object.entries(keysToUpdate).filter(([_, v]) => v !== undefined && v !== null)
    )

    const organization = await ctx.var.em.findOneOrFail(
      Organizations,
      { _id },
      {
        populate: [
          'users',
          'users.role',
          'subscription',
          'subscription.subscriptionPlans',
          'subscription.subscriptionPlans.plan',
        ],
        failHandler: () => {
          throw new NotFoundError('Organization not found')
        },
      }
    )

    const currentSchoolAdmin = organization.users
      .getItems()
      .find((user) => user.role.name === UserRoles.SCHOOL_ADMIN)

    const now = new Date()

    if (!currentSchoolAdmin) {
      throw new ImplementationError(
        'This organization does not have a school admin. This should not happen, please contact the support team.'
      )
    }

    if (activate) {
      if (!schoolAdminEmail) {
        throw new BadRequestError('School admin email is required to activate the organization')
      }
      organization.deletedAt = undefined
    }

    if (organization.deletedAt) {
      throw new BadRequestError('Organization is deleted, cannot update')
    }

    if (removePlans) {
      const plansToRemove = await ctx.var.em.find(Plans, { _id: { $in: removePlans } })

      for (const plan of plansToRemove) {
        const subscriptionPlan = organization.subscription.subscriptionPlans
          .getItems()
          .find((sp) => sp.plan._id === plan._id)
        if (subscriptionPlan) {
          organization.subscription.subscriptionPlans.remove(subscriptionPlan)
          ctx.var.em.remove(subscriptionPlan)
        }
      }
    }

    if (addPlans) {
      const plansToAdd = await ctx.var.em.find(Plans, { _id: { $in: addPlans } })

      for (const plan of plansToAdd) {
        const startDateSubscription = new Date()
        const endDateSubscription = new Date(startDateSubscription)
        endDateSubscription.setDate(startDateSubscription.getDate() + plan.duration)
        const subscriptionPlan = new SubscriptionsPlans(
          organization.subscription,
          plan,
          startDateSubscription,
          endDateSubscription
        )
        ctx.var.em.persist(subscriptionPlan)

        organization.subscription.subscriptionPlans.add(subscriptionPlan)
      }
    }

    if (schoolAdminEmail && currentSchoolAdmin.email !== schoolAdminEmail) {
      const duplicateEmailUser = await ctx.var.em.findOne(Users, { email: schoolAdminEmail })

      if (duplicateEmailUser) {
        throw new ConflictError('School admin email already exists')
      }

      currentSchoolAdmin.email = schoolAdminEmail
      currentSchoolAdmin.updatedAt = now
      ctx.var.em.persist(currentSchoolAdmin)

      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 // 30 days
      const token = await createUserJWT(ctx, currentSchoolAdmin, TokenScope.ACTIVATE, exp)

      defaultMailContext
        .sendMail(
          [currentSchoolAdmin.email],
          'Welcome to the management-app',
          undefined,
          new NewOrganizationTemplate()
            .setOrganizationName(organization.name)
            .setOrganizationAdmin(currentSchoolAdmin.email)
            .setOrganizationActivePlans(
              organization.subscription.subscriptionPlans.getItems().map((sp) => sp.plan.name)
            )
            .setOrganizationURL(
              `https://${env(ctx).DOMAIN}/organizations/${organization._id}?t=${token}`
            )
            .build()
        )
        .catch((error) => {
          console.error(error)
        })
    }

    Object.assign(organization, keysToUpdate)
    organization.updatedAt = now
    ctx.var.em.persist(organization)

    await ctx.var.em.flush()

    await ctx.var.em.populate(organization, [
      'users',
      'users.role',
      'subscription',
      'subscription.subscriptionPlans',
      'subscription.subscriptionPlans.plan',
    ])

    return ctx.json(mapToOrganizationResponse(organization, true), StatusCodes.OK)
  }
)

organizationsRouter.delete(
  '/:id',
  describeRoute({
    description: 'Delete an organization',
    tags: ['Organizations'],
    responses: {
      [StatusCodes.NO_CONTENT]: {
        description: 'Organization deleted successfully',
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
        description: 'Organization not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Organization not found' },
              },
            },
          },
        },
      },
      [StatusCodes.INTERNAL_SERVER_ERROR]: {
        description:
          'This organization does not have a school admin. This should not happen, please contact the support team.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example:
                    'This organization does not have a school admin. This should not happen, please contact the support team.',
                },
              },
            },
          },
        },
      },
    },
  }),
  every(requiresJWTAuth, requiresSuperAdmin),
  async (ctx) => {
    const _id = ctx.req.param('id')

    const organization = await ctx.var.em.findOneOrFail(
      Organizations,
      { _id },
      {
        populate: ['users', 'users.role', 'subscription'],
        failHandler: () => {
          throw new NotFoundError('Organization not found')
        },
      }
    )

    const currentSchoolAdmin = organization.users
      .getItems()
      .find((user) => user.role.name === UserRoles.SCHOOL_ADMIN)

    if (!currentSchoolAdmin) {
      throw new ImplementationError(
        'This organization does not have a school admin. This should not happen, please contact the support team.'
      )
    }

    const now = new Date()
    const fakeEmail = `deleted-${now.getTime()}@management-app.com`

    organization.deletedAt = now
    currentSchoolAdmin.email = fakeEmail

    await ctx.var.em.persistAndFlush(organization)
    await ctx.var.em.persistAndFlush(currentSchoolAdmin)

    return ctx.body(null, StatusCodes.NO_CONTENT)
  }
)

export default organizationsRouter
