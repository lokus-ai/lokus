import { useState, useCallback, useEffect } from "react";
import { readConfig, updateConfig } from "../core/config/store.js";

const TOTAL_STEPS = 6;

export function useOnboarding() {
  // "wizard" | "walkthrough" | null
  const [phase, setPhase] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState({
    useCases: [],
    theme: null,
    vaultName: "My Vault",
    dailyNotes: true,
  });

  // Check if onboarding has been completed
  useEffect(() => {
    const check = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("skipTour") === "true" || params.get("testMode") === "true") {
          setIsLoading(false);
          return;
        }
        const config = await readConfig();
        const completed = config?.hasCompletedOnboarding ?? false;
        if (!completed) {
          setPhase("wizard");
        }
      } catch {
        setPhase("wizard");
      } finally {
        setIsLoading(false);
      }
    };
    check();
  }, []);

  const next = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  }, []);

  const back = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const goTo = useCallback((step) => {
    setCurrentStep(Math.max(0, Math.min(step, TOTAL_STEPS - 1)));
  }, []);

  const updateSelection = useCallback((key, value) => {
    setSelections((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Wizard complete → transition to walkthrough
  const completeWizard = useCallback(async () => {
    try {
      await updateConfig({
        hasCompletedOnboarding: true,
        onboardingSelections: selections,
      });
    } catch {}
    setPhase("walkthrough");
  }, [selections]);

  // Walkthrough complete → done
  const completeWalkthrough = useCallback(() => {
    setPhase(null);
  }, []);

  // Skip everything
  const skipAll = useCallback(async () => {
    try {
      await updateConfig({ hasCompletedOnboarding: true });
    } catch {}
    setPhase(null);
  }, []);

  const restart = useCallback(async () => {
    try {
      await updateConfig({ hasCompletedOnboarding: false });
    } catch {}
    setCurrentStep(0);
    setSelections({
      useCases: [],
      theme: null,
      vaultName: "My Vault",
      dailyNotes: true,
    });
    setPhase("wizard");
  }, []);

  return {
    phase,
    isLoading,
    currentStep,
    totalSteps: TOTAL_STEPS,
    selections,
    next,
    back,
    goTo,
    updateSelection,
    completeWizard,
    completeWalkthrough,
    skipAll,
    restart,
  };
}
