export interface SessionAnswer {
  questionId: string | null
  selectedOptions: number[] | null
  textAnswer: string | null
  isCorrect: boolean
  timeSpentSeconds: number | null
}

const OPTION_NUMBER_TO_ID: Record<number, string> = { 1: 'a', 2: 'b', 3: 'c', 4: 'd' }

export function getSelectedOptionIds(answer: SessionAnswer | undefined): string[] {
  if (!answer?.selectedOptions) return []
  return answer.selectedOptions.map((n) => OPTION_NUMBER_TO_ID[n] ?? 'a')
}

export function wasOptionSelected(answer: SessionAnswer | undefined, optionId: string): boolean {
  return getSelectedOptionIds(answer).includes(optionId)
}

export function isQuestionDeleted(question: unknown): boolean {
  return (question as { isDeleted?: boolean })?.isDeleted === true
}

export function isOptionFilled(opt: { text?: string | null; imagePath?: string | null }): boolean {
  return !!(opt.text && opt.text.trim()) || !!opt.imagePath
}
