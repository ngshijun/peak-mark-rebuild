import type { DriveStep } from 'driver.js'
import { useLanguageStore } from '@/stores/language'

export interface FirstPetTourCallbacks {
  /** Step 1: User clicks Collections sidebar link */
  onCollectionsStepReady: () => void
  /** Step 2: User clicks "Unlock New Pets" button on Collections page */
  onUnlockPetsStepReady: () => void
  /** Step 3: User clicks the pull button on Gacha page */
  onPullStepReady: () => void
  /** Step 4: Show the pet result (Next button to continue) */
  onPetRevealStepReady: () => void
  /** Step 5: User clicks Close on the result dialog */
  onCloseResultStepReady: () => void
  /** Step 6: User clicks Collections sidebar link to go back */
  onBackToCollectionsStepReady: () => void
  /** Step 7: User clicks Cloud Bunny card to open detail dialog */
  onPetCardStepReady: () => void
  /** Step 8: User clicks "Select as My Pet" in the detail dialog */
  onSelectCompanionStepReady: () => void
  /** Step 9: User clicks X to close the detail dialog */
  onCloseDetailStepReady: () => void
  /** Step 10: User clicks Dashboard sidebar link */
  onDashboardStepReady: () => void
  /** Step 11: Final — highlight pet card on dashboard */
  onFinalStepReady: () => void
}

export function getFirstPetTourSteps(callbacks: FirstPetTourCallbacks): DriveStep[] {
  const { t } = useLanguageStore()
  const steps = t.shared.tours.firstPetTour

  return [
    {
      element: 'a[href="/student/collections"]',
      onHighlightStarted: () => {
        callbacks.onCollectionsStepReady()
      },
      popover: {
        title: steps.step1.title,
        description: steps.step1.description,
        side: 'right',
        align: 'center',
        showButtons: [],
      },
    },
    {
      element: '[data-tour="unlock-new-pets"]',
      onHighlightStarted: () => {
        callbacks.onUnlockPetsStepReady()
      },
      popover: {
        title: steps.step2.title,
        description: steps.step2.description,
        side: 'bottom',
        align: 'center',
        showButtons: [],
      },
    },
    {
      element: '[data-tour="gacha-single-pull"]',
      onHighlightStarted: () => {
        callbacks.onPullStepReady()
      },
      popover: {
        title: steps.step3.title,
        description: steps.step3.description,
        side: 'bottom',
        align: 'center',
        showButtons: [],
      },
    },
    {
      element: '[data-tour="gacha-result-pet"]',
      disableActiveInteraction: true,
      popover: {
        title: steps.step4.title,
        description: steps.step4.description,
        side: 'right',
        align: 'center',
        showButtons: ['next'],
        nextBtnText: steps.step4.nextBtnText,
        onNextClick: () => {
          callbacks.onPetRevealStepReady()
        },
      },
    },
    {
      element: '[data-tour="gacha-close-results"]',
      onHighlightStarted: () => {
        callbacks.onCloseResultStepReady()
      },
      popover: {
        title: steps.step5.title,
        description: steps.step5.description,
        side: 'right',
        align: 'center',
        showButtons: [],
      },
    },
    {
      element: 'a[href="/student/collections"]',
      onHighlightStarted: () => {
        callbacks.onBackToCollectionsStepReady()
      },
      popover: {
        title: steps.step6.title,
        description: steps.step6.description,
        side: 'right',
        align: 'center',
        showButtons: [],
      },
    },
    {
      element: '[data-tour="first-pet-card"]',
      onHighlightStarted: () => {
        callbacks.onPetCardStepReady()
      },
      popover: {
        title: steps.step7.title,
        description: steps.step7.description,
        side: 'right',
        align: 'center',
        showButtons: [],
      },
    },
    {
      element: '[data-tour="select-as-companion"]',
      onHighlightStarted: () => {
        callbacks.onSelectCompanionStepReady()
      },
      popover: {
        title: steps.step8.title,
        description: steps.step8.description,
        side: 'right',
        align: 'center',
        showButtons: [],
      },
    },
    {
      element: '[data-slot="dialog-close"]',
      onHighlightStarted: () => {
        callbacks.onCloseDetailStepReady()
      },
      popover: {
        title: steps.step9.title,
        description: steps.step9.description,
        side: 'right',
        align: 'center',
        showButtons: [],
      },
    },
    {
      element: 'a[href="/student/dashboard"]',
      onHighlightStarted: () => {
        callbacks.onDashboardStepReady()
      },
      popover: {
        title: steps.step10.title,
        description: steps.step10.description,
        side: 'right',
        align: 'center',
        showButtons: [],
      },
    },
    {
      element: '[data-tour="dashboard-pet"]',
      disableActiveInteraction: true,
      popover: {
        title: steps.step11.title,
        description: steps.step11.description,
        side: 'right',
        align: 'center',
        showButtons: ['next'],
        nextBtnText: steps.step11.nextBtnText,
        onNextClick: () => {
          callbacks.onFinalStepReady()
        },
      },
    },
  ]
}
