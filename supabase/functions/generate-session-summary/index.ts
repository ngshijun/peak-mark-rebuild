import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface SessionData {
  sessionId: string
  studentId: string
  gradeLevelName: string
  subjectName: string
  topicName: string
  totalQuestions: number
  correctCount: number
  totalTimeSeconds: number
  questions: {
    question: string
    type: 'mcq' | 'short_answer'
    isCorrect: boolean
    timeSpentSeconds: number
    studentAnswer: string | null
    correctAnswer: string | null
  }[]
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

    // Fetch answers with questions
    const { data: answers, error: answersError } = await supabase
      .from('practice_answers')
      .select(`
        is_correct,
        time_spent_seconds,
        selected_option,
        text_answer,
        questions!inner(
          question,
          type,
          answer,
          option_1_text,
          option_2_text,
          option_3_text,
          option_4_text,
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
    const questionsData = (answers || []).map((a: any) => {
      const q = a.questions
      let studentAnswer: string | null = null
      let correctAnswer: string | null = null

      if (q.type === 'mcq') {
        // Convert selected_option (1-4) to letter (A-D)
        if (a.selected_option) {
          studentAnswer = String.fromCharCode(64 + a.selected_option) // 1->A, 2->B, etc.
        }
        // Find correct option
        if (q.option_1_is_correct) correctAnswer = 'A'
        else if (q.option_2_is_correct) correctAnswer = 'B'
        else if (q.option_3_is_correct) correctAnswer = 'C'
        else if (q.option_4_is_correct) correctAnswer = 'D'
      } else {
        studentAnswer = a.text_answer
        correctAnswer = q.answer
      }

      return {
        question: q.question,
        type: q.type,
        isCorrect: a.is_correct,
        timeSpentSeconds: a.time_spent_seconds || 0,
        studentAnswer,
        correctAnswer,
      }
    })

    // Extract names from nested topic structure
    const topic = session.topics as any
    const topicName = topic?.name || 'Unknown'
    const subjectName = topic?.subjects?.name || 'Unknown'
    const gradeLevelName = topic?.subjects?.grade_levels?.name || 'Unknown'

    // Build the prompt
    const prompt = buildPrompt({
      sessionId,
      studentId: session.student_id,
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
        messages: [
          {
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
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
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

function buildPrompt(data: SessionData): string {
  const score = data.totalQuestions > 0
    ? Math.round((data.correctCount / data.totalQuestions) * 100)
    : 0

  const minutes = Math.floor(data.totalTimeSeconds / 60)
  const seconds = data.totalTimeSeconds % 60
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

  const incorrectQuestions = data.questions
    .filter((q) => !q.isCorrect)
    .map((q) => `- "${q.question.substring(0, 50)}${q.question.length > 50 ? '...' : ''}"`)
    .slice(0, 3) // Limit to 3 examples

  let prompt = `Practice Session Summary:
- Subject: ${data.subjectName}
- Topic: ${data.topicName}
- Grade Level: ${data.gradeLevelName}
- Score: ${data.correctCount}/${data.totalQuestions} (${score}%)
- Time: ${timeStr}
`

  if (incorrectQuestions.length > 0) {
    prompt += `\nQuestions answered incorrectly:\n${incorrectQuestions.join('\n')}`
  }

  if (score === 100) {
    prompt += '\n\nThe student got a perfect score!'
  } else if (score >= 80) {
    prompt += '\n\nThe student performed very well.'
  } else if (score >= 60) {
    prompt += '\n\nThe student showed good effort but has room for improvement.'
  } else {
    prompt += '\n\nThe student struggled with this topic and may need additional practice.'
  }

  return prompt
}
