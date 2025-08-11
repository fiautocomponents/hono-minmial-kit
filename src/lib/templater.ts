import mjml2html from 'mjml'
import nunjucks from 'nunjucks'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { ImplementationError } from './errors.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class TemplaterService {
  constructor() {
    nunjucks.configure({ autoescape: true })
  }

  render(templateName: string, variables: Record<string, unknown>): string {
    const templatePath = join(__dirname, 'mail-templates', `${templateName}.mjml`)
    const template = readFileSync(templatePath, 'utf-8')

    const renderedTemplate = nunjucks.renderString(template, variables)

    const { html, errors } = mjml2html(renderedTemplate)

    if (errors.length > 0) {
      throw new ImplementationError(
        `MJML rendering errors inside ${templateName}.mjml: ${errors.map((e) => e.message).join(', ')}`
      )
    }

    return html
  }
}

abstract class TemplateBuilder {
  protected variables: Record<string, unknown> = {}

  protected abstract requiredVariables(): string[]

  protected validateVariables(): void {
    const missingVariables = this.requiredVariables().filter(
      (variable) => !Object.prototype.hasOwnProperty.call(this.variables, variable)
    )

    if (missingVariables.length > 0) {
      throw new ImplementationError(`Missing required variables: ${missingVariables.join(', ')}`)
    }
  }

  abstract build(): string
}

export class NewOrganizationTemplate extends TemplateBuilder {
  setOrganizationName(organizationName: string): this {
    this.variables.organizationName = organizationName
    return this
  }

  setOrganizationAdmin(organizationAdmin: string): this {
    this.variables.organizationAdmin = organizationAdmin
    return this
  }

  setOrganizationURL(organizationURL: string): this {
    this.variables.organizationURL = organizationURL
    return this
  }

  setOrganizationActivePlans(organizationActivePlans: string[]): this {
    this.variables.organizationActivePlans = organizationActivePlans
    return this
  }

  protected requiredVariables(): string[] {
    return ['organizationName', 'organizationAdmin', 'organizationURL', 'organizationActivePlans']
  }

  build(): string {
    this.validateVariables()
    return new TemplaterService().render('new-organization', this.variables)
  }
}

export class NewUserInOrganizationTemplate extends TemplateBuilder {
  setOrganizationName(organizationName: string): this {
    this.variables.organizationName = organizationName
    return this
  }

  setOrganizationAdmin(organizationAdmin: string): this {
    this.variables.organizationAdmin = organizationAdmin
    return this
  }

  setOrganizationSchoolAdmin(organizationSchoolAdmin: string): this {
    this.variables.organizationSchoolAdmin = organizationSchoolAdmin
    return this
  }

  setOrganizationURL(organizationURL: string): this {
    this.variables.organizationURL = organizationURL
    return this
  }

  setUserName(userName: string): this {
    this.variables.userName = userName
    return this
  }

  setUserRole(userRole: string): this {
    this.variables.userRole = userRole
    return this
  }

  protected requiredVariables(): string[] {
    return ['organizationName', 'organizationURL', 'userName', 'userRole']
  }

  protected atLeastOneVariable(): string[] {
    return ['organizationSchoolAdmin', 'organizationAdmin']
  }

  validateVariables(): void {
    super.validateVariables()

    const atLeastOneMissing = this.atLeastOneVariable().every(
      (variable) => !Object.prototype.hasOwnProperty.call(this.variables, variable)
    )
    if (atLeastOneMissing) {
      throw new ImplementationError(
        `At least one of the following variables is required: ${this.atLeastOneVariable().join(', ')}`
      )
    }
  }

  build(): string {
    this.validateVariables()
    return new TemplaterService().render('new-user-in-organization', this.variables)
  }
}

export class RecoverAccountTemplate extends TemplateBuilder {
  setResetPasswordURL(resetPasswordURL: string): this {
    this.variables.resetPasswordURL = resetPasswordURL
    return this
  }

  protected requiredVariables(): string[] {
    return ['resetPasswordURL']
  }

  build(): string {
    this.validateVariables()
    return new TemplaterService().render('recover-account', this.variables)
  }
}
