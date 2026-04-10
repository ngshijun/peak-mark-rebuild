export default {
  authErrors: {
    invalidCredentials: 'Incorrect email or password.',
    emailNotConfirmed: 'Please confirm your email before signing in.',
    userAlreadyExists: 'An account with this email already exists.',
    weakPassword: 'Password is too weak. Please choose a stronger one.',
    samePassword: 'New password must be different from the current one.',
    rateLimited: 'Too many requests. Please wait a moment and try again.',
    invalidToken: 'This link is invalid or has been used already.',
    expiredToken: 'This link has expired. Please request a new one.',
  },
  toasts: {
    languageSaveFailed: 'Failed to save language preference',
  },
} as const
