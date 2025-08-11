import type { EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'

import { Plans } from '../entities/Plans.js'
import { Roles } from '../entities/Roles.js'
import { Users } from '../entities/Users.js'
import { PlanNames, UserRoles } from '../lib/enums.js'

export class CoreSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const roles: Roles[] = [
      new Roles(
        UserRoles.SUPER_ADMIN,
        'Super Admin is the owner of the system, capable of managing all organizations'
      ),
      new Roles(
        UserRoles.SCHOOL_ADMIN,
        'School Admin is the owner of the organization, capable of managing all users and classes within the organization'
      ),
      new Roles(UserRoles.FACULTY, 'Faculty is a teacher within the organization'),
      new Roles(UserRoles.STUDENT, 'Student is a learner within the organization'),
    ]

    const plans: Plans[] = [
      new Plans(PlanNames.PLAN_TWO, 'Plan One is a time tracking system', 0, 365),
      new Plans(PlanNames.PLAN_ONE, 'Plan Two is a something else system', 0, 365),
    ]

    for (const role of roles) {
      if (!(await em.findOne(Roles, { name: role.name }))) {
        await em.persistAndFlush(role)
      } else {
        console.info(`Role <${role.name}> already exists`)
      }
    }

    for (const plan of plans) {
      if (!(await em.findOne(Plans, { name: plan.name }))) {
        await em.persistAndFlush(plan)
      } else {
        console.info(`Plan <${plan.name}> already exists`)
      }
    }

    const superAdmin: Users = new Users(
      'sadmin@management-app.com',
      'random-password',
      'Super',
      'Admin'
    )

    if (!(await em.findOne(Users, { email: superAdmin.email }))) {
      superAdmin.activeAt = new Date()
      superAdmin.role = roles[0]
      await em.persistAndFlush(superAdmin)
    } else {
      console.info(`User <${superAdmin.email}> already exists`)
    }
  }
}
