import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface VerificationCodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

export const VerificationCodeInput: React.FC<VerificationCodeInputProps> = ({
  length = 6,
  value,
  onChange,
  disabled = false,
  error = false,
  autoFocus = true,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [localValues, setLocalValues] = useState<string[]>(Array(length).fill(''));

  // Sync external value with local state
  useEffect(() => {
    const chars = value.split('').slice(0, length);
    const newValues = Array(length).fill('');
    chars.forEach((char, index) => {
      newValues[index] = char;
    });
    setLocalValues(newValues);
  }, [value, length]);

  const focusInput = (index: number) => {
    if (inputRefs.current[index]) {
      inputRefs.current[index]?.focus();
      inputRefs.current[index]?.select();
    }
  };

  const handleChange = (index: number, inputValue: string) => {
    // Only allow digits
    const digit = inputValue.replace(/\D/g, '').slice(-1);
    
    const newValues = [...localValues];
    newValues[index] = digit;
    setLocalValues(newValues);
    
    const newValue = newValues.join('');
    onChange(newValue);

    // Move to next input if a digit was entered
    if (digit && index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      
      const newValues = [...localValues];
      
      if (localValues[index]) {
        // Clear current input
        newValues[index] = '';
        setLocalValues(newValues);
        onChange(newValues.join(''));
      } else if (index > 0) {
        // Move to previous input and clear it
        newValues[index - 1] = '';
        setLocalValues(newValues);
        onChange(newValues.join(''));
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    
    if (pastedData) {
      const newValues = Array(length).fill('');
      pastedData.split('').forEach((char, index) => {
        if (index < length) {
          newValues[index] = char;
        }
      });
      setLocalValues(newValues);
      onChange(newValues.join(''));
      
      // Focus the next empty input or the last input
      const nextEmptyIndex = newValues.findIndex(v => !v);
      focusInput(nextEmptyIndex === -1 ? length - 1 : nextEmptyIndex);
    }
  };

  const handleFocus = (index: number) => {
    inputRefs.current[index]?.select();
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={localValues[index]}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => handleFocus(index)}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          className={cn(
            "w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-data font-bold",
            "border-2 rounded-lg transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-offset-2",
            "bg-background text-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            error 
              ? "border-destructive focus:ring-destructive" 
              : "border-input focus:border-primary focus:ring-primary",
            localValues[index] && !error && "border-primary bg-primary/5"
          )}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
};

export default VerificationCodeInput;
