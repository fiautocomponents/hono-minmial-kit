import { Collection, Entity, Enum, OneToMany, OneToOne } from '@mikro-orm/core'

import type { SubscriptionStatus } from '../lib/enums.js'
import { BaseEntity } from './BaseEntity.js'
import { SubscriptionsPlans } from './SubscriptionsPlans.js'
import type { Users } from './Users.js'

@Entity()
export class Subscriptions extends BaseEntity {
  /**
   * The subscription will have one or multiple plans and a user, the owner of the subscription
   * We will not attach all users to the subscription, that one will be done
   * through organization
   */
  @OneToMany(() => SubscriptionsPlans, (sp) => sp.subscription, {
    orphanRemoval: true,
  })
  subscriptionPlans = new Collection<SubscriptionsPlans>(this)

  @OneToOne()
  user!: Users

  @Enum()
  status!: SubscriptionStatus

  constructor(user: Users, status: SubscriptionStatus) {
    super()
    this.user = user
    this.status = status
  }
}
