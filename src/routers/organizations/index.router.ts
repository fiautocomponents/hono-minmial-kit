import { Hono } from 'hono'

import type { Env } from '../../core/config-factory.js'
import usersRouter from './users.router.js'

const organizationsRouter = new Hono<Env>()

organizationsRouter.route('/users', usersRouter)

export default organizationsRouter
