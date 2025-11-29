import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserType, StudentUser } from '@/types'

// XP required for each level (cumulative)
const XP_PER_LEVEL = 500

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)

  const isAuthenticated = computed(() => user.value !== null)
  const userType = computed<UserType | null>(() => user.value?.type ?? null)

  // Student-specific computed properties
  const studentUser = computed(() => {
    if (user.value?.type === 'student') {
      return user.value as StudentUser
    }
    return null
  })

  const currentLevelXp = computed(() => {
    if (!studentUser.value) return 0
    return studentUser.value.xp % XP_PER_LEVEL
  })

  const xpToNextLevel = computed(() => XP_PER_LEVEL)

  const xpProgress = computed(() => {
    if (!studentUser.value) return 0
    return Math.round((currentLevelXp.value / XP_PER_LEVEL) * 100)
  })

  function setUser(newUser: User) {
    user.value = newUser
  }

  function clearUser() {
    user.value = null
  }

  function addXp(amount: number) {
    if (!user.value || user.value.type !== 'student') return

    const student = user.value as StudentUser
    student.xp += amount

    // Check for level up
    const newLevel = Math.floor(student.xp / XP_PER_LEVEL) + 1
    if (newLevel > student.level) {
      student.level = newLevel
    }
  }

  function addCoins(amount: number) {
    if (!user.value || user.value.type !== 'student') return

    const student = user.value as StudentUser
    student.coins = Math.max(0, student.coins + amount)
  }

  function spendCoins(amount: number): boolean {
    if (!user.value || user.value.type !== 'student') return false

    const student = user.value as StudentUser
    if (student.coins < amount) return false

    student.coins -= amount
    return true
  }

  function addFood(amount: number) {
    if (!user.value || user.value.type !== 'student') return

    const student = user.value as StudentUser
    student.food = Math.max(0, student.food + amount)
  }

  function useFood(amount: number): boolean {
    if (!user.value || user.value.type !== 'student') return false

    const student = user.value as StudentUser
    if (student.food < amount) return false

    student.food -= amount
    return true
  }

  function setSelectedPet(petId: string | undefined) {
    if (!user.value || user.value.type !== 'student') return

    const student = user.value as StudentUser
    student.selectedPetId = petId
  }

  function updateAvatar(avatarUrl: string) {
    if (!user.value) return
    user.value.avatar = avatarUrl
  }

  function updateName(name: string) {
    if (!user.value) return
    user.value.name = name
  }

  function getAge(): number | null {
    if (!user.value || user.value.type !== 'student') return null
    const student = user.value as StudentUser
    if (!student.dateOfBirth) return null

    const today = new Date()
    const birthDate = new Date(student.dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }

  function updateGradeLevel(gradeLevelId: string, gradeLevelName: string): boolean {
    if (!user.value || user.value.type !== 'student') return false

    const student = user.value as StudentUser
    const today = new Date().toISOString().split('T')[0]

    // Check if grade was already changed today
    if (student.lastGradeChangeDate === today) {
      return false
    }

    student.gradeLevelId = gradeLevelId
    student.gradeLevelName = gradeLevelName
    student.lastGradeChangeDate = today
    return true
  }

  function canChangeGradeToday(): boolean {
    if (!user.value || user.value.type !== 'student') return false

    const student = user.value as StudentUser
    const today = new Date().toISOString().split('T')[0]

    return student.lastGradeChangeDate !== today
  }

  return {
    user,
    isAuthenticated,
    userType,
    studentUser,
    currentLevelXp,
    xpToNextLevel,
    xpProgress,
    setUser,
    clearUser,
    addXp,
    addCoins,
    spendCoins,
    addFood,
    useFood,
    setSelectedPet,
    updateAvatar,
    updateName,
    getAge,
    updateGradeLevel,
    canChangeGradeToday,
  }
})
