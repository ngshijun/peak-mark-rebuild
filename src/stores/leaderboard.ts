import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export interface LeaderboardStudent {
  id: string
  name: string
  gradeLevelName: string
  xp: number
  level: number
  avatarUrl?: string
}

// Mock data for top students
const mockStudents: LeaderboardStudent[] = [
  {
    id: 's1',
    name: 'Emma Chen',
    gradeLevelName: 'Grade 2',
    xp: 4850,
    level: 10,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
  },
  {
    id: 's2',
    name: 'Liam Wong',
    gradeLevelName: 'Grade 3',
    xp: 4200,
    level: 9,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Liam',
  },
  {
    id: 's3',
    name: 'Sophia Tan',
    gradeLevelName: 'Grade 2',
    xp: 3950,
    level: 8,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia',
  },
  {
    id: 's4',
    name: 'Noah Lee',
    gradeLevelName: 'Grade 1',
    xp: 3800,
    level: 8,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noah',
  },
  {
    id: 's5',
    name: 'Olivia Lim',
    gradeLevelName: 'Grade 3',
    xp: 3650,
    level: 8,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Olivia',
  },
  {
    id: 's6',
    name: 'William Ng',
    gradeLevelName: 'Grade 2',
    xp: 3400,
    level: 7,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=William',
  },
  {
    id: 's7',
    name: 'Ava Goh',
    gradeLevelName: 'Grade 1',
    xp: 3250,
    level: 7,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ava',
  },
  {
    id: 's8',
    name: 'James Koh',
    gradeLevelName: 'Grade 3',
    xp: 3100,
    level: 7,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
  },
  {
    id: 's9',
    name: 'Isabella Teo',
    gradeLevelName: 'Grade 2',
    xp: 2950,
    level: 6,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Isabella',
  },
  {
    id: 's10',
    name: 'Benjamin Ong',
    gradeLevelName: 'Grade 1',
    xp: 2800,
    level: 6,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Benjamin',
  },
  {
    id: 's11',
    name: 'Mia Yeo',
    gradeLevelName: 'Grade 2',
    xp: 2650,
    level: 6,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia',
  },
  {
    id: 's12',
    name: 'Lucas Chua',
    gradeLevelName: 'Grade 3',
    xp: 2500,
    level: 6,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucas',
  },
  {
    id: 's13',
    name: 'Charlotte Sim',
    gradeLevelName: 'Grade 1',
    xp: 2350,
    level: 5,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlotte',
  },
  {
    id: 's14',
    name: 'Henry Lau',
    gradeLevelName: 'Grade 2',
    xp: 2200,
    level: 5,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Henry',
  },
  {
    id: 's15',
    name: 'Amelia Foo',
    gradeLevelName: 'Grade 3',
    xp: 2050,
    level: 5,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amelia',
  },
  {
    id: 's16',
    name: 'Alexander Ho',
    gradeLevelName: 'Grade 1',
    xp: 1900,
    level: 4,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alexander',
  },
  {
    id: 's17',
    name: 'Harper Pang',
    gradeLevelName: 'Grade 2',
    xp: 1750,
    level: 4,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Harper',
  },
  {
    id: 's18',
    name: 'Daniel Seah',
    gradeLevelName: 'Grade 3',
    xp: 1600,
    level: 4,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
  },
  {
    id: 's19',
    name: 'Evelyn Quek',
    gradeLevelName: 'Grade 1',
    xp: 1450,
    level: 3,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Evelyn',
  },
  {
    id: 's20',
    name: 'Matthew Tay',
    gradeLevelName: 'Grade 2',
    xp: 1300,
    level: 3,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Matthew',
  },
  {
    id: 's21',
    name: 'Abigail Neo',
    gradeLevelName: 'Grade 3',
    xp: 1150,
    level: 3,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Abigail',
  },
  {
    id: 's22',
    name: 'Michael Yap',
    gradeLevelName: 'Grade 1',
    xp: 1000,
    level: 3,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
  },
  {
    id: 's23',
    name: 'Emily Ang',
    gradeLevelName: 'Grade 2',
    xp: 850,
    level: 2,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
  },
  {
    id: 's24',
    name: 'Ethan Phua',
    gradeLevelName: 'Grade 3',
    xp: 700,
    level: 2,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ethan',
  },
  {
    id: 's25',
    name: 'Elizabeth Soh',
    gradeLevelName: 'Grade 1',
    xp: 550,
    level: 2,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elizabeth',
  },
]

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const authStore = useAuthStore()
  const students = ref<LeaderboardStudent[]>(mockStudents)

  // Get all students sorted by XP (including current user)
  const rankedStudents = computed(() => {
    const allStudents = [...students.value]

    // Add current student if logged in and not already in list
    if (authStore.studentUser) {
      const currentStudent = authStore.studentUser
      const existingIndex = allStudents.findIndex((s) => s.id === currentStudent.id)

      if (existingIndex === -1) {
        allStudents.push({
          id: currentStudent.id,
          name: currentStudent.name,
          gradeLevelName: currentStudent.gradeLevelName,
          xp: currentStudent.xp,
          level: currentStudent.level,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentStudent.name}`,
        })
      } else {
        // Update existing entry with current XP
        const existing = allStudents[existingIndex]!
        allStudents[existingIndex] = {
          id: existing.id,
          name: existing.name,
          gradeLevelName: existing.gradeLevelName,
          avatarUrl: existing.avatarUrl,
          xp: currentStudent.xp,
          level: currentStudent.level,
        }
      }
    }

    // Sort by XP descending
    return allStudents.sort((a, b) => b.xp - a.xp)
  })

  // Get top 20 students
  const top20Students = computed(() => {
    return rankedStudents.value.slice(0, 20)
  })

  // Get current student's rank
  const currentStudentRank = computed(() => {
    if (!authStore.studentUser) return null

    const index = rankedStudents.value.findIndex((s) => s.id === authStore.studentUser!.id)
    return index === -1 ? null : index + 1
  })

  // Check if current student is in top 20
  const isCurrentStudentInTop20 = computed(() => {
    if (!currentStudentRank.value) return false
    return currentStudentRank.value <= 20
  })

  return {
    students,
    rankedStudents,
    top20Students,
    currentStudentRank,
    isCurrentStudentInTop20,
  }
})
