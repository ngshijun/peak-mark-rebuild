import { ref } from 'vue'

const pettingMessages = [
  "You're doing amazing! Keep it up!",
  'Every practice makes you stronger!',
  "I believe in you! You've got this!",
  'Hard work always pays off!',
  "You're smarter than you think!",
  'Mistakes help us learn and grow!',
  'Keep going, champion!',
  'Your effort inspires me!',
  "You're making great progress!",
  'Never give up on your dreams!',
  "One step at a time, you'll get there!",
  "I'm so proud of how hard you work!",
]

const feedingMessages = [
  "Thanks! Now let's ace that next quiz!",
  'Yum! Ready to learn together?',
  "Feeling energized! Let's study!",
  'Brain food! Time to get smarter!',
  "Thanks! You're the best study buddy!",
  "Nom nom! Let's conquer those topics!",
  'Delicious! Now back to learning!',
  'I feel stronger! Just like your brain!',
]

const hungryMessages = [
  'A little snack helps us think better!',
  "Feed me and let's practice together!",
  'Learning is easier on a full tummy!',
  "Let's refuel and tackle more questions!",
]

const maxTierMessages = [
  "We've grown so much together!",
  'Your dedication got us here!',
  'Nothing can stop us now!',
  "We're an unstoppable team!",
  'All that hard work paid off!',
]

const messagePools = {
  petting: pettingMessages,
  feeding: feedingMessages,
  hungry: hungryMessages,
  maxTier: maxTierMessages,
} as const

export type ConversationType = keyof typeof messagePools

/**
 * Composable for pet conversation bubble with random message selection
 * and timeout-based auto-dismiss.
 */
export function usePetConversation() {
  const showBubble = ref(false)
  const currentMessage = ref('')
  let timeout: ReturnType<typeof setTimeout> | null = null

  function triggerMessage(type: ConversationType) {
    if (timeout) clearTimeout(timeout)

    const pool = messagePools[type]
    currentMessage.value = pool[Math.floor(Math.random() * pool.length)]!
    showBubble.value = true

    timeout = setTimeout(() => {
      showBubble.value = false
    }, 3000)
  }

  return { showBubble, currentMessage, triggerMessage }
}
