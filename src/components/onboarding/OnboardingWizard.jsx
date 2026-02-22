import { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useOnboarding } from "../../hooks/useOnboarding.js";
import { WizardContainer } from "./WizardContainer.jsx";
import { WizardNavBar } from "./WizardNavBar.jsx";
import { InteractiveWalkthrough } from "./InteractiveWalkthrough.jsx";
import "./onboarding.css";

export function OnboardingWizard() {
  const {
    phase,
    isLoading,
    currentStep,
    totalSteps,
    selections,
    next,
    back,
    goTo,
    updateSelection,
    completeWizard,
    completeWalkthrough,
    restart,
  } = useOnboarding();

  const [direction, setDirection] = useState(1);

  // Expose dev controls to console
  useEffect(() => {
    window.lokusOnboarding = {
      restart,
      reset: restart,
    };
    return () => { delete window.lokusOnboarding; };
  }, [restart]);

  if (isLoading) return null;

  // Walkthrough phase — runs after wizard closes
  if (phase === "walkthrough") {
    return <InteractiveWalkthrough onComplete={completeWalkthrough} />;
  }

  // No active onboarding
  if (phase !== "wizard") return null;

  const handleNext = () => {
    setDirection(1);
    next();
  };

  const handleBack = () => {
    setDirection(-1);
    back();
  };

  const handleGoTo = (step) => {
    setDirection(step > currentStep ? 1 : -1);
    goTo(step);
  };

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  // WelcomeSplash (step 0) and ReadyScreen (step 5) handle their own navigation
  const showNavBar = currentStep > 0 && currentStep < totalSteps - 1;

  return (
    <DialogPrimitive.Root open={true} onOpenChange={() => {}}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 onboarding-overlay" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-full max-w-[720px] bg-app-panel border border-app-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Lokus Onboarding</DialogPrimitive.Title>
          <WizardContainer
            currentStep={currentStep}
            direction={direction}
            selections={selections}
            updateSelection={updateSelection}
            next={handleNext}
            back={handleBack}
            complete={completeWizard}
          />
          {showNavBar && (
            <WizardNavBar
              currentStep={currentStep}
              totalSteps={totalSteps}
              onNext={handleNext}
              onBack={handleBack}
              onGoTo={handleGoTo}
              isLastStep={isLastStep}
              isFirstStep={isFirstStep}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
