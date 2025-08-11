export const enum TokenScope {
  ACCESS = 'ACCESS',
  ACTIVATE = 'ACTIVATE',
  RESET = 'RESET',
}

export declare enum AlgorithmTypes {
  HS256 = 'HS256',
  HS384 = 'HS384',
  HS512 = 'HS512',
  RS256 = 'RS256',
  RS384 = 'RS384',
  RS512 = 'RS512',
  PS256 = 'PS256',
  PS384 = 'PS384',
  PS512 = 'PS512',
  ES256 = 'ES256',
  ES384 = 'ES384',
  ES512 = 'ES512',
  EdDSA = 'EdDSA',
}

export const enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
  PENDING = 'PENDING',
  INACTIVE = 'INACTIVE',
}

export const enum UserRoles {
  SUPER_ADMIN = 'Super Admin',
  SCHOOL_ADMIN = 'School Admin',
  FACULTY = 'Faculty',
  STUDENT = 'Student',
}

export const enum PlanNames {
  PLAN_ONE = 'Plan - 1',
  PLAN_TWO = 'Plan - 2',
}

export const enum HeapEnum {
  MIN = 'min',
  MAX = 'max',
}

export type SignatureAlgorithm = keyof typeof AlgorithmTypes
