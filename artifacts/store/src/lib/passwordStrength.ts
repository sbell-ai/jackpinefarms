export interface PasswordValidation {
  valid: boolean;
  message: string;
}

export function validatePassword(pw: string): PasswordValidation {
  if (pw.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters." };
  }
  if (!/[A-Z]/.test(pw)) {
    return { valid: false, message: "Password must include at least one uppercase letter." };
  }
  if (!/[a-z]/.test(pw)) {
    return { valid: false, message: "Password must include at least one lowercase letter." };
  }
  if (!/[0-9]/.test(pw)) {
    return { valid: false, message: "Password must include at least one number." };
  }
  return { valid: true, message: "" };
}
