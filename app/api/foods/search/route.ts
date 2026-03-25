import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const q = searchParams.get('q') || ''

  if (!q.trim()) {
    return Response.json({ results: [] })
  }

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-api-key-here') {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Look up the calorie information for this food: "${q}"

Return ONLY a JSON array (no explanation, no markdown) with 1-4 common variations/serving sizes.
Each item must have these exact fields:
- name: string (food name in English, be specific)
- servingUnit: string (one of: g, ml, piece, cup, bowl, tbsp, serving, slice)
- servingAmount: number (typical serving size)
- kcalPerServing: number (calories for that serving)

Example format:
[{"name":"White Rice (cooked)","servingUnit":"g","servingAmount":100,"kcalPerServing":130}]

If you don't know the exact calories, give a reasonable estimate. Always return valid JSON array.`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) {
      return Response.json({ results: [] })
    }

    const results = JSON.parse(match[0]) as Array<{
      name: string
      servingUnit: string
      servingAmount: number
      kcalPerServing: number
    }>

    // Validate structure
    const valid = results.filter(
      (r) =>
        typeof r.name === 'string' &&
        typeof r.servingUnit === 'string' &&
        typeof r.servingAmount === 'number' &&
        typeof r.kcalPerServing === 'number'
    )

    return Response.json({ results: valid })
  } catch (error) {
    console.error('Food search error:', error)
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }
}
