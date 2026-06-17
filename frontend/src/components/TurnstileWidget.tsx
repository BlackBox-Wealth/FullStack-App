import { Turnstile } from "@marsidev/react-turnstile";
import { useState, useRef, useImperativeHandle, forwardRef } from "react";

interface TurnstileWidgetProps {
  onVerify: (token: string | null) => void;
  className?: string;
  initialMode?: "invisible" | "normal";
}

export interface TurnstileWidgetRef {
  reset: () => void;
  escalateToInteractive: () => void;
}

const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  ({ onVerify, className = "", initialMode = "invisible" }, ref) => {
    const [token, setToken] = useState<string | null>(null);
    const [mode, setMode] = useState<"invisible" | "normal">(initialMode);
    const turnstileRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        setToken(null);
        if (turnstileRef.current) {
          turnstileRef.current.reset();
        }
      },
      escalateToInteractive: () => {
        console.warn("Captcha failed - escalating to interactive mode");
        setMode("normal");
        setToken(null);
        if (turnstileRef.current) {
          turnstileRef.current.reset();
        }
      },
    }));

    const handleSuccess = (newToken: string) => {
      setToken(newToken);
      onVerify(newToken);
    };

    const handleError = () => {
      console.error("Captcha error");
      setToken(null);
      onVerify(null);
    };

    const handleExpire = () => {
      console.warn("Captcha expired");
      setToken(null);
      onVerify(null);
    };

    return (
      <div className={`flex justify-center ${className}`}>
        <Turnstile
          key={mode}
          ref={turnstileRef}
          siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
          onSuccess={handleSuccess}
          onError={handleError}
          onExpire={handleExpire}
          options={{
            theme: "light",
            size: mode,
          }}
        />
      </div>
    );
  }
);

TurnstileWidget.displayName = "TurnstileWidget";

export default TurnstileWidget;
