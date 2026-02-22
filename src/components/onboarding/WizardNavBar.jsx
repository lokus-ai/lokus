import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

export function WizardNavBar({ currentStep, totalSteps, onNext, onBack, onGoTo, isLastStep, isFirstStep }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-app-border">
      {/* Back button */}
      <div className="w-20">
        {!isFirstStep && (
          <button
            onClick={onBack}
            className="text-sm text-app-muted hover:text-app-text transition-colors"
          >
            Back
          </button>
        )}
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <button
            key={i}
            onClick={() => onGoTo(i)}
            className={`onboarding-dot ${i === currentStep ? "active" : ""} ${i < currentStep ? "completed" : ""}`}
            aria-label={`Go to step ${i + 1}`}
          />
        ))}
      </div>

      {/* Next button */}
      <div className="w-20 flex justify-end">
        {!isLastStep && (
          <button
            onClick={onNext}
            className="px-4 py-1.5 bg-app-accent text-app-accent-fg rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
