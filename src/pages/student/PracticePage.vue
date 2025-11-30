<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCurriculumStore } from '@/stores/curriculum'
import { usePracticeStore } from '@/stores/practice'
import { ChevronLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const router = useRouter()
const authStore = useAuthStore()
const curriculumStore = useCurriculumStore()
const practiceStore = usePracticeStore()

const selectedSubjectId = ref<string | null>(null)

// Get student's grade level ID
const studentGradeLevelId = computed(() => {
  if (authStore.user?.userType === 'student') {
    return authStore.studentProfile?.gradeLevelId ?? null
  }
  return null
})

// Get available subjects for student's grade level
const availableSubjects = computed(() => {
  if (!studentGradeLevelId.value) return []
  const grade = curriculumStore.gradeLevels.find((g) => g.id === studentGradeLevelId.value)
  return grade?.subjects ?? []
})

// Get selected subject
const selectedSubject = computed(() => {
  if (!selectedSubjectId.value) return null
  return availableSubjects.value.find((s) => s.id === selectedSubjectId.value) ?? null
})

// Subject images mapping
const subjectImages: Record<string, string> = {
  Mathematics: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop',
  Science: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=400&h=300&fit=crop',
  English: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&h=300&fit=crop',
  Chinese: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400&h=300&fit=crop',
  History: 'https://images.unsplash.com/photo-1461360370896-922624d12a74?w=400&h=300&fit=crop',
  Geography: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&h=300&fit=crop',
}

const defaultSubjectImage =
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop'

// Topic images mapping
const topicImages: Record<string, string> = {
  // Mathematics topics
  Addition: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=400&h=300&fit=crop',
  Subtraction: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&h=300&fit=crop',
  Multiplication:
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop',
  Division: 'https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=400&h=300&fit=crop',
  Fractions: 'https://images.unsplash.com/photo-1632571401005-458e9d244591?w=400&h=300&fit=crop',
  Geometry: 'https://images.unsplash.com/photo-1635372722656-389f87a941b7?w=400&h=300&fit=crop',
  Counting: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=400&h=300&fit=crop',
  Shapes: 'https://images.unsplash.com/photo-1635372722656-389f87a941b7?w=400&h=300&fit=crop',
  // Science topics
  Plants: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop',
  Animals: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=400&h=300&fit=crop',
  Weather: 'https://images.unsplash.com/photo-1504253163759-c23fccaebb55?w=400&h=300&fit=crop',
  Matter: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&h=300&fit=crop',
  Energy: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=300&fit=crop',
  // English topics
  Alphabet: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',
  Phonics: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop',
  Grammar: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop',
  Vocabulary: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&h=300&fit=crop',
  Reading: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=300&fit=crop',
  Writing: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=300&fit=crop',
  Spelling: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',
  // Chinese topics
  Pinyin: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400&h=300&fit=crop',
  Characters: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400&h=300&fit=crop',
  // History topics
  'Local History':
    'https://images.unsplash.com/photo-1461360370896-922624d12a74?w=400&h=300&fit=crop',
  'Famous People':
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop',
  // Geography topics
  Maps: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&h=300&fit=crop',
  Continents: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop',
  Countries: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=400&h=300&fit=crop',
}

const defaultTopicImage =
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=300&fit=crop'

function getSubjectImage(subject: { name: string; coverImage?: string }): string {
  return subject.coverImage || subjectImages[subject.name] || defaultSubjectImage
}

function getTopicImage(topic: { name: string; coverImage?: string }): string {
  return topic.coverImage || topicImages[topic.name] || defaultTopicImage
}

function selectSubject(subjectId: string) {
  selectedSubjectId.value = subjectId
}

function goBackToSubjects() {
  selectedSubjectId.value = null
}

function selectTopic(topicId: string, topicName: string) {
  if (!selectedSubject.value) return

  const session = practiceStore.startSession(
    selectedSubject.value.id,
    selectedSubject.value.name,
    topicId,
    topicName,
  )

  if (session) {
    router.push('/student/practice/quiz')
  }
}
</script>

<template>
  <div class="p-6">
    <!-- Subject Selection -->
    <div v-if="!selectedSubject">
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Practice</h1>
        <p class="text-muted-foreground">Select a subject to start practicing</p>
      </div>

      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="subject in availableSubjects"
          :key="subject.id"
          class="cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1"
          @click="selectSubject(subject.id)"
        >
          <div class="aspect-video w-full overflow-hidden">
            <img
              :src="getSubjectImage(subject)"
              :alt="subject.name"
              class="size-full object-cover transition-transform hover:scale-105"
            />
          </div>
          <CardContent class="p-4">
            <h3 class="text-lg font-semibold">{{ subject.name }}</h3>
            <p class="text-sm text-muted-foreground">
              {{ subject.topics.length }}
              {{ subject.topics.length === 1 ? 'topic' : 'topics' }} available
            </p>
          </CardContent>
        </Card>
      </div>

      <div v-if="availableSubjects.length === 0" class="py-12 text-center">
        <p class="text-muted-foreground">No subjects available for your grade level.</p>
      </div>
    </div>

    <!-- Topic Selection -->
    <div v-else>
      <div class="mb-6">
        <Button variant="ghost" size="sm" class="mb-2 -ml-2" @click="goBackToSubjects">
          <ChevronLeft class="mr-1 size-4" />
          Back to Subjects
        </Button>
        <h1 class="text-2xl font-bold">{{ selectedSubject.name }}</h1>
        <p class="text-muted-foreground">Select a topic to start practicing</p>
      </div>

      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="topic in selectedSubject.topics"
          :key="topic.id"
          class="cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1"
          @click="selectTopic(topic.id, topic.name)"
        >
          <div class="aspect-video w-full overflow-hidden">
            <img
              :src="getTopicImage(topic)"
              :alt="topic.name"
              class="size-full object-cover transition-transform hover:scale-105"
            />
          </div>
          <CardContent class="p-4">
            <h3 class="text-lg font-semibold">{{ topic.name }}</h3>
            <p class="text-sm text-muted-foreground">10 questions</p>
          </CardContent>
        </Card>
      </div>

      <div v-if="selectedSubject.topics.length === 0" class="py-12 text-center">
        <p class="text-muted-foreground">No topics available for this subject.</p>
      </div>
    </div>
  </div>
</template>
