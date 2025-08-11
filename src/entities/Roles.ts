import { Entity, Enum, Property } from '@mikro-orm/core'

import type { UserRoles } from '../lib/enums.js'
import { BaseEntity } from './BaseEntity.js'

@Entity()
export class Roles extends BaseEntity {
  @Enum()
  name!: UserRoles

  @Property()
  description!: string

  constructor(name: UserRoles, description: string) {
    super()
    this.name = name
    this.description = description
  }
}
