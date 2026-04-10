export default {
  authErrors: {
    invalidCredentials: '邮箱或密码不正确。',
    emailNotConfirmed: '请先确认您的电子邮件再登录。',
    userAlreadyExists: '此电子邮件已注册。',
    weakPassword: '密码强度不足，请选择更强的密码。',
    samePassword: '新密码不能与当前密码相同。',
    rateLimited: '请求过于频繁，请稍候再试。',
    invalidToken: '此链接无效或已被使用。',
    expiredToken: '此链接已过期，请重新申请。',
  },
  toasts: {
    languageSaveFailed: '保存语言偏好失败',
  },
} as const
