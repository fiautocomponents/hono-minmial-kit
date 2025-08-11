import type { Context } from 'hono'
import { env } from 'hono/adapter'
import { sign } from 'hono/jwt'
import { pbkdf2Sync, randomBytes } from 'crypto'

import { Tokens } from '../entities/Tokens.js'
import type { Users } from '../entities/Users.js'
import type { SignatureAlgorithm, TokenScope } from '../lib/enums.js'
import type { JWTPayload } from '../lib/types.js'
import type { Env } from './config-factory.js'

export const generateSalt = (): string => randomBytes(16).toString('hex')

export const hashPassword = (password: string, salt: string): string => {
  return pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
}

export const validatePassword = (password: string, salt: string, hash: string): boolean => {
  return hash === hashPassword(password, salt)
}

export const createUserJWT = async (
  ctx: Context<Env>,
  user: Users,
  scope: TokenScope,
  exp?: number
): Promise<string> => {
  const payload: JWTPayload = {
    sub: user._id,
    exp,
    scope,
  }

  return await createJWT(ctx, payload, user)
}

export const createJWT = async (
  ctx: Context<Env>,
  payload: JWTPayload,
  user: Users
): Promise<string> => {
  if (!payload.exp) {
    payload.exp = Math.floor(Date.now() / 1000) + 60 * 60 // 60 minutes
  }

  const token = await sign(
    payload,
    String(env(ctx).JWT_SECRET),
    String(env(ctx).JWT_ALG) as SignatureAlgorithm
  )

  const now = new Date()

  ctx.var.em.create(Tokens, {
    token,
    expiresAt: new Date(payload.exp * 1000),
    scope: payload.scope,
    user,
    createdAt: now,
    updatedAt: now,
  })

  await ctx.var.em.flush()

  return token
}
