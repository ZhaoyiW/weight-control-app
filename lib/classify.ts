import Anthropic from '@anthropic-ai/sdk'

const CATEGORIES = ['Carbs', 'Protein', 'Fat', 'Vegetables', 'Fruits', 'Dairy', 'Drinks', 'Snacks', 'Processed', 'Condiments', 'Other']

// Classify a batch of food names in one API call. Returns map of name → category.
export async function classifyFoods(names: string[]): Promise<Record<string, string>> {
  if (!names.length) return {}

  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Classify each food into exactly one category from this list: ${CATEGORIES.join(', ')}

Foods to classify:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Return ONLY a JSON object mapping each food name to its category, no explanation:
{"food name": "category", ...}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  console.log('classify response text:', text)
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return {}

  const raw = JSON.parse(match[0]) as Record<string, string>

  // Validate — only keep valid categories
  const result: Record<string, string> = {}
  for (const [name, cat] of Object.entries(raw)) {
    if (CATEGORIES.includes(cat)) result[name] = cat
  }
  return result
}

// Classify a single food name
export async function classifyFood(name: string): Promise<string | null> {
  const result = await classifyFoods([name])
  return result[name] ?? null
}
