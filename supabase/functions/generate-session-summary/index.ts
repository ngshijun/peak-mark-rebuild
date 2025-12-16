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
  type: 'mcq' | 'mrq' | 'short_answer'
  isCorrect: boolean
  studentAnswer: string | null
  correctAnswer: string | null
  questionImageUrl: string | null
  questionImageBase64: string | null
  options: {
    label: string
    text: string | null
    imageUrl: string | null
    imageBase64: string | null
    isCorrect: boolean
    isStudentAnswer: boolean
  }[]
}

/**
 * Fetch an image and convert it to base64 data URI
 * Returns null if fetch fails (with timeout protection)
 */
async function fetchImageAsBase64(url: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(`Failed to fetch image: ${url} - Status: ${response.status}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    // Determine content type from response or URL
    const contentType = response.headers.get('content-type') || 'image/png'
    const imageType = contentType.split('/')[1]?.split(';')[0] || 'png'

    return `data:image/${imageType};base64,${base64}`
  } catch (error) {
    console.warn(`Error fetching image: ${url}`, error)
    return null
  }
}

interface SessionData {
  gradeLevelName: string
  subjectName: string
  topicName: string
  subTopicName: string
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

    // Fetch session with sub_topic chain (sub_topics -> topics -> subjects -> grade_levels)
    // Note: topic_id column now references sub_topics table
    const { data: session, error: sessionError } = await supabase
      .from('practice_sessions')
      .select(`
        id,
        student_id,
        total_questions,
        correct_count,
        total_time_seconds,
        ai_summary,
        sub_topics (
          name,
          topics (
            name,
            subjects (
              name,
              grade_levels (
                name
              )
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
        selected_options,
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
      // selected_options is now an array of numbers (1-4)
      const selectedOptions: number[] = a.selected_options || []

      if (q.type === 'mcq' || q.type === 'mrq') {
        // Build options array
        const optionLabels = ['A', 'B', 'C', 'D']
        const optionData = [
          { text: q.option_1_text, imagePath: q.option_1_image_path, isCorrect: q.option_1_is_correct },
          { text: q.option_2_text, imagePath: q.option_2_image_path, isCorrect: q.option_2_is_correct },
          { text: q.option_3_text, imagePath: q.option_3_image_path, isCorrect: q.option_3_is_correct },
          { text: q.option_4_text, imagePath: q.option_4_image_path, isCorrect: q.option_4_is_correct },
        ]

        const studentAnswers: string[] = []
        const correctAnswers: string[] = []

        optionData.forEach((opt, index) => {
          if (opt.text || opt.imagePath) {
            const label = optionLabels[index]
            const isStudentAnswer = selectedOptions.includes(index + 1)
            options.push({
              label,
              text: opt.text,
              imageUrl: getImagePublicUrl(opt.imagePath),
              imageBase64: null, // Will be populated later for incorrect questions
              isCorrect: opt.isCorrect ?? false,
              isStudentAnswer,
            })
            if (opt.isCorrect) correctAnswers.push(label)
            if (isStudentAnswer) studentAnswers.push(label)
          }
        })

        // For MCQ: single answer, for MRQ: comma-separated
        studentAnswer = studentAnswers.length > 0 ? studentAnswers.join(', ') : null
        correctAnswer = correctAnswers.length > 0 ? correctAnswers.join(', ') : null
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
        questionImageBase64: null, // Will be populated later for incorrect questions
        options,
      }
    })

    // Pre-fetch images as base64 for incorrect questions only (to reduce API calls)
    // This avoids OpenAI's timeout issues when fetching from URLs
    const incorrectQuestions = questionsData.filter((q) => !q.isCorrect)
    const imagePromises: Promise<void>[] = []

    for (const q of incorrectQuestions) {
      // Fetch question image
      if (q.questionImageUrl) {
        imagePromises.push(
          fetchImageAsBase64(q.questionImageUrl).then((base64) => {
            q.questionImageBase64 = base64
          })
        )
      }

      // Fetch option images
      for (const opt of q.options) {
        if (opt.imageUrl) {
          imagePromises.push(
            fetchImageAsBase64(opt.imageUrl).then((base64) => {
              opt.imageBase64 = base64
            })
          )
        }
      }
    }

    // Wait for all image fetches to complete (with individual timeouts)
    await Promise.all(imagePromises)

    // Extract names from nested sub_topic structure
    // New hierarchy: sub_topics -> topics -> subjects -> grade_levels
    const subTopic = session.sub_topics as any
    const subTopicName = subTopic?.name || 'Unknown'
    const topicName = subTopic?.topics?.name || 'Unknown'
    const subjectName = subTopic?.topics?.subjects?.name || 'Unknown'
    const gradeLevelName = subTopic?.topics?.subjects?.grade_levels?.name || 'Unknown'

    // Build the messages for OpenAI
    const messages = buildMessages({
      gradeLevelName,
      subjectName,
      topicName,
      subTopicName,
      totalQuestions: session.total_questions,
      correctCount: session.correct_count || 0,
      totalTimeSeconds: session.total_time_seconds || 0,
      questions: questionsData,
    })

    // Call OpenAI API directly using fetch
    // Note: gpt-5-nano uses max_completion_tokens (not max_tokens)
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        // gpt-4o-mini is better for summarization (no reasoning token overhead)
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 300,
      }),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text()
      console.error('OpenAI API error:', errorData)
      return new Response(`OpenAI API error: ${errorData}`, { status: 500, headers: corsHeaders })
    }

    const completion = await openaiResponse.json()
    console.log('OpenAI response:', JSON.stringify(completion, null, 2))

    // Handle both Chat Completions and Responses API formats
    const summary =
      completion.choices?.[0]?.message?.content?.trim() ||
      completion.output?.[0]?.content?.[0]?.text?.trim() ||
      null

    if (!summary) {
      console.error('No summary content found in response:', JSON.stringify(completion))
      return new Response(
        JSON.stringify({ error: 'Failed to generate summary', response: completion }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
- Sub-Topic: ${data.subTopicName}
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

      // Add question image if exists (prefer base64, fallback to URL)
      // Using base64 avoids OpenAI's timeout issues when fetching URLs
      if (q.questionImageBase64) {
        userContent.push({
          type: 'image_url',
          image_url: { url: q.questionImageBase64 },
        })
      } else if (q.questionImageUrl) {
        // Fallback to URL if base64 fetch failed (OpenAI may still timeout)
        userContent.push({
          type: 'image_url',
          image_url: { url: q.questionImageUrl },
        })
      }

      // Add option images for MCQ/MRQ (only for options that have images)
      if ((q.type === 'mcq' || q.type === 'mrq') && q.options.length > 0) {
        const optionsWithImages = q.options.filter((opt) => opt.imageUrl || opt.imageBase64)
        if (optionsWithImages.length > 0) {
          userContent.push({ type: 'text', text: '   Options:' })
          optionsWithImages.forEach((opt) => {
            const marker = opt.isCorrect ? '(correct)' : opt.isStudentAnswer ? '(student chose)' : ''
            userContent.push({ type: 'text', text: `   ${opt.label}${marker}:` })
            // Prefer base64 over URL to avoid timeout issues
            if (opt.imageBase64) {
              userContent.push({
                type: 'image_url',
                image_url: { url: opt.imageBase64 },
              })
            } else if (opt.imageUrl) {
              userContent.push({
                type: 'image_url',
                image_url: { url: opt.imageUrl },
              })
            }
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
