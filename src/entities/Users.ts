import type { Rel } from '@mikro-orm/core'
import { Entity, HiddenProps, ManyToOne, Property, Unique } from '@mikro-orm/core'
import { IsEmail } from 'class-validator'

import { generateSalt, hashPassword, validatePassword } from '../core/security.js'
import { BaseEntity } from './BaseEntity.js'
import type { Organizations } from './Organizations.js'
import type { Roles } from './Roles.js'

@Entity()
export class Users extends BaseEntity {
  [HiddenProps]?: 'hashedPassword' | 'salt'

  @ManyToOne()
  role!: Roles

  @Property()
  @IsEmail({}, { message: 'Invalid email address' })
  @Unique()
  email!: string

  @Property({ hidden: true })
  hashedPassword?: string

  @Property({ hidden: true })
  salt?: string

  @Property()
  firstName?: string

  @Property()
  lastName?: string

  @Property()
  activeAt?: Date

  @Property({ hidden: true })
  lastLoginAt?: Date

  @Property()
  phoneNumber?: string

  @ManyToOne()
  organization?: Rel<Organizations>

  constructor(
    email: string,
    password?: string,
    firstName?: string,
    lastName?: string,
    phoneNumber?: string
  ) {
    super()
    this.email = email
    this.firstName = firstName
    this.lastName = lastName
    this.phoneNumber = phoneNumber

    if (password) {
      this.changePassword(password)
    }
  }

  changePassword(password: string) {
    this.salt = generateSalt()
    this.hashedPassword = hashPassword(password, this.salt)
  }

  validatePassword(password: string) {
    if (!this.hashedPassword || !this.salt || !this.activeAt) {
      return false
    }

    return validatePassword(password, this.salt, this.hashedPassword)
  }
}
