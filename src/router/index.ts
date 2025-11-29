import { createRouter, createWebHistory } from 'vue-router'

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
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('@/pages/auth/SignupPage.vue'),
    },
    {
      path: '/admin',
      component: () => import('@/components/layout/AppLayout.vue'),
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
  ],
})

export default router
