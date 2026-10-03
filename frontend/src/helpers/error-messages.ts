const ERROR_MESSAGES: Record<string, string> = {
  'Unauthorized - Invalid session': 'Your session has expired. Please login again.',
  'userName or password is wrong': 'Invalid username or password',
  'Invalid credentials': 'Invalid username or password',
  'unknown internal server error': 'An unexpected error occurred. Please try again.',
  'Failed to fetch user': 'Unable to load user profile. Please try again.',
  'You can only update your own account or update as ADMIN': 'You can only update your own account',
  'Invalid credentials - You need your current password to update data':
    'Current password is required to update your account',
  'Username already taken': 'This username is already taken',
  'Failed to update user': 'Unable to update user profile. Please try again.',
  'Registration failed': 'Unable to register. Please try again.',
  'Logout failed': 'Unable to logout. Please try again.',
  Forbidden: 'You do not have permission to perform this action',
  Unauthorized: 'Authentication required. Please login.',
  'Bad Request': 'Invalid request. Please check your input.',
  'Internal Server Error': 'An unexpected error occurred. Please try again.'
};

export function getErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }

  if (typeof error === 'string') {
    return ERROR_MESSAGES[error] || error;
  }

  if (typeof error === 'object' && error !== null && 'statusText' in error) {
    const statusText = (error as { statusText: string }).statusText;
    return ERROR_MESSAGES[statusText] || statusText;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: string }).message;
    return ERROR_MESSAGES[message] || message;
  }

  return 'An unexpected error occurred. Please try again.';
}

export const SUCCESS_MESSAGES = {
  USER_REGISTERED: 'Account created successfully!',
  USER_LOGGED_IN: 'Logged in successfully!',
  USER_LOGGED_OUT: 'Logged out successfully!',
  USER_UPDATED: 'Profile updated successfully!',
  PASSWORD_UPDATED: 'Password updated successfully!',
  DEVICE_UPDATED: 'Device settings updated successfully!',
  DEVICE_PAIRED: 'Device paired successfully!',
  DEVICE_UNPAIRED: 'Device unpaired successfully!'
};
