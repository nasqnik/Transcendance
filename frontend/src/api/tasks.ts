import client from './client'
import { type Task, type Completion } from '../constants/categories'

export async function getTasks(): Promise<Task[]> {
  const res = await client.get('/task/tasks/')
  return res.data
}

export async function getCompletions(): Promise<Completion[]> {
  const res = await client.get('/task/completions/')
  return res.data
}

export async function postCompletion(taskId: string): Promise<Completion> {
  const res = await client.post('/task/completions/', { task: taskId })
  return res.data
}

export interface CategorySettings {
  show_health: boolean
  show_learning: boolean
  show_responsibility: boolean
  show_creativity: boolean
}

export async function getCategorySettings(): Promise<CategorySettings> {
  const res = await client.get('/task/settings/categories/')
  return res.data
}

export async function updateCategorySettings(data: CategorySettings): Promise<CategorySettings> {
  const res = await client.put('/task/settings/categories/', data)
  return res.data
}

export interface CreateTaskInput {
  title: string
  description: string
  due_date: string | null
}

export async function createTask(data: CreateTaskInput): Promise<Task> {
  const res = await client.post('/task/tasks/', data)
  return res.data
}
