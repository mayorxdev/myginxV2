interface PasswordStrengthIndicatorProps {
  password: string;
}

export default function PasswordStrengthIndicator({
  password,
}: PasswordStrengthIndicatorProps) {
  const calculateStrength = (password: string): number => {
    let score = 0;

    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;

    // Character type checks
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

    return score;
  };

  const getStrengthLabel = (score: number): string => {
    if (score <= 1) return "Weak";
    if (score <= 3) return "Moderate";
    return "Strong";
  };

  const getStrengthColor = (score: number): string => {
    if (score <= 1) return "bg-red-500";
    if (score <= 3) return "bg-yellow-500";
    return "bg-green-500";
  };

  const strength = calculateStrength(password);
  const strengthPercentage = (strength / 5) * 100;

  return (
    <div className="mt-2">
      <div className="h-1 w-full bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getStrengthColor(
            strength
          )} transition-all duration-300`}
          style={{ width: `${strengthPercentage}%` }}
        />
      </div>
      {password && (
        <p
          className={`text-sm mt-1 ${getStrengthColor(strength).replace(
            "bg-",
            "text-"
          )}`}
        >
          Password Strength: {getStrengthLabel(strength)}
        </p>
      )}
    </div>
  );
}
