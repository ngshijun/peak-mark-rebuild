import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { getStorageImageUrl } from '@/lib/storage'
import { toMYTDateString, getMYTDayOfWeek, mytDateToUTCDate, utcDateToString } from '@/lib/date'
import type { Database } from '@/types/database.types'

type PetRarity = Database['public']['Enums']['pet_rarity']

export interface StudentProfileData {
  coins: number
  memberSince: string | null
}

export interface StudentPetData {
  name: string
  rarity: PetRarity
  imagePath: string
  tier2ImagePath: string | null
  tier3ImagePath: string | null
  tier: number
  imageUrl: string
}

export interface SubjectStats {
  gradeLevelName: string
  subjectName: string
  averageScore: number
}

export interface WeekDay {
  label: string
  active: boolean
  isToday: boolean
  isFuture: boolean
}

export function useStudentProfileDialog() {
  const profile = ref<StudentProfileData | null>(null)
  const pet = ref<StudentPetData | null>(null)
  const bestSubjects = ref<SubjectStats[]>([])
  const weeklyActivity = ref<WeekDay[]>([])
  const isLoading = ref(false)

  async function fetchProfile(studentId: string) {
    isLoading.value = true
    profile.value = null
    pet.value = null
    bestSubjects.value = []
    weeklyActivity.value = []

    try {
      const { data, error } = await supabase.rpc('get_student_profile_for_dialog', {
        p_student_id: studentId,
      })

      if (error) throw error
      if (!data) return

      const result = data as {
        coins: number
        member_since: string | null
        pet: {
          name: string
          rarity: PetRarity
          image_path: string
          tier2_image_path: string | null
          tier3_image_path: string | null
          tier: number
        } | null
        best_subjects: {
          grade_level_name: string
          subject_name: string
          average_score: number
        }[]
        weekly_activity_dates: string[]
      }

      // Profile
      profile.value = {
        coins: result.coins,
        memberSince: result.member_since,
      }

      // Pet
      if (result.pet) {
        const petData = result.pet
        const tier = petData.tier

        // Pick image path based on tier
        let imagePath = petData.image_path
        if (tier === 2 && petData.tier2_image_path) {
          imagePath = petData.tier2_image_path
        } else if (tier === 3 && petData.tier3_image_path) {
          imagePath = petData.tier3_image_path
        }

        const imageUrl = getStorageImageUrl('pet-images', imagePath, {
          width: 300,
          height: 300,
          quality: 80,
          resize: 'contain',
        })

        pet.value = {
          name: petData.name,
          rarity: petData.rarity,
          imagePath: petData.image_path,
          tier2ImagePath: petData.tier2_image_path,
          tier3ImagePath: petData.tier3_image_path,
          tier,
          imageUrl,
        }
      }

      // Best subjects
      bestSubjects.value = result.best_subjects.map((s) => ({
        gradeLevelName: s.grade_level_name,
        subjectName: s.subject_name,
        averageScore: s.average_score,
      }))

      // Weekly activity: build 7-day array (Mon-Sun) from active dates
      const activeDateStrs = new Set(result.weekly_activity_dates)
      const weekDayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      const todayStr = toMYTDateString()
      const dayOfWeek = getMYTDayOfWeek() // 0=Sun, 1=Mon...
      const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const todayUTC = mytDateToUTCDate(todayStr)
      const monday = new Date(todayUTC)
      monday.setUTCDate(todayUTC.getUTCDate() + mondayOffset)

      weeklyActivity.value = weekDayLabels.map((label, i) => {
        const d = new Date(monday)
        d.setUTCDate(monday.getUTCDate() + i)
        const dateStr = utcDateToString(d)
        return {
          label,
          active: activeDateStrs.has(dateStr),
          isToday: i === todayIndex,
          isFuture: i > todayIndex,
        }
      })
    } catch (err) {
      console.error('Failed to fetch student profile:', err)
    } finally {
      isLoading.value = false
    }
  }

  return {
    profile,
    pet,
    bestSubjects,
    weeklyActivity,
    isLoading,
    fetchProfile,
  }
}
