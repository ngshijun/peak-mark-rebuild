import type { DriveStep } from 'driver.js'
import { useLanguageStore } from '@/stores/language'

export function getParentTourSteps(): DriveStep[] {
  const { t } = useLanguageStore()
  const steps = t.shared.tours.mainTour.parent

  return [
    {
      element: '[data-tour="sidebar-nav"]',
      popover: {
        title: steps.step1.title,
        description: steps.step1.description,
        side: 'right',
        align: 'start',
      },
    },
    {
      element: 'a[href="/parent/announcements"]',
      popover: {
        title: steps.step2.title,
        description: steps.step2.description,
        side: 'right',
        align: 'center',
      },
    },
    {
      element: 'a[href="/parent/children"]',
      popover: {
        title: steps.step3.title,
        description: steps.step3.description,
        side: 'right',
        align: 'center',
      },
    },
    {
      element: 'a[href="/parent/statistics"]',
      popover: {
        title: steps.step4.title,
        description: steps.step4.description,
        side: 'right',
        align: 'center',
      },
    },
    {
      element: 'a[href="/parent/subscription"]',
      popover: {
        title: steps.step5.title,
        description: steps.step5.description,
        side: 'right',
        align: 'center',
      },
    },
    {
      element: 'a[href="/parent/contact"]',
      popover: {
        title: steps.step6.title,
        description: steps.step6.description,
        side: 'right',
        align: 'center',
      },
    },
    {
      element: '[data-tour="parent-child-selector"]',
      popover: {
        title: steps.step7.title,
        description: steps.step7.description,
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="parent-dashboard-overview"]',
      popover: {
        title: steps.step8.title,
        description: steps.step8.description,
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="sidebar-profile"]',
      popover: {
        title: steps.step9.title,
        description: steps.step9.description,
        side: 'right',
        align: 'end',
      },
    },
  ]
}
