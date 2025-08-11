import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/core'

import { BaseEntity } from './BaseEntity.js'
import type { Plans } from './Plans.js'
import type { Subscriptions } from './Subscriptions.js'

@Entity()
@Unique({ properties: ['subscription', 'plan'] })
export class SubscriptionsPlans extends BaseEntity {
  @ManyToOne()
  subscription!: Subscriptions

  @ManyToOne()
  plan!: Plans

  @Property()
  startAt!: Date

  @Property()
  endAt!: Date

  constructor(subscription: Subscriptions, plan: Plans, startAt: Date, endAt: Date) {
    super()
    this.subscription = subscription
    this.plan = plan
    this.startAt = startAt
    this.endAt = endAt
  }
}
