import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { Question } from '@/stores/questions'
import type { GradeLevel } from '@/stores/curriculum'

// ============================================
// TYPES
// ============================================

export interface ParsedQuestionImage {
  base64: string
  extension: string
  mimeType: string
}

export interface ParsedQuestion {
  row: number
  type: 'mcq' | 'short_answer'
  gradeLevelName: string
  subjectName: string
  topicName: string
  subTopicName: string
  question: string
  questionImage: ParsedQuestionImage | null
  optionA: string | null
  optionAImage: ParsedQuestionImage | null
  optionB: string | null
  optionBImage: ParsedQuestionImage | null
  optionC: string | null
  optionCImage: ParsedQuestionImage | null
  optionD: string | null
  optionDImage: ParsedQuestionImage | null
  correctAnswer: string
  explanation: string | null
}

export interface ParseError {
  row: number
  column: string
  message: string
}

export interface ParseResult {
  questions: ParsedQuestion[]
  errors: ParseError[]
}

// Column indices (1-based) for the Questions sheet
const COLUMNS = {
  TYPE: 1, // A
  GRADE_LEVEL: 2, // B
  SUBJECT: 3, // C
  TOPIC: 4, // D
  SUB_TOPIC: 5, // E
  QUESTION_TEXT: 6, // F
  QUESTION_IMAGE: 7, // G
  OPTION_A: 8, // H
  OPTION_A_IMAGE: 9, // I
  OPTION_B: 10, // J
  OPTION_B_IMAGE: 11, // K
  OPTION_C: 12, // L
  OPTION_C_IMAGE: 13, // M
  OPTION_D: 14, // N
  OPTION_D_IMAGE: 15, // O
  CORRECT_ANSWER: 16, // P
  EXPLANATION: 17, // Q
}

// ============================================
// TEMPLATE GENERATION
// ============================================

export async function generateQuestionTemplate(gradeLevels: GradeLevel[]): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Peak Mark'
  workbook.created = new Date()

  // 1. Create Questions worksheet
  const questionsSheet = workbook.addWorksheet('Questions')
  setupQuestionsSheet(questionsSheet, gradeLevels)

  // 2. Create hidden DropdownData worksheet for cascading dropdowns
  const dropdownDataSheet = workbook.addWorksheet('DropdownData')
  setupDropdownDataSheet(dropdownDataSheet, gradeLevels)

  // 3. Apply cascading data validations to Questions sheet
  applyCascadingValidations(questionsSheet, gradeLevels)

  // 4. Create Instructions worksheet
  const instructionsSheet = workbook.addWorksheet('Instructions')
  setupInstructionsSheet(instructionsSheet)

  // 5. Download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, 'question_upload_template.xlsx')
}

function setupQuestionsSheet(sheet: ExcelJS.Worksheet, gradeLevels: GradeLevel[]) {
  // Set column widths
  sheet.columns = [
    { header: 'Type*', key: 'type', width: 15 },
    { header: 'Grade Level*', key: 'gradeLevel', width: 15 },
    { header: 'Subject*', key: 'subject', width: 20 },
    { header: 'Topic*', key: 'topic', width: 25 },
    { header: 'Sub-Topic*', key: 'subTopic', width: 25 },
    { header: 'Question Text*', key: 'question', width: 40 },
    { header: 'Question Image', key: 'questionImage', width: 18 },
    { header: 'Option A', key: 'optionA', width: 25 },
    { header: 'Option A Image', key: 'optionAImage', width: 15 },
    { header: 'Option B', key: 'optionB', width: 25 },
    { header: 'Option B Image', key: 'optionBImage', width: 15 },
    { header: 'Option C', key: 'optionC', width: 25 },
    { header: 'Option C Image', key: 'optionCImage', width: 15 },
    { header: 'Option D', key: 'optionD', width: 25 },
    { header: 'Option D Image', key: 'optionDImage', width: 15 },
    { header: 'Correct Answer*', key: 'correctAnswer', width: 18 },
    { header: 'Explanation', key: 'explanation', width: 40 },
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 25

  // Note: Data validations are applied separately in applyCascadingValidations()

  // Add placeholder rows with proper height for images
  for (let i = 2; i <= 11; i++) {
    const row = sheet.getRow(i)
    row.height = 80

    // Add dashed borders to image columns as visual guides (G, I, K, M, O)
    const imageColumns = ['G', 'I', 'K', 'M', 'O']
    for (const col of imageColumns) {
      const cell = sheet.getCell(`${col}${i}`)
      cell.border = {
        top: { style: 'dashed', color: { argb: 'FFCCCCCC' } },
        left: { style: 'dashed', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'dashed', color: { argb: 'FFCCCCCC' } },
        right: { style: 'dashed', color: { argb: 'FFCCCCCC' } },
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9F9F9' },
      }
    }
  }

  // Freeze header row
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
}

// Helper function to sanitize names for Excel named ranges
function sanitizeName(name: string): string {
  // Replace spaces and special characters with underscores for named range compatibility
  // Keep Chinese characters, alphanumeric, and replace others with underscores
  return name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
}

// Helper function to get Excel column letter from column number (1-based)
function getColumnLetter(colNum: number): string {
  let letter = ''
  while (colNum > 0) {
    const mod = (colNum - 1) % 26
    letter = String.fromCharCode(65 + mod) + letter
    colNum = Math.floor((colNum - 1) / 26)
  }
  return letter
}

function setupDropdownDataSheet(sheet: ExcelJS.Worksheet, gradeLevels: GradeLevel[]) {
  // Column A: Grade Levels list
  // Columns B onwards: Subject lists per grade level (using grade name as header)
  // After subjects: Topic lists per subject (using subject name as header)
  // After topics: Sub-Topic lists per topic (using topic name as header)

  // Write grade levels in column A
  sheet.getCell('A1').value = 'GradeLevels'
  sheet.getCell('A1').font = { bold: true }
  gradeLevels.forEach((grade, index) => {
    sheet.getCell(`A${index + 2}`).value = grade.name
  })

  // Define named range for grade levels
  const gradeCount = gradeLevels.length
  if (gradeCount > 0) {
    sheet.workbook.definedNames.add(`'DropdownData'!$A$2:$A$${gradeCount + 1}`, 'GradeLevels')
  }

  let colIndex = 2 // Start from column B

  // For each grade level, create a column for its subjects
  for (const grade of gradeLevels) {
    const colLetter = getColumnLetter(colIndex)

    // Sanitize grade name for use as named range
    const gradeSafeName = sanitizeName(grade.name)

    // Header: Grade name (for reference)
    sheet.getCell(`${colLetter}1`).value = `Subjects_${grade.name}`
    sheet.getCell(`${colLetter}1`).font = { bold: true }

    // Write subjects
    grade.subjects.forEach((subject, idx) => {
      sheet.getCell(`${colLetter}${idx + 2}`).value = subject.name
    })

    // Define named range for this grade's subjects
    if (grade.subjects.length > 0) {
      const endRow = grade.subjects.length + 1
      // Named range: Grade_三年级 -> list of subjects
      sheet.workbook.definedNames.add(
        `'DropdownData'!$${colLetter}$2:$${colLetter}$${endRow}`,
        `Grade_${gradeSafeName}`,
      )
    }

    colIndex++
  }

  // For each subject, create a column for its topics
  for (const grade of gradeLevels) {
    for (const subject of grade.subjects) {
      const colLetter = getColumnLetter(colIndex)

      // Sanitize subject name
      const subjectSafeName = sanitizeName(subject.name)

      // Header: Subject name (for reference)
      sheet.getCell(`${colLetter}1`).value = `Topics_${subject.name}`
      sheet.getCell(`${colLetter}1`).font = { bold: true }

      // Write topics
      subject.topics.forEach((topic, idx) => {
        sheet.getCell(`${colLetter}${idx + 2}`).value = topic.name
      })

      // Define named range for this subject's topics
      if (subject.topics.length > 0) {
        const endRow = subject.topics.length + 1
        // Named range: Subject_数学 -> list of topics
        sheet.workbook.definedNames.add(
          `'DropdownData'!$${colLetter}$2:$${colLetter}$${endRow}`,
          `Subject_${subjectSafeName}`,
        )
      }

      colIndex++
    }
  }

  // For each topic, create a column for its sub-topics
  for (const grade of gradeLevels) {
    for (const subject of grade.subjects) {
      for (const topic of subject.topics) {
        const colLetter = getColumnLetter(colIndex)

        // Sanitize topic name
        const topicSafeName = sanitizeName(topic.name)

        // Header: Topic name (for reference)
        sheet.getCell(`${colLetter}1`).value = `SubTopics_${topic.name}`
        sheet.getCell(`${colLetter}1`).font = { bold: true }

        // Write sub-topics
        topic.subTopics.forEach((subTopic, idx) => {
          sheet.getCell(`${colLetter}${idx + 2}`).value = subTopic.name
        })

        // Define named range for this topic's sub-topics
        if (topic.subTopics.length > 0) {
          const endRow = topic.subTopics.length + 1
          // Named range: Topic_加法 -> list of sub-topics
          sheet.workbook.definedNames.add(
            `'DropdownData'!$${colLetter}$2:$${colLetter}$${endRow}`,
            `Topic_${topicSafeName}`,
          )
        }

        colIndex++
      }
    }
  }

  // Hide the data sheet
  sheet.state = 'hidden'
}

function applyCascadingValidations(sheet: ExcelJS.Worksheet, gradeLevels: GradeLevel[]) {
  const gradeNames = gradeLevels.map((g) => g.name).join(',')

  // Apply validations for rows 2-500
  for (let row = 2; row <= 500; row++) {
    // Column A: Type dropdown
    sheet.getCell(`A${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"mcq,short_answer"'],
      showErrorMessage: true,
      errorTitle: 'Invalid Type',
      error: 'Please select mcq or short_answer',
    }

    // Column B: Grade Level dropdown (static list)
    if (gradeNames) {
      sheet.getCell(`B${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`"${gradeNames}"`],
        showErrorMessage: true,
        errorTitle: 'Invalid Grade Level',
        error: 'Please select a valid grade level',
      }
    }

    // Column C: Subject dropdown (dependent on Grade Level in column B)
    // Uses INDIRECT to reference a named range based on column B value
    sheet.getCell(`C${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`INDIRECT("Grade_"&SUBSTITUTE(B${row}," ","_"))`],
      showErrorMessage: true,
      errorTitle: 'Invalid Subject',
      error: 'Please select a valid subject for the chosen grade level',
    }

    // Column D: Topic dropdown (dependent on Subject in column C)
    // Uses INDIRECT to reference a named range based on column C value
    sheet.getCell(`D${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`INDIRECT("Subject_"&SUBSTITUTE(C${row}," ","_"))`],
      showErrorMessage: true,
      errorTitle: 'Invalid Topic',
      error: 'Please select a valid topic for the chosen subject',
    }

    // Column E: Sub-Topic dropdown (dependent on Topic in column D)
    // Uses INDIRECT to reference a named range based on column D value
    sheet.getCell(`E${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`INDIRECT("Topic_"&SUBSTITUTE(D${row}," ","_"))`],
      showErrorMessage: true,
      errorTitle: 'Invalid Sub-Topic',
      error: 'Please select a valid sub-topic for the chosen topic',
    }

    // Column P: Correct Answer - no dropdown to allow free text input for short_answer questions
    // MCQ uses A/B/C/D, short_answer uses free text
  }
}

function setupInstructionsSheet(sheet: ExcelJS.Worksheet) {
  sheet.columns = [{ width: 100 }]

  const instructions = [
    ['QUESTION UPLOAD TEMPLATE - INSTRUCTIONS'],
    [''],
    ['HOW TO USE THIS TEMPLATE:'],
    ['1. Fill in your questions in the "Questions" sheet'],
    [
      '2. Use cascading dropdowns: Select Grade Level first, then Subject, then Topic, then Sub-Topic',
    ],
    ['3. Save the file and upload it to the system'],
    [''],
    ['CASCADING DROPDOWNS:'],
    ['This template uses cascading (dependent) dropdowns:'],
    ['  1. Select a Grade Level from the dropdown'],
    ['  2. The Subject dropdown will show only subjects for that grade'],
    ['  3. The Topic dropdown will show only topics for that subject'],
    ['  4. The Sub-Topic dropdown will show only sub-topics for that topic'],
    [
      '  Note: You must select Grade Level before Subject, Subject before Topic, and Topic before Sub-Topic',
    ],
    [''],
    ['COLUMN DESCRIPTIONS:'],
    [''],
    ['Type* (Required)'],
    ['  - mcq: Multiple choice question with options A, B, C, D'],
    ['  - short_answer: Question with a text answer'],
    [''],
    ['Grade Level* (Required)'],
    ['  - Select from the dropdown'],
    [''],
    ['Subject* (Required)'],
    ['  - Select from the dropdown (depends on Grade Level selection)'],
    ['  - Must select Grade Level first'],
    [''],
    ['Topic* (Required)'],
    ['  - Select from the dropdown (depends on Subject selection)'],
    ['  - Must select Subject first'],
    [''],
    ['Sub-Topic* (Required)'],
    ['  - Select from the dropdown (depends on Topic selection)'],
    ['  - Must select Topic first'],
    [''],
    ['Question Text* (Required)'],
    ['  - The question to be asked'],
    [''],
    ['Question Image (Optional)'],
    ['  - Paste or insert an image in this cell'],
    ['  - Supported formats: PNG, JPEG, GIF'],
    [''],
    ['Option A, B, C, D (Required for MCQ)'],
    ['  - Text for each option'],
    ['  - At least 2 options must be filled'],
    ['  - Options must be filled consecutively (A, then B, then C, then D)'],
    [''],
    ['Option A/B/C/D Image (Optional)'],
    ['  - Paste or insert an image for each option'],
    [''],
    ['Correct Answer* (Required)'],
    ['  - For MCQ: Select A, B, C, or D'],
    ['  - For short_answer: Type the correct answer text'],
    [''],
    ['Explanation (Optional)'],
    ['  - Explanation shown to students after answering incorrectly'],
    [''],
    ['TIPS:'],
    ['- Images should be small (recommended max 200x200 pixels)'],
    ['- To paste an image: Copy the image, then paste into the cell'],
    ['- To insert an image: Insert > Picture, then position in the cell'],
    ['- Maximum 500 questions per upload'],
    ['- This template works best in Microsoft Excel'],
  ]

  instructions.forEach((row, index) => {
    const excelRow = sheet.getRow(index + 1)
    excelRow.getCell(1).value = row[0] || ''

    // Style the title
    if (index === 0) {
      excelRow.font = { bold: true, size: 16 }
    }
    // Style section headers
    else if (row[0]?.endsWith(':') && !row[0]?.startsWith(' ')) {
      excelRow.font = { bold: true, size: 12 }
    }
  })
}

// ============================================
// EXPORT QUESTIONS
// ============================================

export async function exportQuestionsToExcel(
  questions: Question[],
  getImageAsBase64: (path: string) => Promise<string | null>,
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Peak Mark'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Questions')

  // Set column widths (same as template)
  sheet.columns = [
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Grade Level', key: 'gradeLevel', width: 15 },
    { header: 'Subject', key: 'subject', width: 20 },
    { header: 'Topic', key: 'topic', width: 25 },
    { header: 'Sub-Topic', key: 'subTopic', width: 25 },
    { header: 'Question Text', key: 'question', width: 40 },
    { header: 'Question Image', key: 'questionImage', width: 18 },
    { header: 'Option A', key: 'optionA', width: 25 },
    { header: 'Option A Image', key: 'optionAImage', width: 15 },
    { header: 'Option B', key: 'optionB', width: 25 },
    { header: 'Option B Image', key: 'optionBImage', width: 15 },
    { header: 'Option C', key: 'optionC', width: 25 },
    { header: 'Option C Image', key: 'optionCImage', width: 15 },
    { header: 'Option D', key: 'optionD', width: 25 },
    { header: 'Option D Image', key: 'optionDImage', width: 15 },
    { header: 'Correct Answer', key: 'correctAnswer', width: 18 },
    { header: 'Explanation', key: 'explanation', width: 40 },
  ]

  // Style header
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 25

  // Add data rows with images
  for (const [i, q] of questions.entries()) {
    const rowIndex = i + 2
    const row = sheet.getRow(rowIndex)
    row.height = 80

    // Text data
    row.getCell(COLUMNS.TYPE).value = q.type
    row.getCell(COLUMNS.GRADE_LEVEL).value = q.gradeLevelName
    row.getCell(COLUMNS.SUBJECT).value = q.subjectName
    row.getCell(COLUMNS.TOPIC).value = q.topicName
    row.getCell(COLUMNS.SUB_TOPIC).value = q.subTopicName
    row.getCell(COLUMNS.QUESTION_TEXT).value = q.question

    // Question image
    if (q.imagePath) {
      await addImageToCell(
        workbook,
        sheet,
        q.imagePath,
        COLUMNS.QUESTION_IMAGE - 1,
        rowIndex - 1,
        getImageAsBase64,
      )
    }

    // MCQ options
    if (q.type === 'mcq' && q.options) {
      const optionConfigs = [
        { textCol: COLUMNS.OPTION_A, imageCol: COLUMNS.OPTION_A_IMAGE, index: 0 },
        { textCol: COLUMNS.OPTION_B, imageCol: COLUMNS.OPTION_B_IMAGE, index: 1 },
        { textCol: COLUMNS.OPTION_C, imageCol: COLUMNS.OPTION_C_IMAGE, index: 2 },
        { textCol: COLUMNS.OPTION_D, imageCol: COLUMNS.OPTION_D_IMAGE, index: 3 },
      ]

      for (const config of optionConfigs) {
        const opt = q.options[config.index]
        if (opt) {
          row.getCell(config.textCol).value = opt.text || ''
          if (opt.imagePath) {
            await addImageToCell(
              workbook,
              sheet,
              opt.imagePath,
              config.imageCol - 1,
              rowIndex - 1,
              getImageAsBase64,
            )
          }
          if (opt.isCorrect) {
            row.getCell(COLUMNS.CORRECT_ANSWER).value = String.fromCharCode(65 + config.index) // A, B, C, D
          }
        }
      }
    } else {
      // Short answer
      row.getCell(COLUMNS.CORRECT_ANSWER).value = q.answer || ''
    }

    row.getCell(COLUMNS.EXPLANATION).value = q.explanation || ''
  }

  // Download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const timestamp = new Date().toISOString().slice(0, 10)
  saveAs(blob, `questions_export_${timestamp}.xlsx`)
}

async function addImageToCell(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  imagePath: string,
  col: number,
  row: number,
  getImageAsBase64: (path: string) => Promise<string | null>,
): Promise<void> {
  try {
    const base64 = await getImageAsBase64(imagePath)
    if (!base64) return

    const extension = getExtensionFromPath(imagePath)
    const imageId = workbook.addImage({
      base64: base64,
      extension: extension as 'png' | 'jpeg' | 'gif',
    })

    sheet.addImage(imageId, {
      tl: { col, row },
      ext: { width: 100, height: 70 },
    })
  } catch (error) {
    console.error(`Failed to add image ${imagePath}:`, error)
  }
}

function getExtensionFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || 'png'
  return ext === 'jpg' ? 'jpeg' : ext
}

// ============================================
// PARSE UPLOADED FILE
// ============================================

export async function parseQuestionExcel(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)

  // Find the Questions worksheet
  const worksheet = workbook.getWorksheet('Questions') || workbook.worksheets[0]
  if (!worksheet) {
    return {
      questions: [],
      errors: [{ row: 0, column: '', message: 'No worksheet found in the file' }],
    }
  }

  // Build image map by row and column position
  const imageMap = buildImageMap(workbook, worksheet)

  const questions: ParsedQuestion[] = []
  const errors: ParseError[] = []

  // Image column indices (0-based for image map)
  const imageColumns = {
    questionImage: COLUMNS.QUESTION_IMAGE - 1, // G = 6
    optionAImage: COLUMNS.OPTION_A_IMAGE - 1, // I = 8
    optionBImage: COLUMNS.OPTION_B_IMAGE - 1, // K = 10
    optionCImage: COLUMNS.OPTION_C_IMAGE - 1, // M = 12
    optionDImage: COLUMNS.OPTION_D_IMAGE - 1, // O = 14
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // Skip header

    const type = getCellValue(row.getCell(COLUMNS.TYPE))
    const gradeLevel = getCellValue(row.getCell(COLUMNS.GRADE_LEVEL))
    const subject = getCellValue(row.getCell(COLUMNS.SUBJECT))
    const topic = getCellValue(row.getCell(COLUMNS.TOPIC))
    const subTopic = getCellValue(row.getCell(COLUMNS.SUB_TOPIC))
    const questionText = getCellValue(row.getCell(COLUMNS.QUESTION_TEXT))
    const optionA = getCellValue(row.getCell(COLUMNS.OPTION_A)) || null
    const optionB = getCellValue(row.getCell(COLUMNS.OPTION_B)) || null
    const optionC = getCellValue(row.getCell(COLUMNS.OPTION_C)) || null
    const optionD = getCellValue(row.getCell(COLUMNS.OPTION_D)) || null
    const correctAnswer = getCellValue(row.getCell(COLUMNS.CORRECT_ANSWER))
    const explanation = getCellValue(row.getCell(COLUMNS.EXPLANATION)) || null

    // Skip empty rows
    if (!type && !gradeLevel && !subject && !topic && !subTopic && !questionText) return

    // Validate required fields
    const rowErrors: ParseError[] = []

    const normalizedType = type.toLowerCase()
    if (!normalizedType || !['mcq', 'short_answer'].includes(normalizedType)) {
      rowErrors.push({
        row: rowNumber,
        column: 'A',
        message: 'Type must be "mcq" or "short_answer"',
      })
    }
    if (!gradeLevel) {
      rowErrors.push({ row: rowNumber, column: 'B', message: 'Grade Level is required' })
    }
    if (!subject) {
      rowErrors.push({ row: rowNumber, column: 'C', message: 'Subject is required' })
    }
    if (!topic) {
      rowErrors.push({ row: rowNumber, column: 'D', message: 'Topic is required' })
    }
    if (!subTopic) {
      rowErrors.push({ row: rowNumber, column: 'E', message: 'Sub-Topic is required' })
    }
    if (!questionText) {
      rowErrors.push({ row: rowNumber, column: 'F', message: 'Question Text is required' })
    }
    if (!correctAnswer) {
      rowErrors.push({ row: rowNumber, column: 'P', message: 'Correct Answer is required' })
    }

    // MCQ-specific validation
    if (normalizedType === 'mcq') {
      const optionAFilled = !!(optionA || imageMap.get(`${rowNumber}-${imageColumns.optionAImage}`))
      const optionBFilled = !!(optionB || imageMap.get(`${rowNumber}-${imageColumns.optionBImage}`))
      const optionCFilled = !!(optionC || imageMap.get(`${rowNumber}-${imageColumns.optionCImage}`))
      const optionDFilled = !!(optionD || imageMap.get(`${rowNumber}-${imageColumns.optionDImage}`))

      const filledCount = [optionAFilled, optionBFilled, optionCFilled, optionDFilled].filter(
        Boolean,
      ).length

      if (filledCount < 2) {
        rowErrors.push({
          row: rowNumber,
          column: 'G-N',
          message: 'At least 2 options must be filled for MCQ',
        })
      }

      // Check consecutive filling
      const filled = [optionAFilled, optionBFilled, optionCFilled, optionDFilled]
      let foundEmpty = false
      for (let i = 0; i < filled.length; i++) {
        if (foundEmpty && filled[i]) {
          rowErrors.push({
            row: rowNumber,
            column: 'G-N',
            message: 'Options must be filled consecutively from Option A',
          })
          break
        }
        if (!filled[i]) foundEmpty = true
      }

      // Validate correct answer
      const upperAnswer = correctAnswer.toUpperCase()
      if (correctAnswer && !['A', 'B', 'C', 'D'].includes(upperAnswer)) {
        rowErrors.push({
          row: rowNumber,
          column: 'O',
          message: 'Correct Answer must be A, B, C, or D for MCQ',
        })
      }

      // Check correct answer references filled option
      const answerIndex = upperAnswer.charCodeAt(0) - 65
      if (answerIndex >= 0 && answerIndex < 4 && !filled[answerIndex]) {
        rowErrors.push({
          row: rowNumber,
          column: 'O',
          message: `Correct Answer "${correctAnswer}" references an empty option`,
        })
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
    } else {
      questions.push({
        row: rowNumber,
        type: normalizedType as 'mcq' | 'short_answer',
        gradeLevelName: gradeLevel,
        subjectName: subject,
        topicName: topic,
        subTopicName: subTopic,
        question: questionText,
        questionImage: imageMap.get(`${rowNumber}-${imageColumns.questionImage}`) || null,
        optionA,
        optionAImage: imageMap.get(`${rowNumber}-${imageColumns.optionAImage}`) || null,
        optionB,
        optionBImage: imageMap.get(`${rowNumber}-${imageColumns.optionBImage}`) || null,
        optionC,
        optionCImage: imageMap.get(`${rowNumber}-${imageColumns.optionCImage}`) || null,
        optionD,
        optionDImage: imageMap.get(`${rowNumber}-${imageColumns.optionDImage}`) || null,
        correctAnswer: normalizedType === 'mcq' ? correctAnswer.toUpperCase() : correctAnswer,
        explanation,
      })
    }
  })

  return { questions, errors }
}

function getCellValue(cell: ExcelJS.Cell): string {
  const value = cell.value
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'text' in value) {
    // Rich text
    return String(value.text || '').trim()
  }
  if (typeof value === 'object' && 'result' in value) {
    // Formula
    return String(value.result || '').trim()
  }
  return String(value).trim()
}

function buildImageMap(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
): Map<string, ParsedQuestionImage> {
  const imageMap = new Map<string, ParsedQuestionImage>()

  try {
    const images = worksheet.getImages()

    for (const image of images) {
      const imageData = workbook.getImage(Number(image.imageId))
      if (!imageData || !imageData.buffer) continue

      // Get position from image range
      let row: number | undefined
      let col: number | undefined

      if (image.range && typeof image.range === 'object' && 'tl' in image.range) {
        const tl = image.range.tl as {
          row?: number
          col?: number
          nativeRow?: number
          nativeCol?: number
        }
        row = Math.floor(tl.nativeRow ?? tl.row ?? 0) + 1 // Convert to 1-based
        col = Math.floor(tl.nativeCol ?? tl.col ?? 0)
      }

      if (row && col !== undefined) {
        const base64 = arrayBufferToBase64(imageData.buffer as ArrayBuffer)
        const extension = (imageData.extension as string) || 'png'
        const mimeType = getMimeType(extension)

        imageMap.set(`${row}-${col}`, {
          base64,
          extension,
          mimeType,
        })
      }
    }
  } catch (error) {
    console.error('Error building image map:', error)
  }

  return imageMap
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function getMimeType(extension: string): string {
  const map: Record<string, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    gif: 'image/gif',
  }
  return map[extension.toLowerCase()] || 'image/png'
}
