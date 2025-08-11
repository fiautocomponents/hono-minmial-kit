import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

import { ImplementationError } from './errors.js'

export interface MailService {
  sendMail: (to: string[], subject: string, text?: string, html?: string) => Promise<void>
}

export class MailTrapService implements MailService {
  private readonly transporter: Transporter | undefined

  constructor() {
    if (process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io',
        port: parseInt(process.env.MAILTRAP_PORT || '2525'),
        auth: {
          user: process.env.MAILTRAP_USER,
          pass: process.env.MAILTRAP_PASS,
        },
      })
    }
  }

  async sendMail(to: string[], subject: string, text?: string, html?: string): Promise<void> {
    if (!this.transporter) {
      throw new ImplementationError('MailTrapService not properly configured')
    }

    await this.transporter.sendMail({
      to: to.join(', '),
      subject,
      text: text || '',
      html: html || '',
    })
  }
}

export class SendGridService implements MailService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendMail(to: string[], subject: string, text?: string, html?: string): Promise<void> {
    throw new ImplementationError('SendGridService not implemented')
  }
}

export class PostmarkService implements MailService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendMail(to: string[], subject: string, text?: string, html?: string): Promise<void> {
    throw new ImplementationError('PostmarkService not implemented')
  }
}

export class MailContext {
  private mailService: MailService

  constructor(mailService: MailService) {
    this.mailService = mailService
  }

  switchMailService(mailService: MailService) {
    this.mailService = mailService
  }

  async sendMail(to: string[], subject: string, text?: string, html?: string): Promise<void> {
    await this.mailService.sendMail(to, subject, text, html)
  }
}

export function fetchDefaultMailContext(): MailContext {
  if (process.env.NODE_ENV !== 'production') {
    return new MailContext(new MailTrapService())
  }

  if (process.env.TARGET_MAIL_SERVICE === 'postmark') {
    return new MailContext(new PostmarkService())
  }

  return new MailContext(new SendGridService())
}

export const defaultMailContext = fetchDefaultMailContext()
