export type AnswerType = 'text' | 'number' | 'boolean' | 'choice'

export interface QuestionnaireItem {
  id: string
  returnId: string
  sectionId: string
  question: string
  answerType: AnswerType
  answer: string | number | boolean | null
  required: boolean
  linkedDocumentId?: string
}
