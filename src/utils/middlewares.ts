import { NotFoundError } from '@mikro-orm/core'
import type { Context, Next } from 'hono'
import { env } from 'hono/adapter'
import { createMiddleware } from 'hono/factory'
import { jwt } from 'hono/jwt'

import { Organizations } from '../entities/Organizations.js'
import { SubscriptionsPlans } from '../entities/SubscriptionsPlans.js'
import { Users } from '../entities/Users.js'
import type { SignatureAlgorithm, TokenScope } from '../lib/enums.js'
import { PlanNames, SubscriptionStatus, UserRoles } from '../lib/enums.js'
import {
  BadRequestError,
  ForbiddenError,
  ImplementationError,
  UnauthorizedError,
} from '../lib/errors.js'
import { UUIDValidator } from '../lib/validators.js'

export const requiresJWTAuth = createMiddleware(async (ctx: Context, next: Next) => {
  const jwtMiddleware = jwt({
    alg: String(env(ctx).JWT_ALG) as SignatureAlgorithm,
    secret: String(env(ctx).JWT_SECRET),
  })

  return jwtMiddleware(ctx, next)
})

export const findAuthUser = createMiddleware(async (ctx: Context, next: Next) => {
  const user = await ctx.var.em.findOneOrFail(Users, ctx.var.jwtPayload.sub, {
    populate: ['role', 'organization', 'organization.subscription'],
    failHandler: () => {
      throw new NotFoundError('Users not found')
    },
  })

  ctx.set('user', user)
  await next()
})

export const requiresAppOwner = createMiddleware(async (ctx: Context, next: Next) => {
  await findAuthUser(ctx, async () => {
    if (
      ctx.var.user.role.name !== UserRoles.SUPER_ADMIN ||
      ctx.var.user.email !== 'sadmin@management-app.com'
    ) {
      throw new UnauthorizedError('You are not authorized to access this resource')
    }
    await next()
  })
})

export const requiresTestingEnv = createMiddleware(async (ctx: Context, next: Next) => {
  if (process.env.NODE_ENV !== 'testing') {
    throw new UnauthorizedError('Invalid JWT Token: Testing environment only')
  }

  await next()
})

export const requiresSuperAdmin = createMiddleware(async (ctx: Context, next: Next) => {
  await findAuthUser(ctx, async () => {
    if (ctx.var.user.role.name !== UserRoles.SUPER_ADMIN) {
      throw new UnauthorizedError('Invalid JWT Token: User is not a Super Admin')
    }
    await next()
  })
})

export const requiresSchoolAdmin = createMiddleware(async (ctx: Context, next: Next) => {
  await findAuthUser(ctx, async () => {
    // Might get changed in the future to allow impersonation
    if (![UserRoles.SUPER_ADMIN, UserRoles.SCHOOL_ADMIN].includes(ctx.var.user.role.name)) {
      throw new UnauthorizedError('Invalid JWT Token: User is not a School Admin')
    }
    await next()
  })
})

export const requiresFaculty = createMiddleware(async (ctx: Context, next: Next) => {
  await findAuthUser(ctx, async () => {
    if (![UserRoles.FACULTY].includes(ctx.var.user.role.name)) {
      throw new UnauthorizedError('Invalid JWT Token: User is not a Faculty')
    }
    await next()
  })
})

export const requiresStudent = createMiddleware(async (ctx: Context, next: Next) => {
  await findAuthUser(ctx, async () => {
    if (![UserRoles.STUDENT].includes(ctx.var.user.role.name)) {
      throw new UnauthorizedError('Invalid JWT Token: User is not a Student')
    }
    await next()
  })
})

export const requiresPartOfOrganization = createMiddleware(async (ctx: Context, next: Next) => {
  if (!ctx.var.user) {
    throw new ImplementationError('User not found in context')
  }

  if (!ctx.var.user.organization) {
    throw new UnauthorizedError('Invalid JWT Token: User is not part of any organization')
  }

  if (ctx.var.user.organization.deletedAt) {
    throw new ForbiddenError('User is part of a deleted organization. Please contact support')
  }

  ctx.set('organization', ctx.var.user.organization)

  const requestedOrganizationId = ctx.req.param('organizationId')

  if (!UUIDValidator(requestedOrganizationId)) {
    throw new BadRequestError('Invalid organization ID in path parameter')
  }

  await ctx.var.em.findOneOrFail(Organizations, requestedOrganizationId, {
    failHandler: () => {
      throw new NotFoundError('Organization not found')
    },
  })

  if (ctx.var.user.organization._id !== requestedOrganizationId) {
    throw new UnauthorizedError('Invalid JWT Token: User is not part of this organization')
  }

  await next()
})

export const requiresOrganizationSubscriptionPlanOneActive = createMiddleware(
  async (ctx: Context, next: Next) => {
    await requiresPartOfOrganization(ctx, async () => {
      await validatePlanActive(ctx, PlanNames.PLAN_ONE)
      await next()
    })
  }
)

export const requiresOrganizationSubscriptionPlanTwoActive = createMiddleware(
  async (ctx: Context, next: Next) => {
    await requiresPartOfOrganization(ctx, async () => {
      await validatePlanActive(ctx, PlanNames.PLAN_TWO)
      await next()
    })
  }
)

const validatePlanActive = async (ctx: Context, planName: PlanNames) => {
  if (!ctx.var.user) {
    throw new ImplementationError('User not found in context')
  }

  const organization = ctx.var.user.organization as Organizations

  if (organization.subscription.status !== SubscriptionStatus.ACTIVE) {
    throw new UnauthorizedError('Invalid JWT Token: Organization subscription is not active')
  }

  const subscriptionPlan = await ctx.var.em.findOneOrFail(
    SubscriptionsPlans,
    { subscription: organization.subscription, plan: { name: planName } },
    {
      failHandler: () => {
        throw new NotFoundError('Subscription plans not found')
      },
    }
  )

  if (!subscriptionPlan) {
    throw new UnauthorizedError('Invalid JWT Token: Organization subscription plans not found')
  }

  const now = new Date()

  if (subscriptionPlan.endAt < now) {
    throw new UnauthorizedError(
      'Invalid JWT Token: Organization subscription plans expired. Please contact support'
    )
  }
}

export const requiresTokenScope = (scope: TokenScope) => {
  return createMiddleware(async (ctx: Context, next: Next) => {
    if (!ctx.var.user) {
      throw new ImplementationError('User not found in context')
    }

    if (!ctx.var.user.organization) {
      throw new UnauthorizedError('Invalid JWT Token: User is not part of any organization')
    }

    if (!ctx.var.jwtPayload.scope) {
      throw new UnauthorizedError('Invalid JWT Token: User does not have scope')
    }

    if (ctx.var.jwtPayload.scope !== scope) {
      throw new UnauthorizedError(`Invalid JWT Token: User does not have ${scope} scope`)
    }

    await next()
  })
}

export const requiresInternalToken = createMiddleware(async (ctx: Context, next: Next) => {
  const secretToken = ctx.req.header('S-Token')
  if (!secretToken) {
    throw new ImplementationError('Something went wrong')
  }

  if (String(env(ctx).INTERNAL_SECRET_TOKEN) !== secretToken) {
    throw new ImplementationError('Something went wrong')
  }

  await next()
})
