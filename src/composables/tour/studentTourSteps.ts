import type { DriveStep } from 'driver.js'
import { useLanguageStore } from '@/stores/language'

export function getStudentTourSteps(): DriveStep[] {
  const { t } = useLanguageStore()
  const steps = t.shared.tours.mainTour.student

  return [
    {
      element: '[data-tour="sidebar-xp"]',
      popover: {
        title: steps.step1.title,
        description: steps.step1.description,
        side: 'right',
        align: 'center',
      },
    },
    {
      element: '[data-tour="sidebar-nav"]',
      popover: {
        title: steps.step2.title,
        description: steps.step2.description,
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="student-currency"]',
      popover: {
        title: steps.step3.title,
        description: steps.step3.description,
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="dashboard-daily"]',
      popover: {
        title: steps.step4.title,
        description: steps.step4.description,
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="dashboard-pet"]',
      popover: {
        title: steps.step5.title,
        description: steps.step5.description,
        side: 'right',
        align: 'center',
      },
    },
    {
      element: '[data-tour="dashboard-stats"]',
      popover: {
        title: steps.step6.title,
        description: steps.step6.description,
        side: 'left',
        align: 'center',
      },
    },
    {
      element: '[data-tour="sidebar-profile"]',
      popover: {
        title: steps.step7.title,
        description: steps.step7.description,
        side: 'right',
        align: 'end',
      },
    },
  ]
}
