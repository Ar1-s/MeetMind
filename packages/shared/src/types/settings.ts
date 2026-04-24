export interface UserPreferences {
  auto_analysis: boolean
  auto_task_extract: boolean
  confirm_high_risk: boolean
  smtp_host?: string
  smtp_port?: number
  smtp_username?: string
  smtp_from?: string
}

export type UserPreferencesUpdate = Partial<UserPreferences>
