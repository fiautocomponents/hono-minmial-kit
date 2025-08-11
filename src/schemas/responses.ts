import z from 'zod'
import 'zod-openapi/extend'

import { SubscriptionStatus } from '../lib/enums.js'

export const cursorPaginationSchema = <T extends z.ZodTypeAny>(itemsSchema: T) =>
  z
    .object({
      startCursor: z.string().optional().nullable().default(null).openapi({ example: 'WzRd' }),
      endCursor: z.string().optional().nullable().default(null).openapi({ example: 'WzRd' }),
      totalCount: z.number().default(0).openapi({ example: 10 }),
      hasPrevPage: z.boolean().default(false).openapi({ example: false }),
      hasNextPage: z.boolean().default(false).openapi({ example: false }),
      items: z.array(itemsSchema).default([]).openapi({ example: [] }),
      length: z.number().optional().nullable().default(0).openapi({ example: 10 }),
    })
    .strict()

export const baseEntitySchema = z.object({
  _id: z.string().uuid().openapi({ example: 'f7b3b3b3-0b3b-4b3b-8b3b-1b3b3b3b3b3b' }),
  createdAt: z.string().openapi({ example: '2021-08-01T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2021-08-01T00:00:00.000Z' }),
  deletedAt: z.string().optional().nullable().openapi({ example: '2021-08-01T00:00:00.000Z' }),
})

export const phoneNumberSchema = z
  .string()
  .regex(/^\d{3}-\d{3}-\d{4}$/, 'Phone number must be in format 123-123-1234')
  .optional()
  .openapi({ example: '123-456-7890' })

export const roleSchema = z
  .object({
    name: z.string().openapi({ example: 'User' }),
    description: z.string().openapi({ example: 'User Role' }),
  })
  .merge(baseEntitySchema)
  .strict()
  .openapi({ ref: 'Role' })

export const planSchema = z
  .object({
    name: z.string().openapi({ example: 'My Plan' }),
    description: z.string().openapi({ example: 'My Plan Description' }),
    price: z.number().openapi({ example: 9.99 }),
    duration: z.number().openapi({ example: 30 }),
  })
  .merge(baseEntitySchema)
  .strict()
  .openapi({ ref: 'Plan' })

export const planResponse = z
  .object({
    plan: planSchema,
  })
  .strict()
  .openapi({ ref: 'PlanResponse' })

export const plansResponse = z
  .object({
    plans: cursorPaginationSchema(planSchema),
  })
  .strict()
  .openapi({ ref: 'PlansResponse' })

export const organizationWithIDsSchema = z
  .object({
    name: z.string().openapi({ example: 'My Organization' }),
    subscription: z.string().openapi({ example: 'f7b3b3b3-0b3b-4b3b-8b3b-1b3b3b3b3b3b' }),
  })
  .merge(baseEntitySchema)
  .strict()
  .openapi({ ref: 'OrganizationWithIDs' })

export const userSchema = z
  .object({
    email: z.string().email().openapi({ example: 'jean@pardaillan.com' }),
    firstName: z.string().optional().nullable().openapi({ example: 'Jean' }),
    lastName: z.string().optional().nullable().openapi({ example: 'Pardaillan' }),
    activeAt: z.string().optional().nullable().openapi({ example: '2021-08-01T00:00:00.000Z' }),
    phoneNumber: z.string().optional().nullable().openapi({ example: '123-123-1234' }),
    role: roleSchema,
    organization: organizationWithIDsSchema.optional().nullable(),
  })
  .merge(baseEntitySchema)
  .strict()
  .openapi({ ref: 'User' })

export const userResponse = z
  .object({
    user: userSchema,
  })
  .strict()
  .openapi({ ref: 'UserResponse' })

export const usersResponse = z
  .object({
    users: cursorPaginationSchema(userSchema),
  })
  .strict()
  .openapi({ ref: 'UsersResponse' })

export const loginSchema = z
  .object({
    email: z.string().email().openapi({ example: 'jean@pardaillan.com' }),
    firstName: z.string().optional().nullable().openapi({ example: 'Jean' }),
    lastName: z.string().optional().nullable().openapi({ example: 'Pardaillan' }),
    activeAt: z.string().optional().nullable().openapi({ example: '2021-08-01T00:00:00.000Z' }),
    phoneNumber: z.string().optional().nullable().openapi({ example: '123-123-1234' }),
    role: roleSchema,
    organization: organizationWithIDsSchema.optional().nullable(),
  })
  .merge(baseEntitySchema)
  .strict()
  .openapi({ ref: 'LoginSchema' })

export const loginResponse = z
  .object({
    user: loginSchema,
  })
  .openapi({ ref: 'LoginResponse' })

export const subscriptionPlansSchema = z
  .object({
    plan: planSchema,
    startAt: z.string().openapi({ example: '2021-08-01T00:00:00.000Z' }),
    endAt: z.string().openapi({ example: '2021-08-31T00:00:00.000Z' }),
  })
  .merge(baseEntitySchema)
  .strict()
  .openapi({ ref: 'SubscriptionPlans' })

export const subscriptionSchema = z
  .object({
    status: z
      .enum([
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.INACTIVE,
        SubscriptionStatus.PENDING,
        SubscriptionStatus.CANCELED,
      ])
      .openapi({ example: SubscriptionStatus.ACTIVE }),
    subscriptionPlans: subscriptionPlansSchema.array(),
  })
  .merge(baseEntitySchema)
  .strict()
  .openapi({ ref: 'Subscription' })

export const organizationSchema = z
  .object({
    deletedAt: z.string().optional().nullable().openapi({ example: '2021-08-01T00:00:00.000Z' }),
    name: z.string().openapi({ example: 'My Organization' }),
    // users: userSchema.array(),
    subscription: subscriptionSchema.optional().nullable(),
  })
  .merge(baseEntitySchema)
  .strict()
  .openapi({ ref: 'Organization' })

export const organizationSchemaWithUsers = organizationSchema.extend({
  users: userSchema.array(),
})

export const organizationResponse = z
  .object({
    organization: z.union([organizationSchema, organizationSchemaWithUsers]),
  })
  .strict()
  .openapi({ ref: 'OrganizationResponse' })

export const organizationsResponse = z
  .object({
    organizations: cursorPaginationSchema(
      z.union([organizationSchema, organizationSchemaWithUsers])
    ),
  })
  .strict()
  .openapi({ ref: 'OrganizationsResponse' })
