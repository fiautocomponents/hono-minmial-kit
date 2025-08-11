import { Hono } from 'hono'

import type { Env } from '../../core/config-factory.js'
import organizationsRouter from './organizations.router.js'

const masterRouter = new Hono<Env>()

masterRouter.route('/organizations', organizationsRouter)

export default masterRouter
