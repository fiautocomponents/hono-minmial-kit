import { serve } from '@hono/node-server'
import { Scalar } from '@scalar/hono-api-reference'
import { CronJob } from 'cron'
import { describeRoute, openAPISpecs } from 'hono-openapi'
import { StatusCodes } from 'http-status-codes'

import configFactory from './core/config-factory.js'
import Logger from './core/logger.js'
import { makeError } from './lib/errors.js'
import router from './routers/router.js'

const app = configFactory.createApp()

app.get(
  '/health',
  describeRoute({
    description: 'Health check',
    tags: ['Health'],
    security: [], // No security required
    responses: {
      200: {
        description: 'API is healthy',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                uptime: { type: 'string', example: '0:0:0' },
                message: { type: 'string', example: 'OK' },
                date: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
  }),
  (ctx) => {
    return ctx.json({
      uptime: (() => {
        const formatUptime = (seconds: number): string => {
          const h = Math.floor(seconds / 3600)
          const m = Math.floor((seconds % 3600) / 60)
          const s = Math.floor(seconds % 60)
          return `${h}:${m}:${s}`
        }
        return formatUptime(process.uptime())
      })(),
      message: 'OK',
      date: new Date(),
    })
  }
)

app.route('/', router)

app.get(
  '/docs',
  Scalar({
    theme: 'bluePlanet',
    hideModels: true,
    darkMode: true,
    spec: { url: '/openapi' },
  })
)

app.get(
  '/openapi',
  openAPISpecs(app, {
    documentation: {
      info: {
        title: 'Management App API',
        version: '1.0.0',
        description: 'Management App API Documentation - Full API Reference',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
      'x-tagGroups': [
        {
          name: 'General',
          tags: ['Health', 'Authentication', 'Users'],
        },
        {
          name: 'Master - Super Admin',
          tags: [
            'Testing',
            'Plans',
            'Organizations',
            'Program Areas',
            'Program Concentrations',
            'Career Fields',
            'Curriculum Codes',
            'Pathways',
            'EMIS',
            'Credentials',
            'WebXams',
            'Subjects',
            'WBL Evaluation Periods',
          ],
        },
        {
          name: 'Organization',
          tags: [
            'Dashboard',
            'Homeschools',
            'Organization Users',
            'Credential program levels',
            'Organization credentials',
            'Credential costs',
            'Students',
            'CTSO',
          ],
        },
        {
          name: 'Programs',
          tags: [
            'Programs',
            'Advisors',
            'Student Programs',
            'Program Roster',
            'Program Courses',
            'Courses',
            'Program Roster Credentials Scoring',
          ],
        },
        {
          name: 'Surveys',
          tags: ['Roster Surveys'],
        },
        {
          name: 'WBL Internal',
          tags: ['WBL Internal Agreements', 'WBL Internal Timesheets'],
        },
        {
          name: 'WBL Module',
          tags: [
            'Organization WBL Evaluation Periods',
            'Organization WBL Evaluation Period Dates',
            'WBL Programs',
            'WBL Employers',
            'Student WBL Programs',
            'WBL Program Roster',
            'WBL Program Roster Student',
            'WBL Timesheets',
            'WBL Agreements',
            'WBL Evaluations',
          ],
        },
      ],
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local server',
        },
      ],
    },
  })
)

app.onError((err, ctx) => {
  console.error('Error:', err)
  const { error, statusCode } = makeError(err)

  // @ts-expect-error - Hono acts weird with the status code, this works.
  return ctx.json(error, { status: statusCode })
})
app.notFound((ctx) => {
  ctx.status(StatusCodes.NOT_FOUND)
  return ctx.json({
    message: `${ctx.req.method} ${ctx.req.url} not found`,
  })
})

if (!process.env.JWT_SECRET) {
  Logger.error('JWT_SECRET is not set')
  throw new Error('JWT_SECRET is not set')
}
serve(
  {
    fetch: app.fetch,
    port: parseInt(process.env.PORT || '3000'),
  },
  (info) => {
    Logger.info(`Server is running on http://localhost:${info.port}`)
    Logger.info(`API Reference is running on http://localhost:${info.port}/docs`)
  }
)

/** ------------------------- Cron-jobs ------------------------- **/
/** This is a very low load job, so we don't need to move it to a worker.
 * In case that those needs to be executed more often, we should spin up
 * a new container for those jobs, in order to avoid CPU throttling. **/

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const survey1stJune = new CronJob(
  '0 0 1 6 *', // At 00:00 on the 1st of June
  // '*/30 * * * * *', // Every 10 seconds - debugging purpose
  function async() {
    Logger.info('Running cron job for 1st June surveys')
    fetch(`http://localhost:${process.env.PORT}/organizations/cj/surveys/cronjob-executor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'S-Token': process.env.INTERNAL_SECRET_TOKEN || '',
      },
    }).then((response) => {
      if (!response.ok) {
        Logger.error(`HTTP error! status: ${response.status}`)
        return { error: 'HTTP error!' }
      }
      Logger.info('Cron job for 1st June surveys executed successfully')
      return response.json()
    })
  }, // onTick
  null, // onComplete
  true, // start - no need to call job.start() after creating the job
  null // timezone - defaults to the server's timezone
)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const weeklyWBLTimesheet = new CronJob(
  '30 8 * * 1', // At 08:30 on every Monday
  // '*/30 * * * * *', // Every 10 seconds - debugging purpose
  function async() {
    Logger.info('Running cron job for weekly WBL timesheet')
    fetch(
      `http://localhost:${process.env.PORT}/organizations/cj/wbl-module/program-roster/timesheets/cronjob-executor`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'S-Token': process.env.INTERNAL_SECRET_TOKEN || '',
        },
      }
    ).then((response) => {
      if (!response.ok) {
        Logger.error(`HTTP error! status: ${response.status}`)
        return { error: 'HTTP error!' }
      }
      Logger.info('Cron job for weekly WBL timesheet executed successfully')
      return response.json()
    })
  }, // onTick
  null, // onComplete
  true, // start - no need to call job.start() after creating the job
  null // timezone - defaults to the server's timezone
)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const dailyWBLEvaluation = new CronJob(
  '0 0 * * *', // At 00:00 every day
  // '*/30 * * * * *', // Every 10 seconds - debugging purpose
  function async() {
    Logger.info('Running cron job for daily WBL evaluations')
    fetch(
      `http://localhost:${process.env.PORT}/organizations/cj/wbl-module/program-roster/evaluations/cronjob-executor`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'S-Token': process.env.INTERNAL_SECRET_TOKEN || '',
        },
      }
    ).then((response) => {
      if (!response.ok) {
        Logger.error(`HTTP error! status: ${response.status}`)
        return { error: 'HTTP error!' }
      }
      Logger.info('Cron job for daily WBL evaluations executed successfully')
      return response.json()
    })
  }, // onTick
  null, // onComplete
  true, // start - no need to call job.start() after creating the job
  null // timezone - defaults to the server's timezone
)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const weeklyWBLInternalTimesheet = new CronJob(
  '30 8 * * 1', // At 08:30 on every Monday
  // '*/30 * * * * *', // Every 10 seconds - debugging purpose
  function async() {
    Logger.info('Running cron job for weekly WBL Internal timesheet')
    fetch(
      `http://localhost:${process.env.PORT}/organizations/cj/wbl-internal/program-roster/timesheets/cronjob-executor`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'S-Token': process.env.INTERNAL_SECRET_TOKEN || '',
        },
      }
    ).then((response) => {
      if (!response.ok) {
        Logger.error(`HTTP error! status: ${response.status}`)
        return { error: 'HTTP error!' }
      }
      Logger.info('Cron job for weekly WBL Internal timesheet executed successfully')
      return response.json()
    })
  }, // onTick
  null, // onComplete
  true, // start - no need to call job.start() after creating the job
  null // timezone - defaults to the server's timezone
)
