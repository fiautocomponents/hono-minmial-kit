import z from 'zod'
import 'zod-openapi/extend'

import { UserRoles } from '../lib/enums.js'

export const baseFilterSchema = z.object({
  endCursor: z.string().optional().openapi({ example: 'f7b3b3b3-0b3b-4b3b-8b3b-1b3b3b3b3b3b' }),
  size: z
    .string()
    .optional()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .openapi({ example: '10' }),
})

export const passwordSchema = z
  .string()
  .min(8)
  .refine(
    (value) =>
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /[0-9]/.test(value) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(value),
    {
      message:
        'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character',
    }
  )
  .openapi({ example: 'Password123!' })

export const phoneNumberSchema = z
  .string()
  .regex(/^\d{3}-\d{3}-\d{4}$/, 'Phone number must be in format 123-123-1234')
  .openapi({ example: '123-456-7890' })

export const phoneNumberOptionalSchema = z
  .string()
  .regex(/^\d{3}-\d{3}-\d{4}$/, 'Phone number must be in format 123-123-1234')
  .optional()
  .openapi({ example: '123-456-7890' })

export const loginRequest = z
  .object({
    email: z.string().email().openapi({ example: 'jean@pardaillan.com' }),
    password: passwordSchema,
  })
  .openapi({ ref: 'LoginRequest' })

export const xATokenHeader = z.object({
  'X-A-Token': z.string().openapi({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmN2IzYjNiMy0wYjNiLTRiM2ItOGIzYi0xYjNiM2IzYjNiM2IiLCJpYXQiOjE2MzIwNzQwMzYsImV4cCI6MTYzMjA3NzYzNn0.7',
  }),
})

export const xRTokenHeader = z.object({
  'X-R-Token': z.string().openapi({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmN2IzYjNiMy0wYjNiLTRiM2ItOGIzYi0xYjNiM2IzYjNiM2IiLCJpYXQiOjE2MzIwNzQwMzYsImV4cCI6MTYzMjA3NzYzNn0.7',
  }),
})

export const findUserByIdRequest = z
  .object({
    _id: z.string().uuid().openapi({ example: 'f7b3b3b3-0b3b-4b3b-8b3b-1b3b3b3b3b3b' }),
  })
  .openapi({ ref: 'FindUserByIdRequest' })

export const filterOrganizationsRequest = z
  .object({
    name: z.string().optional().openapi({ example: 'My Partial Organization Name' }),
    ownerEmail: z.string().email().optional().openapi({ example: 'jean@pardaillan.com' }),
    plan: z.string().uuid().optional().openapi({ example: 'f7b3b3b3-0b3b-4b3b-8b3b-1b3b3b3b3b3b' }),
    withUsers: z
      .string()
      .optional()
      .pipe(z.string().transform((val) => val.toLowerCase() === 'true'))
      .optional()
      .openapi({ example: 'true' }),
  })
  .merge(baseFilterSchema)
  .openapi({ ref: 'FilterOrganizationsRequest' })

export const createOrganizationRequest = z
  .object({
    name: z.string().openapi({ example: 'My Organization' }),
    plans: z
      .array(z.string().uuid())
      .openapi({ example: ['f7b3b3b3-0b3b-4b3b-8b3b-1b3b3b3b3b3b'] }),
    schoolAdminEmail: z.string().email().openapi({ example: 'jean@pardaillan.com' }),
  })
  .openapi({ ref: 'CreateOrganizationRequest' })

export const patchOrganizationRequest = z.object({
  name: z.string().nullable().optional().openapi({ example: 'My Organization' }),
  addPlans: z
    .array(z.string().uuid())
    .nullable()
    .optional()
    .openapi({ example: ['f7b3b3b3-0b3b-4b3b-8b3b-1b3b3b3b3b3b'] }),
  removePlans: z
    .array(z.string().uuid())
    .nullable()
    .optional()
    .openapi({ example: ['f7b3b3b3-0b3b-4b3b-8b3b-1b3b3b3b3b3b'] }),
  schoolAdminEmail: z.string().email().optional().openapi({ example: 'jean@pardaillan.com' }),
  activate: z
    .boolean()
    .optional()
    .openapi({ example: true, description: 'Set to true to activate the organization' }),
})

export const activateUserRequest = z
  .object({
    password: passwordSchema.nullable().optional(),
    firstName: z.string().nullable().optional().openapi({ example: 'Jean' }),
    lastName: z.string().nullable().optional().openapi({ example: 'Pardaillan' }),
  })
  .openapi({ ref: 'ActivateUserRequest' })

export const recoverAccountRequest = z
  .object({
    email: z.string().email().openapi({ example: 'jean@pardaillan.com' }),
  })
  .openapi({ ref: 'RecoverAccountRequest' })

export const resetPasswordRequest = z
  .object({
    email: z.string().email().openapi({ example: 'jean@pardaillan.com' }),
    password: passwordSchema,
  })
  .openapi({ ref: 'ResetPasswordRequest' })

export const filterOrganizationUsersRequest = z
  .object({
    email: z.string().optional().openapi({ example: 'My Partial User Email' }),
    firstName: z.string().optional().openapi({ example: 'My Partial User First Name' }),
    lastName: z.string().optional().openapi({ example: 'My Partial User Last Name' }),
    role: z
      .enum([UserRoles.SCHOOL_ADMIN, UserRoles.FACULTY])
      .optional()
      .openapi({ example: UserRoles.FACULTY }),
  })
  .merge(baseFilterSchema)
  .openapi({ ref: 'FilterOrganizationUsersRequest' })

export const createOrganizationUserRequest = z
  .object({
    email: z.string().email().openapi({ example: 'jean@pardaillan.com' }),
    firstName: z.string().openapi({ example: 'My Partial User First Name' }),
    lastName: z.string().openapi({ example: 'My Partial User Last Name' }),
    role: z
      .enum([UserRoles.SCHOOL_ADMIN, UserRoles.FACULTY])
      .openapi({ example: UserRoles.FACULTY }),
  })
  .openapi({ ref: 'CreateOrganizationUserRequest' })

export const patchOrganizationUserRequest = z
  .object({
    email: z.string().email().nullable().optional().openapi({ example: 'jean@pardaillan.com' }),
    firstName: z.string().nullable().optional().openapi({ example: 'My Partial User First Name' }),
    lastName: z.string().nullable().optional().openapi({ example: 'My Partial User Last Name' }),
    role: z
      .enum([UserRoles.SCHOOL_ADMIN, UserRoles.FACULTY])
      .nullable()
      .optional()
      .openapi({ example: UserRoles.FACULTY }),
  })
  .openapi({ ref: 'PatchOrganizationUserRequest' })
