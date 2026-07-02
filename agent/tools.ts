import OpenAI from "openai"
import { getDefaultClient, FREE_MODELS, type FreeModelId } from "./model.config.js"

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface ToolResult {
  tool_call_id: string
  output: string
}

const AVAILABLE_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_docs",
      description: "Search documentation for relevant content",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  },
]

function executeTool(name: string, args: string): string {
  const params = JSON.parse(args)
  if (name === "get_weather") {
    return `Weather in ${params.location}: 72°F, sunny`
  }
  if (name === "search_docs") {
    return `Found 3 docs for "${params.query}"`
  }
  return "Unknown tool"
}

export async function runAgent(
  prompt: string,
  modelId: FreeModelId = "minimaxai/minimax-m3"
): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: "You are a helpful assistant. Use tools when needed." },
    { role: "user", content: prompt },
  ]

  const response = await getDefaultClient().chat.completions.create({
    model: modelId,
    messages,
    tools: AVAILABLE_TOOLS,
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 1024,
  })

  const choice = response.choices[0]
  if (choice.finish_reason !== "tool_calls" || !choice.message.tool_calls) {
    return choice.message.content ?? ""
  }

  for (const toolCall of choice.message.tool_calls) {
    messages.push(choice.message)
    const result = executeTool(toolCall.function.name, toolCall.function.arguments)
    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: result,
    })
  }

  const finalResponse = await getDefaultClient().chat.completions.create({
    model: modelId,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  })

  return finalResponse.choices[0].message.content ?? ""
}
