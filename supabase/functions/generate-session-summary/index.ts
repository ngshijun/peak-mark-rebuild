import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface QuestionData {
  question: string
  type: 'mcq' | 'short_answer'
  isCorrect: boolean
  studentAnswer: string | null
  correctAnswer: string | null
  questionImageUrl: string | null
  options: {
    label: string
    text: string | null
    imageUrl: string | null
    isCorrect: boolean
    isStudentAnswer: boolean
  }[]
}

interface SessionData {
  gradeLevelName: string
  subjectName: string
  topicName: string
  totalQuestions: number
  correctCount: number
  totalTimeSeconds: number
  questions: QuestionData[]
}

function getImagePublicUrl(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${supabaseUrl}/storage/v1/object/public/question-images/${path}`
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { sessionId } = await req.json()

    if (!sessionId) {
      return new Response('Missing sessionId', { status: 400, headers: corsHeaders })
    }

    // Create Supabase client with service role for full access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch session with topic chain (topic -> subject -> grade_level)
    const { data: session, error: sessionError } = await supabase
      .from('practice_sessions')
      .select(`
        id,
        student_id,
        total_questions,
        correct_count,
        total_time_seconds,
        ai_summary,
        topics (
          name,
          subjects (
            name,
            grade_levels (
              name
            )
          )
        )
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return new Response(`Session not found: ${sessionError?.message}`, { status: 404, headers: corsHeaders })
    }

    // If summary already exists, return it
    if (session.ai_summary) {
      return new Response(JSON.stringify({ summary: session.ai_summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch answers with questions (including image paths)
    const { data: answers, error: answersError } = await supabase
      .from('practice_answers')
      .select(`
        is_correct,
        selected_option,
        text_answer,
        questions!inner(
          question,
          type,
          answer,
          image_path,
          option_1_text,
          option_2_text,
          option_3_text,
          option_4_text,
          option_1_image_path,
          option_2_image_path,
          option_3_image_path,
          option_4_image_path,
          option_1_is_correct,
          option_2_is_correct,
          option_3_is_correct,
          option_4_is_correct
        )
      `)
      .eq('session_id', sessionId)

    if (answersError) {
      return new Response(`Failed to fetch answers: ${answersError.message}`, { status: 500, headers: corsHeaders })
    }

    // Build session data for prompt
    const questionsData: QuestionData[] = (answers || []).map((a: any) => {
      const q = a.questions
      let studentAnswer: string | null = null
      let correctAnswer: string | null = null

      const options: QuestionData['options'] = []

      if (q.type === 'mcq') {
        // Build options array
        const optionLabels = ['A', 'B', 'C', 'D']
        const optionData = [
          { text: q.option_1_text, imagePath: q.option_1_image_path, isCorrect: q.option_1_is_correct },
          { text: q.option_2_text, imagePath: q.option_2_image_path, isCorrect: q.option_2_is_correct },
          { text: q.option_3_text, imagePath: q.option_3_image_path, isCorrect: q.option_3_is_correct },
          { text: q.option_4_text, imagePath: q.option_4_image_path, isCorrect: q.option_4_is_correct },
        ]

        optionData.forEach((opt, index) => {
          if (opt.text || opt.imagePath) {
            const label = optionLabels[index]
            options.push({
              label,
              text: opt.text,
              imageUrl: getImagePublicUrl(opt.imagePath),
              isCorrect: opt.isCorrect ?? false,
              isStudentAnswer: a.selected_option === index + 1,
            })
            if (opt.isCorrect) correctAnswer = label
            if (a.selected_option === index + 1) studentAnswer = label
          }
        })
      } else {
        studentAnswer = a.text_answer
        correctAnswer = q.answer
      }

      return {
        question: q.question,
        type: q.type,
        isCorrect: a.is_correct,
        studentAnswer,
        correctAnswer,
        questionImageUrl: getImagePublicUrl(q.image_path),
        options,
      }
    })

    // Extract names from nested topic structure
    const topic = session.topics as any
    const topicName = topic?.name || 'Unknown'
    const subjectName = topic?.subjects?.name || 'Unknown'
    const gradeLevelName = topic?.subjects?.grade_levels?.name || 'Unknown'

    // Build the messages for OpenAI
    const messages = buildMessages({
      gradeLevelName,
      subjectName,
      topicName,
      totalQuestions: session.total_questions,
      correctCount: session.correct_count || 0,
      totalTimeSeconds: session.total_time_seconds || 0,
      questions: questionsData,
    })

    // Call OpenAI API directly using fetch (for GPT-5 family support)
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        messages,
        reasoning_effort: 'minimal',
      }),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text()
      console.error('OpenAI API error:', errorData)
      return new Response(`OpenAI API error: ${errorData}`, { status: 500, headers: corsHeaders })
    }

    const completion = await openaiResponse.json()
    const summary = completion.choices?.[0]?.message?.content?.trim() || null

    if (!summary) {
      return new Response('Failed to generate summary', { status: 500, headers: corsHeaders })
    }

    // Save summary to database
    const { error: updateError } = await supabase
      .from('practice_sessions')
      .update({ ai_summary: summary })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Failed to save summary:', updateError)
      // Still return the summary even if save fails
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(`Internal error: ${error.message}`, { status: 500, headers: corsHeaders })
  }
})

function buildMessages(data: SessionData): any[] {
  const score = data.totalQuestions > 0
    ? Math.round((data.correctCount / data.totalQuestions) * 100)
    : 0

  const minutes = Math.floor(data.totalTimeSeconds / 60)
  const seconds = data.totalTimeSeconds % 60
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

  const incorrectQuestions = data.questions.filter((q) => !q.isCorrect)

  // Build system message
  const systemMessage = {
    role: 'system',
    content: `You are a friendly and encouraging educational tutor providing feedback to students.
Your task is to write a short, personalized summary (2-3 sentences) of a practice session.
The summary should:
1. Acknowledge what the student did well
2. Gently mention one area for improvement if applicable
3. End with encouragement
Keep the tone warm, supportive, and age-appropriate for students.
Write in second person ("You did great...").
Do not use bullet points or lists - write flowing sentences.`,
  }

  // Build user message content (can include text and images)
  const userContent: any[] = []

  // Add session summary text
  let summaryText = `Practice Session Summary:
- Subject: ${data.subjectName}
- Topic: ${data.topicName}
- Grade Level: ${data.gradeLevelName}
- Score: ${data.correctCount}/${data.totalQuestions} (${score}%)
- Time: ${timeStr}`

  if (score === 100) {
    summaryText += '\n\nThe student got a perfect score!'
  } else if (score >= 80) {
    summaryText += '\n\nThe student performed very well.'
  } else if (score >= 60) {
    summaryText += '\n\nThe student showed good effort but has room for improvement.'
  } else {
    summaryText += '\n\nThe student struggled with this topic and may need additional practice.'
  }

  userContent.push({ type: 'text', text: summaryText })

  // Add incorrect questions with images
  if (incorrectQuestions.length > 0) {
    userContent.push({ type: 'text', text: '\n\nQuestions answered incorrectly:' })

    incorrectQuestions.forEach((q, index) => {
      // Add question text
      userContent.push({
        type: 'text',
        text: `\n${index + 1}. Question: ${q.question}\n   Student's answer: ${q.studentAnswer || 'No answer'}\n   Correct answer: ${q.correctAnswer || 'N/A'}`,
      })

      // Add question image if exists
      if (q.questionImageUrl) {
        userContent.push({
          type: 'image_url',
          image_url: { url: q.questionImageUrl },
        })
      }

      // Add option images for MCQ (only for options that have images)
      if (q.type === 'mcq' && q.options.length > 0) {
        const optionsWithImages = q.options.filter((opt) => opt.imageUrl)
        if (optionsWithImages.length > 0) {
          userContent.push({ type: 'text', text: '   Options:' })
          optionsWithImages.forEach((opt) => {
            const marker = opt.isCorrect ? '(correct)' : opt.isStudentAnswer ? '(student chose)' : ''
            userContent.push({ type: 'text', text: `   ${opt.label}${marker}:` })
            userContent.push({
              type: 'image_url',
              image_url: { url: opt.imageUrl! },
            })
          })
        }
      }
    })
  }

  return [
    systemMessage,
    { role: 'user', content: userContent },
  ]
}
