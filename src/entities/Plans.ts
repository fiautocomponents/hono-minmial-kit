import { Entity, Enum, Property } from '@mikro-orm/core'

import type { PlanNames } from '../lib/enums.js'
import { BaseEntity } from './BaseEntity.js'

@Entity()
export class Plans extends BaseEntity {
  @Enum()
  name!: PlanNames

  @Property()
  description!: string

  @Property()
  price!: number

  @Property({ default: 0 })
  duration!: number

  constructor(name: PlanNames, description: string, price: number, duration: number) {
    super()
    this.name = name
    this.description = description
    this.price = price
    this.duration = duration
  }
}
