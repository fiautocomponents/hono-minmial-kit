import { Collection, Entity, OneToMany, OneToOne, Property } from '@mikro-orm/core'

import { BaseEntity } from './BaseEntity.js'
import type { Subscriptions } from './Subscriptions.js'
import { Users } from './Users.js'

@Entity()
export class Organizations extends BaseEntity {
  @Property()
  name!: string

  @OneToMany(() => Users, (user) => user.organization)
  users = new Collection<Users>(this)

  @OneToOne()
  subscription!: Subscriptions

  constructor(name: string) {
    super()
    this.name = name
  }
}
