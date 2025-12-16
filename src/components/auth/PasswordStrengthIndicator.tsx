import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

interface Requirement {
  label: string;
  labelNl: string;
  test: (password: string) => boolean;
}

const requirements: Requirement[] = [
  {
    label: "At least 8 characters",
    labelNl: "Minimaal 8 tekens",
    test: (p) => p.length >= 8,
  },
  {
    label: "One uppercase letter",
    labelNl: "Eén hoofdletter",
    test: (p) => /[A-Z]/.test(p),
  },
  {
    label: "One lowercase letter",
    labelNl: "Eén kleine letter",
    test: (p) => /[a-z]/.test(p),
  },
  {
    label: "One number",
    labelNl: "Eén cijfer",
    test: (p) => /[0-9]/.test(p),
  },
];

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  className,
}) => {
  const metCount = requirements.filter(r => r.test(password)).length;
  const strengthPercentage = (metCount / requirements.length) * 100;

  const getStrengthColor = () => {
    if (strengthPercentage === 100) return 'bg-success';
    if (strengthPercentage >= 75) return 'bg-info';
    if (strengthPercentage >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              getStrengthColor()
            )}
            style={{ width: `${strengthPercentage}%` }}
          />
        </div>
      </div>

      {/* Requirements list */}
      <ul className="space-y-1.5">
        {requirements.map((req, index) => {
          const isMet = req.test(password);
          return (
            <li
              key={index}
              className={cn(
                "flex items-center gap-2 text-xs transition-colors duration-200",
                isMet ? "text-success" : "text-muted-foreground"
              )}
            >
              {isMet ? (
                <Check className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span>{req.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const isPasswordValid = (password: string): boolean => {
  return requirements.every(r => r.test(password));
};

export default PasswordStrengthIndicator;
