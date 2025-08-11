import { Hono } from 'hono'

import type { Env } from '../core/config-factory.js'
import authRouter from './auth.router.js'
import masterRouter from './master/index.router.js'
import usersRouter from './users.router.js'

const router = new Hono<Env>()

router.route('/auth', authRouter)
router.route('/users', usersRouter)

router.route('/master', masterRouter)

export default router
