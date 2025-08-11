import type z from 'zod'

import type { Organizations } from '../entities/Organizations.js'
import type { Plans } from '../entities/Plans.js'
import type { Roles } from '../entities/Roles.js'
import type { Subscriptions } from '../entities/Subscriptions.js'
import type { SubscriptionsPlans } from '../entities/SubscriptionsPlans.js'
import type { Users } from '../entities/Users.js'
import type { TCursor } from '../lib/types.js'
import type {
  loginResponse,
  loginSchema,
  organizationResponse,
  organizationSchema,
  organizationSchemaWithUsers,
  organizationWithIDsSchema,
  organizationsResponse,
  planResponse,
  planSchema,
  plansResponse,
  roleSchema,
  subscriptionPlansSchema,
  subscriptionSchema,
  userResponse,
  userSchema,
  usersResponse,
} from './responses.js'

const mapBaseEntity = <T extends object>(
  entity: { _id: string; createdAt: Date; updatedAt: Date; deletedAt?: Date | null },
  rest: T
): T & {
  _id: string
  createdAt: string
  updatedAt: string
} => ({
  _id: entity._id,
  createdAt: entity.createdAt.toISOString(),
  updatedAt: entity.updatedAt.toISOString(),
  deletedAt: entity.deletedAt ? entity.deletedAt.toISOString() : null,
  ...rest,
})

const mapBaseCursor = <ItemType, Extra extends object>(
  cursor: TCursor<ItemType>,
  rest: Extra
): {
  startCursor: string | null
  endCursor: string | null
  totalCount: number
  hasPrevPage: boolean
  hasNextPage: boolean
  length: number
} & Extra => ({
  ...rest,
  startCursor: cursor.startCursor,
  endCursor: cursor.endCursor,
  totalCount: cursor.totalCount,
  hasPrevPage: cursor.hasPrevPage,
  hasNextPage: cursor.hasNextPage,
  length: cursor.length,
})

const mapToRoleSchema = (role: Roles): z.infer<typeof roleSchema> => ({
  ...mapBaseEntity(role, {
    name: role.name,
    description: role.description,
  }),
})

const mapToPlanSchema = (plan: Plans): z.infer<typeof planSchema> => ({
  ...mapBaseEntity(plan, {
    name: plan.name,
    description: plan.description,
    price: plan.price,
    duration: plan.duration,
  }),
})

export const mapToPlanResponse = (plan: Plans): z.infer<typeof planResponse> => ({
  plan: mapToPlanSchema(plan),
})

export const mapToPlansResponse = (plans: TCursor<Plans>): z.infer<typeof plansResponse> => ({
  plans: mapBaseCursor(plans, {
    items: plans.items.map((plan) => mapToPlanSchema(plan)),
  }),
})

export const mapToSubscriptionPlansSchema = (
  subscriptionPlan: SubscriptionsPlans
): z.infer<typeof subscriptionPlansSchema> => ({
  ...mapBaseEntity(subscriptionPlan, {
    plan: mapToPlanSchema(subscriptionPlan.plan),
    startAt: subscriptionPlan.startAt.toISOString(),
    endAt: subscriptionPlan.endAt.toISOString(),
  }),
})

export const mapToSubscriptionSchema = (
  subscription: Subscriptions
): z.infer<typeof subscriptionSchema> => ({
  ...mapBaseEntity(subscription, {
    status: subscription.status,
    subscriptionPlans: subscription.subscriptionPlans.map((sp) => mapToSubscriptionPlansSchema(sp)),
  }),
})

export const mapToOrganizationSchema = (
  organization: Organizations
): z.infer<typeof organizationSchema> => ({
  ...mapBaseEntity(organization, {
    deletedAt: organization.deletedAt ? organization.deletedAt.toISOString() : null,
    name: organization.name,
    subscription: mapToSubscriptionSchema(organization.subscription),
  }),
})

export const mapToOrganizationSchemaWithUsers = (
  organization: Organizations
): z.infer<typeof organizationSchemaWithUsers> => ({
  ...mapToOrganizationSchema(organization),
  users: organization.users.map((user) => mapToUserSchema(user)),
})

export const mapToOrganizationResponse = (
  organization: Organizations,
  withUsers: boolean = false
): z.infer<typeof organizationResponse> => ({
  organization: withUsers
    ? mapToOrganizationSchemaWithUsers(organization)
    : mapToOrganizationSchema(organization),
})

export const mapToOrganizationsResponse = (
  organizations: TCursor<Organizations>,
  withUsers: boolean = false
): z.infer<typeof organizationsResponse> => ({
  organizations: mapBaseCursor(organizations, {
    items: withUsers
      ? organizations.items.map((organization) => mapToOrganizationSchemaWithUsers(organization))
      : organizations.items.map((organization) => mapToOrganizationSchema(organization)),
  }),
})

const mapToOrganizationWithIDsSchema = (
  organization: Organizations
): z.infer<typeof organizationWithIDsSchema> => ({
  ...mapBaseEntity(organization, {
    name: organization.name,
    subscription:
      typeof organization.subscription === 'object'
        ? organization.subscription._id
        : organization.subscription,
  }),
})

const mapToLoginSchema = (user: Users): z.infer<typeof loginSchema> => ({
  ...mapBaseEntity(user, {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    organization: user.organization ? mapToOrganizationWithIDsSchema(user.organization) : null,
    role: mapToRoleSchema(user.role),
  }),
})

export const mapToLoginResponse = (user: Users): z.infer<typeof loginResponse> => ({
  user: mapToLoginSchema(user),
})

const mapToUserSchema = (user: Users): z.infer<typeof userSchema> => ({
  ...mapBaseEntity(user, {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    organization: user.organization ? mapToOrganizationWithIDsSchema(user.organization) : null,
    role: mapToRoleSchema(user.role),
    phoneNumber: user.phoneNumber,
  }),
})

export const mapToUserResponse = (user: Users): z.infer<typeof userResponse> => ({
  user: mapToUserSchema(user),
})

export const mapToUsersResponse = (users: TCursor<Users>): z.infer<typeof usersResponse> => ({
  users: mapBaseCursor(users, {
    items: users.items.map((user) => mapToUserSchema(user)),
  }),
})
