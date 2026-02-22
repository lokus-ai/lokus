import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WelcomeSplash } from "./steps/WelcomeSplash.jsx";
import { UseCaseSelection } from "./steps/UseCaseSelection.jsx";
import { ThemePicker } from "./steps/ThemePicker.jsx";
import { WorkspaceSetup } from "./steps/WorkspaceSetup.jsx";
import { FeatureGallery } from "./steps/FeatureGallery.jsx";
import { ReadyScreen } from "./steps/ReadyScreen.jsx";

const STEPS = [WelcomeSplash, UseCaseSelection, ThemePicker, WorkspaceSetup, FeatureGallery, ReadyScreen];

const variants = {
  enter: (direction) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

export function WizardContainer({ currentStep, direction, selections, updateSelection, next, back, complete }) {
  const StepComponent = STEPS[currentStep];

  return (
    <div className="flex-1 overflow-hidden relative min-h-[380px]">
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute inset-0 px-2 py-4 overflow-y-auto"
        >
          <StepComponent
            selections={selections}
            updateSelection={updateSelection}
            next={next}
            back={back}
            complete={complete}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
