import { auth } from '@/auth'
import { Database } from '@/lib/db_types'
import uploadToCloudinary from '@/lib/uploadToCloudinary'
import { nanoid } from '@/lib/utils'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const MODAL_API =
  process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:8000/execute'
    : process.env.MODAL_API_ENDPOINT!

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const { pythonCode, sqlCode, messages } = await req.json()
  const supabase = createRouteHandlerClient<Database>({ cookies })
  const userId = (await auth())?.user.id

  const response = await fetch(MODAL_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MODAL_AUTH_TOKEN}`
    },
    body: JSON.stringify({ script: pythonCode, sql: sqlCode })
  })

  if (!response.ok) throw new Error('Response Error')

  const imageData = await response.blob()

  const imageUrl = await uploadToCloudinary(imageData)

  if (!imageUrl) {
    return NextResponse.json({ error: 'Upload Error' })
  }

  const title = 'Modal cloudinary'
  const id = messages[0].id ?? nanoid()
  const createdAt = Date.now()
  const path = `/chat/${id}`
  const payload = {
    id,
    title,
    userId,
    createdAt,
    path,
    messages: [
      ...messages,
      {
        content: imageUrl,
        role: 'assistant'
      }
    ]
  }

  await supabase.from('chats').upsert({ id, payload }).throwOnError()

  return NextResponse.json({ imageUrl })
}
