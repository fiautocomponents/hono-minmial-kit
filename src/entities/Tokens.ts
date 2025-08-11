import { Entity, Enum, HiddenProps, ManyToOne, Property } from '@mikro-orm/core'

import type { TokenScope } from '../lib/enums.js'
import { BaseEntity } from './BaseEntity.js'
import type { Users } from './Users.js'

@Entity()
export class Tokens extends BaseEntity {
  [HiddenProps]?: 'token'

  @Property({ hidden: true })
  token!: string

  @Property()
  expiresAt!: Date

  @ManyToOne()
  user!: Users

  @Enum()
  scope!: TokenScope

  @Property({ hidden: true })
  usedAt?: Date

  @Property({ hidden: true })
  revokedAt?: Date
}
