const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/g,
  /nvapi-[A-Za-z0-9]{20,}/g,
  /ghp_[A-Za-z0-9]{36}/g,
  /github_pat_[A-Za-z0-9_]{80,}/g,
  /AKIA[A-Z0-9]{16}/g,
  /(?:KEY|TOKEN|SECRET|PASSWORD|API_KEY|APIKEY)\s*[:=]\s*["']?[^\s"']{8,}["']?/gi,
  /(?:key|token|secret|password|api_key|apikey)\s*[:=]\s*["']?[^\s"']{8,}["']?/gi,
]

export function scrubSecrets(text: string): string {
  let result = text
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED_SECRET]")
  }
  return result
}
