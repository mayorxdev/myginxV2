declare module "@/services/database" {
  export const dbService: {
    verifyCredentials: (
      username: string,
      password: string
    ) => Promise<{ isValid: boolean; isFirstLogin: boolean }>;
    updateCredentials: (
      oldUsername: string,
      newUsername: string,
      newPassword: string
    ) => Promise<void>;
  };
}

declare module "@/utils/validation" {
  export function validatePassword(password: string): string[];
}
