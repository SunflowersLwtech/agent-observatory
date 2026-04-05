#!/usr/bin/env zsh
# ============================================================================
# Agent Observatory — Video Clip Generator (Veo 3.1)
#
# Generates intro/transition video clips with consistent cybersecurity aesthetic.
# Uses image-to-video when Playwright screenshots are available.
#
# Usage: ./demo/scripts/generate-video.sh
# Requires: GEMINI_API_KEY environment variable
# ============================================================================

set -euo pipefail

GEMINI_API_KEY="${GEMINI_API_KEY:-REDACTED_GEMINI_API_KEY}"
MODEL="veo-3.1-generate-preview"
SCRIPT_DIR="${0:A:h}"
OUTPUT_DIR="${SCRIPT_DIR}/../output"
RECORDINGS_DIR="${SCRIPT_DIR}/../recordings"

mkdir -p "$OUTPUT_DIR/video"

echo "=== Agent Observatory Video Generator (Veo 3.1) ==="
echo "Model: $MODEL"
echo "Output: $OUTPUT_DIR/video"
echo ""

# Style consistency prompt prefix
STYLE_PREFIX="Cinematic tech demo style, dark navy blue background with glowing teal and cyan accents, holographic UI elements floating in space, professional cybersecurity aesthetic, clean modern design, subtle particle effects, 4K quality."

# ---------------------------------------------------------------------------
# Helper: Submit Veo generation and poll for completion
# ---------------------------------------------------------------------------
generate_video() {
  local name="$1"
  local prompt="$2"
  local duration="${3:-6}"
  local resolution="${4:-720p}"
  local image_path="${5:-}"

  local outfile="$OUTPUT_DIR/video/${name}.mp4"
  if [ -f "$outfile" ]; then
    echo "[SKIP] $name — already exists"
    return
  fi

  echo "[GEN]  $name — submitting to Veo 3.1..."

  # Build request body
  local instances
  if [ -n "$image_path" ] && [ -f "$image_path" ]; then
    # Image-to-video: animate a Playwright screenshot
    local b64_image
    b64_image=$(base64 < "$image_path" | tr -d '\n')
    instances=$(cat <<ENDJSON
[{
  "prompt": "$prompt",
  "image": {
    "inlineData": {
      "mimeType": "image/png",
      "data": "$b64_image"
    }
  }
}]
ENDJSON
)
  else
    # Text-to-video
    instances=$(cat <<ENDJSON
[{"prompt": "$prompt"}]
ENDJSON
)
  fi

  local body
  body=$(cat <<ENDJSON
{
  "instances": $instances,
  "parameters": {
    "aspectRatio": "16:9",
    "durationSeconds": $duration,
    "resolution": "$resolution"
  }
}
ENDJSON
)

  # Step 1: Submit
  local submit_response
  submit_response=$(curl -s -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predictLongRunning?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$body")

  local op_name
  op_name=$(echo "$submit_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null)

  if [ -z "$op_name" ]; then
    echo "  [ERROR] Failed to submit: $(echo "$submit_response" | head -c 200)"
    return 1
  fi

  echo "  Operation: $op_name"

  # Step 2: Poll until done (max 5 minutes)
  local max_polls=30
  for i in $(seq 1 $max_polls); do
    sleep 10
    local status_response
    status_response=$(curl -s \
      "https://generativelanguage.googleapis.com/v1beta/${op_name}?key=${GEMINI_API_KEY}")

    local done
    done=$(echo "$status_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('done', False))" 2>/dev/null)

    if [ "$done" = "True" ]; then
      # Step 3: Download
      local video_uri
      video_uri=$(echo "$status_response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
resp = data.get('response', {})
gvr = resp.get('generateVideoResponse', {})
samples = gvr.get('generatedSamples', [])
if samples:
    print(samples[0].get('video', {}).get('uri', ''))
" 2>/dev/null)

      if [ -n "$video_uri" ]; then
        curl -s -L -o "$outfile" \
          -H "x-goog-api-key: ${GEMINI_API_KEY}" \
          "$video_uri"
        local size
        size=$(ls -lh "$outfile" | awk '{print $5}')
        echo "  [DONE] $name — $size"
        return 0
      else
        echo "  [ERROR] No video URI in response"
        return 1
      fi
    fi
    echo "  Polling... ($i/$max_polls)"
  done

  echo "  [TIMEOUT] $name — generation took too long"
  return 1
}

# ---------------------------------------------------------------------------
# Scene prompts with consistent visual identity
# ---------------------------------------------------------------------------

echo "--- Generating intro/transition clips ---"
echo ""

# Scene 1: Title card
generate_video "01-title" \
  "${STYLE_PREFIX} A sleek title card emerges from darkness: 'Agent Observatory' in glowing teal text with a subtle shield icon. Holographic data streams flow in the background. The text pulses gently with light." \
  6

# Scene 2: Problem statement
generate_video "02-problem" \
  "${STYLE_PREFIX} A glowing padlock unlocks, transitioning to a dark void with question marks floating. OAuth token icons flow through a pipeline that ends in darkness — representing the post-authentication blind spot. Text fades in: 'What happens after authentication?'" \
  6

# Scene 3: Solution architecture
generate_video "03-architecture" \
  "${STYLE_PREFIX} A holographic network diagram materializes showing interconnected nodes: Auth0 shield, Google Calendar, GitHub octocat, and Slack icons. Glowing teal lines connect them through a central 'Observatory' hub. Data packets flow along the lines with risk-level color coding: green, yellow, red." \
  8

# Scene 4: OWASP shield
generate_video "04-owasp" \
  "${STYLE_PREFIX} A cybersecurity shield with 'OWASP' text rotates slowly, surrounded by ten orbiting icons representing ASI01 through ASI10. Each icon lights up as it passes the front. The shield pulses with a protective aura." \
  6

# Scene 5: Circuit breaker
generate_video "05-circuit-breaker" \
  "${STYLE_PREFIX} A glowing red 'STOP' barrier drops across a data pipeline. A warning icon pulses. Then a green 'CONFIRMED' badge appears and the barrier lifts, allowing data to flow through safely. Represents the interrupt-as-circuit-breaker pattern." \
  6

# Scene 6: Tech stack
generate_video "06-tech-stack" \
  "${STYLE_PREFIX} Technology logos materialize one by one in a row: Next.js, Vercel, Auth0, OpenAI — each with a subtle glow. Below them, text reads 'Built for the future of agentic security'. The logos connect with thin teal lines." \
  6

# Scene 7: Closing
generate_video "07-closing" \
  "${STYLE_PREFIX} The Agent Observatory logo — a stylized telescope looking at data streams — rotates slowly on a dark background. Text appears: 'Authentication is just the beginning.' The observatory beam sweeps across, revealing hidden data patterns." \
  8

# ---------------------------------------------------------------------------
# Image-to-video: Animate Playwright screenshots (if available)
# ---------------------------------------------------------------------------

echo ""
echo "--- Generating image-to-video clips from screenshots ---"
echo ""

# Animate dashboard screenshots if they exist
if [ -f "$RECORDINGS_DIR/10-observatory-overview.png" ]; then
  generate_video "08-observatory-animated" \
    "Camera slowly zooms into a cybersecurity dashboard, data points update in real-time, charts animate smoothly, glowing teal accents pulse gently" \
    8 "720p" "$RECORDINGS_DIR/10-observatory-overview.png"
fi

if [ -f "$RECORDINGS_DIR/14-debugger-overview.png" ]; then
  generate_video "09-debugger-animated" \
    "Camera slowly pans across a developer debugging dashboard, health score gauges animate, connection status indicators pulse, smooth professional movement" \
    6 "720p" "$RECORDINGS_DIR/14-debugger-overview.png"
fi

if [ -f "$RECORDINGS_DIR/05-chat-calendar-response.png" ]; then
  generate_video "10-chat-animated" \
    "An AI chat interface with messages appearing, typing indicators, tool call badges flashing briefly, professional tech demo interaction" \
    6 "720p" "$RECORDINGS_DIR/05-chat-calendar-response.png"
fi

echo ""
echo "=== Video generation complete ==="
echo "Files in: $OUTPUT_DIR/video/"
ls -lh "$OUTPUT_DIR/video/" 2>/dev/null || echo "(no files yet — check for errors above)"
