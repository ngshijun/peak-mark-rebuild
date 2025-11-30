import { createRouter, createWebHistory } from 'vue-router'
import type { RouteLocationNormalized, NavigationGuardNext } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/auth/LoginPage.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('@/pages/auth/SignupPage.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/admin',
      component: () => import('@/components/layout/AppLayout.vue'),
      meta: { requiresAuth: true, allowedRoles: ['admin'] },
      redirect: '/admin/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'admin-dashboard',
          component: () => import('@/pages/admin/DashboardPage.vue'),
        },
        {
          path: 'curriculum',
          name: 'admin-curriculum',
          component: () => import('@/pages/admin/CurriculumPage.vue'),
        },
        {
          path: 'question-bank',
          name: 'admin-question-bank',
          component: () => import('@/pages/admin/QuestionBankPage.vue'),
        },
        {
          path: 'question-statistics',
          name: 'admin-question-statistics',
          component: () => import('@/pages/admin/QuestionStatisticsPage.vue'),
        },
        {
          path: 'question-feedback',
          name: 'admin-question-feedback',
          component: () => import('@/pages/admin/QuestionFeedbackPage.vue'),
        },
        {
          path: 'pets',
          name: 'admin-pets',
          component: () => import('@/pages/admin/PetsPage.vue'),
        },
        {
          path: 'profile',
          name: 'admin-profile',
          component: () => import('@/pages/admin/ProfilePage.vue'),
        },
      ],
    },
    {
      path: '/student',
      component: () => import('@/components/layout/AppLayout.vue'),
      meta: { requiresAuth: true, allowedRoles: ['student'] },
      redirect: '/student/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'student-dashboard',
          component: () => import('@/pages/student/DashboardPage.vue'),
        },
        {
          path: 'practice',
          name: 'student-practice',
          component: () => import('@/pages/student/PracticePage.vue'),
        },
        {
          path: 'practice/quiz',
          name: 'student-practice-quiz',
          component: () => import('@/pages/student/PracticeQuizPage.vue'),
        },
        {
          path: 'session/:sessionId',
          name: 'student-session-result',
          component: () => import('@/pages/student/SessionResultPage.vue'),
        },
        {
          path: 'history',
          name: 'student-history',
          component: () => import('@/pages/student/HistoryPage.vue'),
        },
        {
          path: 'parent',
          name: 'student-parent',
          component: () => import('@/pages/student/ParentPage.vue'),
        },
        {
          path: 'leaderboard',
          name: 'student-leaderboard',
          component: () => import('@/pages/student/LeaderboardPage.vue'),
        },
        {
          path: 'my-pet',
          name: 'student-my-pet',
          component: () => import('@/pages/student/MyPetPage.vue'),
        },
        {
          path: 'collections',
          name: 'student-collections',
          component: () => import('@/pages/student/CollectionsPage.vue'),
        },
        {
          path: 'market',
          name: 'student-market',
          component: () => import('@/pages/student/MarketPage.vue'),
        },
        {
          path: 'gacha',
          name: 'student-gacha',
          component: () => import('@/pages/student/GachaPage.vue'),
        },
        {
          path: 'profile',
          name: 'student-profile',
          component: () => import('@/pages/student/ProfilePage.vue'),
        },
      ],
    },
    {
      path: '/parent',
      component: () => import('@/components/layout/AppLayout.vue'),
      meta: { requiresAuth: true, allowedRoles: ['parent'] },
      redirect: '/parent/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'parent-dashboard',
          component: () => import('@/pages/parent/DashboardPage.vue'),
        },
        {
          path: 'children',
          name: 'parent-children',
          component: () => import('@/pages/parent/ChildrenPage.vue'),
        },
        {
          path: 'statistics',
          name: 'parent-statistics',
          component: () => import('@/pages/parent/StatisticsPage.vue'),
        },
        {
          path: 'session/:childId/:sessionId',
          name: 'parent-session-result',
          component: () => import('@/pages/parent/SessionResultPage.vue'),
        },
        {
          path: 'subscription',
          name: 'parent-subscription',
          component: () => import('@/pages/parent/SubscriptionPage.vue'),
        },
        {
          path: 'profile',
          name: 'parent-profile',
          component: () => import('@/pages/parent/ProfilePage.vue'),
        },
      ],
    },
    // Catch-all route for 404
    {
      path: '/:pathMatch(.*)*',
      redirect: '/login',
    },
  ],
})

// Navigation guard
router.beforeEach(
  async (
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext,
  ) => {
    const authStore = useAuthStore()

    // Initialize auth if not already done
    if (!authStore.isInitialized) {
      await authStore.initialize()
    }

    const isAuthenticated = authStore.isAuthenticated
    const userType = authStore.userType

    // Check if route requires authentication
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
    const requiresGuest = to.matched.some((record) => record.meta.requiresGuest)
    const allowedRoles = to.matched.find((record) => record.meta.allowedRoles)?.meta
      .allowedRoles as string[] | undefined

    // If route requires guest (login/signup) and user is authenticated
    if (requiresGuest && isAuthenticated) {
      // Redirect to appropriate dashboard
      if (userType === 'admin') {
        return next('/admin/dashboard')
      } else if (userType === 'student') {
        return next('/student/dashboard')
      } else if (userType === 'parent') {
        return next('/parent/dashboard')
      }
    }

    // If route requires auth and user is not authenticated
    if (requiresAuth && !isAuthenticated) {
      return next('/login')
    }

    // If route requires specific role and user doesn't have it
    if (requiresAuth && allowedRoles && userType && !allowedRoles.includes(userType)) {
      // Redirect to user's own dashboard
      if (userType === 'admin') {
        return next('/admin/dashboard')
      } else if (userType === 'student') {
        return next('/student/dashboard')
      } else if (userType === 'parent') {
        return next('/parent/dashboard')
      }
    }

    next()
  },
)

export default router
