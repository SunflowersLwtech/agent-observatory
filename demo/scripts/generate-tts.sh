#!/usr/bin/env zsh
# ============================================================================
# Agent Observatory — TTS Narration Generator
#
# Generates professional English voiceover using Gemini 2.5 Flash TTS
# with the "Charon" voice (informative, authoritative).
#
# Usage: ./demo/scripts/generate-tts.sh
# ============================================================================

set -euo pipefail

GEMINI_API_KEY="${GEMINI_API_KEY:?Set GEMINI_API_KEY env var}"
MODEL="gemini-2.5-flash-preview-tts"
VOICE="Charon"
SCRIPT_DIR="${0:A:h}"
OUTPUT_DIR="${SCRIPT_DIR}/../output/tts"

mkdir -p "$OUTPUT_DIR"

echo "=== Agent Observatory TTS Generator ==="
echo "Model: $MODEL | Voice: $VOICE"
echo "Output: $OUTPUT_DIR"
echo ""

generate_tts() {
  local key="$1"
  local text="$2"
  local outfile="${OUTPUT_DIR}/${key}.wav"

  if [ -f "$outfile" ]; then
    echo "[SKIP] $key — already exists"
    return
  fi

  echo "[GEN]  $key — ${#text} chars"

  # Escape text for JSON (handle quotes and newlines)
  local escaped_text
  escaped_text=$(echo "$text" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip())[1:-1])")

  local response
  response=$(curl -s -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
  \"contents\": [{\"parts\": [{\"text\": \"${escaped_text}\"}]}],
  \"generationConfig\": {
    \"responseModalities\": [\"AUDIO\"],
    \"speechConfig\": {
      \"voiceConfig\": {
        \"prebuiltVoiceConfig\": {
          \"voiceName\": \"${VOICE}\"
        }
      }
    }
  }
}")

  local pcm_file="${outfile%.wav}.pcm"

  echo "$response" | python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
candidates = data.get('candidates', [])
if not candidates:
    err = data.get('error', {}).get('message', 'Unknown error')
    print(f'  [ERROR] {err}', file=sys.stderr)
    sys.exit(1)
parts = candidates[0].get('content', {}).get('parts', [])
for part in parts:
    if 'inlineData' in part:
        audio_b64 = part['inlineData']['data']
        audio_bytes = base64.b64decode(audio_b64)
        with open('$pcm_file', 'wb') as f:
            f.write(audio_bytes)
        print(f'  -> Raw PCM: {len(audio_bytes):,} bytes')
        break
else:
    print('  [ERROR] No audio data in response', file=sys.stderr)
    sys.exit(1)
"

  # Convert raw PCM (16-bit, 24kHz, mono) to proper WAV
  ffmpeg -y -f s16le -ar 24000 -ac 1 -i "$pcm_file" "$outfile" 2>/dev/null
  rm -f "$pcm_file"
  echo "  -> WAV: $(ls -lh "$outfile" | awk '{print $5}')"

  sleep 2
}

# ---- Narration segments ----

generate_tts "01-hook" \
  "At RSAC 2026, five major vendors shipped agent identity frameworks. None of them answered a simple question: what does the agent do after it authenticates? Agent Observatory fills that gap."

generate_tts "02-problem" \
  "Today's AI agents use OAuth to access your calendar, code, and messages. Authentication tells you who the agent is. But it says nothing about what the agent does with those credentials. The OWASP Top 10 for Agentic Applications catalogs ten risks that emerge in exactly this post-authentication blind spot."

generate_tts "03-solution" \
  "Agent Observatory makes every post-authentication action observable, auditable, and controllable, using Auth0's existing identity primitives. Three authorization patterns. Full OWASP coverage. Real-time behavioral monitoring."

generate_tts "04-demo-chat" \
  "Here's the agent in action. I ask it to check my calendar. It explains the scopes it needs, calls the Google Calendar API through Token Vault, and returns my availability. Every step, the token exchange, the scope verification, the risk classification, is logged in real time. Now I ask about my GitHub repos. Same flow: FGA authorization check, token retrieval, risk assessment, full audit trail."

generate_tts "05-demo-stepup" \
  "Now watch what happens with a write operation. I ask the agent to send a Slack message. The system classifies this as high-risk. OWASP ASI 09, Human-Agent Trust Exploitation. A server-side circuit breaker blocks execution. The agent must call the step-up authorization tool, present the risk to me, and wait for my explicit confirmation. This is Pattern 3: Interrupt as Circuit Breaker. And it's enforced server-side. Even a jailbroken prompt cannot bypass it."

generate_tts "06-demo-observatory" \
  "The Observatory Dashboard shows everything. Real-time event stream. Risk distribution by service. OWASP coverage map showing which of the ten agentic risks have been detected and mitigated. Credential-event correlation: for every token exchange, you see exactly which tool consumed it and what happened. The anomaly detection engine monitors four behavioral signals, velocity, cross-service escalation, scope escalation, and error bursts, producing a real-time security score."

generate_tts "07-demo-debugger" \
  "The Token Vault Debugger addresses the number one developer pain point. Token Vault setup is a ten-step process with a single uninformative error. Our debugger shows per-connection health scores, configuration checklists, and references to known issues. The developer experience Token Vault needs."

generate_tts "08-demo-scope" \
  "Scope-level access control lets you toggle individual OAuth scopes per service. Deny chat write for Slack, and the agent physically cannot send messages. Enforced by the FGA authorization model before the tool even executes."

generate_tts "09-tech-stack" \
  "Built with Next.js 16, Vercel AI SDK version 6, Auth0 Token Vault with RFC 8693 token exchange, and an in-memory FGA authorization model ready for production deployment."

generate_tts "10-closing" \
  "Agent Observatory. Because authentication is just the beginning. The real question is: what happens next? We built the answer. Thank you."

echo ""
echo "=== TTS generation complete ==="
ls -lh "$OUTPUT_DIR/"
