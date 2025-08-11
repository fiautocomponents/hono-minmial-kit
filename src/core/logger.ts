import chalk from 'chalk'
import type { ChalkInstance } from 'chalk'
import fs from 'fs'
import path from 'path'
import { stripVTControlCharacters } from 'util'

class Logger {
  private static logDir = path.resolve('logs')
  private static trafficLogDir = path.resolve('logs/traffic')

  private static formatMessage(
    level: string,
    color: ChalkInstance,
    message: unknown,
    useColor: boolean
  ): string {
    const timestamp = new Date().toISOString()
    let formattedMessage

    if (typeof message === 'string') {
      formattedMessage = message
    } else if (typeof message === 'object') {
      try {
        formattedMessage = JSON.stringify(message, null, 2)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        formattedMessage = '[Unable to stringify object]'
      }
    } else {
      formattedMessage = String(message)
    }

    // the message might have already colors in it, must remove them
    formattedMessage = stripVTControlCharacters(formattedMessage)
    const coloredMessage = `${color.bold(`[${level}]`)}${chalk.gray(` [${timestamp}] `)}${chalk.white(formattedMessage)}`
    const plainMessage = `[${level}] [${timestamp}] ${formattedMessage}`

    return useColor ? coloredMessage : plainMessage
  }

  private static ensureLogDirExists() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir)
    }
  }

  private static ensureTrafficLogDirExists() {
    if (!fs.existsSync(this.trafficLogDir)) {
      fs.mkdirSync(this.trafficLogDir)
    }
  }

  private static getLogFilePath(): string {
    const date = new Date().toISOString().split('T')[0] // Get YYYY-MM-DD format
    return path.join(this.logDir, `${date}.log`)
  }

  private static getTrafficLogFilePath(): string {
    const date = new Date().toISOString().split('T')[0] // Get YYYY-MM-DD format
    return path.join(this.trafficLogDir, `${date}.log`)
  }

  private static writeToFile(message: string): void {
    const logFilePath = this.getLogFilePath()
    fs.appendFileSync(logFilePath, message + '\n')
  }

  private static writeTrafficToFile(message: string): void {
    const logFilePath = this.getTrafficLogFilePath()
    fs.appendFileSync(logFilePath, message + '\n')
  }

  static error(message: unknown): void {
    const formattedMessage = this.formatMessage('ERROR', chalk.red, message, true)
    console.error(formattedMessage)
    this.ensureLogDirExists()
    this.writeToFile(this.formatMessage('ERROR', chalk.red, message, false))
  }

  static warn(message: unknown): void {
    const formattedMessage = this.formatMessage('WARN', chalk.yellow, message, true)
    console.warn(formattedMessage)
    this.ensureLogDirExists()
    this.writeToFile(this.formatMessage('WARN', chalk.yellow, message, false))
  }

  static info(message: unknown): void {
    const formattedMessage = this.formatMessage('INFO', chalk.blue, message, true)
    console.log(formattedMessage)
    this.ensureLogDirExists()
    this.writeToFile(this.formatMessage('INFO', chalk.blue, message, false))
  }

  static debug(message: unknown): void {
    const formattedMessage = this.formatMessage('DEBUG', chalk.magenta, message, true)
    console.debug(formattedMessage)
    this.ensureLogDirExists()
    this.writeToFile(this.formatMessage('DEBUG', chalk.magenta, message, false))
  }

  static success(message: unknown): void {
    const formattedMessage = this.formatMessage('SUCCESS', chalk.green, message, true)
    console.log(formattedMessage)
    this.ensureLogDirExists()
    this.writeToFile(this.formatMessage('SUCCESS', chalk.green, message, false))
  }

  static traffic(message: unknown): void {
    this.ensureTrafficLogDirExists()
    this.writeTrafficToFile(this.formatMessage('TRAFFIC', chalk.cyan, message, false))
  }
}

export default Logger
