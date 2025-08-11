import type { SqlEntityManager } from '@mikro-orm/postgresql'
import { MikroORM } from '@mikro-orm/postgresql'
import { env } from 'hono/adapter'
import { cors } from 'hono/cors'
import { createFactory } from 'hono/factory'
import type { JwtVariables } from 'hono/jwt'
import { logger } from 'hono/logger'

import type { Organizations } from '../entities/Organizations.js'
import type { Users } from '../entities/Users.js'
import config from '../mikro-orm.config.js'
import Logger from './logger.js'

const orm = await MikroORM.init(config)

export interface Env {
  Variables: JwtVariables & {
    em: SqlEntityManager
    orm: MikroORM
    envs: Record<string, string>
    user: Users
    organization: Organizations
  }
}
export default createFactory<Env>({
  initApp: (app) => {
    /** You will not need to touch those most likely */
    app.use(
      '*',
      logger((message: string, ...rest: string[]) => {
        Logger.traffic(message)
        console.log(message, ...rest)
      })
    )
    app.use(
      '*',
      cors({
        origin: (origin, ctx) => {
          const isTesting = env(ctx).NODE_ENV === 'testing'
          if (isTesting && origin === 'http://localhost:5173') {
            return origin
          }

          return origin.endsWith(env(ctx).DOMAIN) ? origin : `https://${env(ctx).DOMAIN}`
        },
      })
    )

    /** Inject the environment variables into the context
     *  If you want to exclude or include some variables, you can do it here
     * */
    app.use(async (ctx, next) => {
      const em = orm.em.fork()
      ctx.set('em', em)
      const envs: Record<string, string> = Object.fromEntries(
        Object.entries(env(ctx)).map(([key, value]) => {
          if (key.toUpperCase().includes('PASS') || key.toUpperCase().includes('SECRET')) {
            return [key.toUpperCase(), '']
          }
          return [key.toUpperCase(), String(value)]
        })
      )
      ctx.set('envs', envs)
      await next()
    })
  },
})
