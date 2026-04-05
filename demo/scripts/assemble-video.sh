#!/usr/bin/env zsh
# ============================================================================
# Agent Observatory — Final Demo Video Assembler
#
# Combines Veo clips, Playwright recordings, and TTS narration into a single
# polished demo video with English subtitles.
#
# Usage: ./demo/scripts/assemble-video.sh
# Requires: ffmpeg
# ============================================================================

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
OUTPUT_DIR="${SCRIPT_DIR}/../output"
RECORDINGS_DIR="${SCRIPT_DIR}/../recordings"
FINAL="$OUTPUT_DIR/agent-observatory-demo.mp4"
SUBTITLES="$OUTPUT_DIR/subtitles.srt"

mkdir -p "$OUTPUT_DIR/segments"

echo "=== Agent Observatory Demo Assembler ==="
echo ""

# ---------------------------------------------------------------------------
# Step 1: Generate SRT subtitles
# ---------------------------------------------------------------------------

cat > "$SUBTITLES" << 'SUBTITLES_EOF'
1
00:00:00,000 --> 00:00:15,000
What happens AFTER your agent authenticates?
Agent Observatory fills that gap.

2
00:00:15,000 --> 00:00:35,000
OAuth grants access. Nothing tracks what happens next.
The OWASP Top 10 for Agentic Applications catalogs ten risks
in this post-authentication blind spot.

3
00:00:35,000 --> 00:00:50,000
Observable. Auditable. Controllable.
Three authorization patterns. Full OWASP coverage.

4
00:00:50,000 --> 00:01:20,000
Every tool call: scoped, classified, logged.
Token exchange → Scope verification → Risk classification
All in real time.

5
00:01:20,000 --> 00:01:45,000
Pattern 3: Interrupt-as-Circuit-Breaker
Server-side enforced — even jailbroken prompts cannot bypass it.
OWASP ASI09: Human-Agent Trust Exploitation

6
00:01:45,000 --> 00:02:10,000
Credential-Event Correlation + Anomaly Detection
Four behavioral signals: velocity, cross-service escalation,
scope escalation, error bursts

7
00:02:10,000 --> 00:02:25,000
Token Vault Debugger
The developer experience Token Vault needs.

8
00:02:25,000 --> 00:02:35,000
Granular scope control via FGA authorization
Toggle individual OAuth scopes per service.

9
00:02:35,000 --> 00:02:45,000
Next.js 16 + AI SDK v6 + Auth0 Token Vault + FGA

10
00:02:45,000 --> 00:03:00,000
Authentication is just the beginning.
Agent Observatory — We built the answer.
SUBTITLES_EOF

echo "[OK] Subtitles generated: $SUBTITLES"

# ---------------------------------------------------------------------------
# Step 2: Combine TTS audio with video clips per segment
# ---------------------------------------------------------------------------

combine_segment() {
  local idx="$1"
  local video_file="$2"
  local audio_file="$3"
  local out="$OUTPUT_DIR/segments/seg-${idx}.mp4"

  if [ -f "$out" ]; then
    echo "[SKIP] Segment $idx"
    return
  fi

  if [ ! -f "$video_file" ]; then
    echo "[WARN] Missing video: $video_file — creating blank"
    # Create a dark blank video matching audio duration
    local duration
    duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$audio_file" 2>/dev/null || echo "6")
    ffmpeg -y -f lavfi -i "color=c=0x0a1628:s=1920x1080:d=${duration}" \
      -i "$audio_file" -c:v libx264 -c:a aac -shortest "$out" 2>/dev/null
    return
  fi

  if [ ! -f "$audio_file" ]; then
    echo "[WARN] Missing audio: $audio_file — using video only"
    cp "$video_file" "$out"
    return
  fi

  # Merge: scale video to 1920x1080, overlay TTS audio, loop video if shorter than audio
  local audio_dur
  audio_dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$audio_file" 2>/dev/null || echo "6")

  ffmpeg -y \
    -stream_loop -1 -i "$video_file" \
    -i "$audio_file" \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0a1628" \
    -c:v libx264 -preset fast -crf 23 \
    -c:a aac -b:a 192k \
    -t "$audio_dur" \
    -shortest \
    "$out" 2>/dev/null

  echo "[OK]  Segment $idx — $(ls -lh "$out" | awk '{print $5}')"
}

echo ""
echo "--- Combining segments ---"

# Map segments: index -> (video_source, audio_source)
combine_segment "01" "$OUTPUT_DIR/video/01-title.mp4"           "$OUTPUT_DIR/tts/01-hook.wav"
combine_segment "02" "$OUTPUT_DIR/video/02-problem.mp4"         "$OUTPUT_DIR/tts/02-problem.wav"
combine_segment "03" "$OUTPUT_DIR/video/03-architecture.mp4"    "$OUTPUT_DIR/tts/03-solution.wav"

# For demo scenes, prefer Playwright recordings if available, fallback to Veo
CHAT_VIDEO="$OUTPUT_DIR/video/10-chat-animated.mp4"
[ -f "$RECORDINGS_DIR/chat-recording.webm" ] && CHAT_VIDEO="$RECORDINGS_DIR/chat-recording.webm"
combine_segment "04" "$CHAT_VIDEO" "$OUTPUT_DIR/tts/04-demo-chat.wav"

STEPUP_VIDEO="$OUTPUT_DIR/video/05-circuit-breaker.mp4"
[ -f "$RECORDINGS_DIR/stepup-recording.webm" ] && STEPUP_VIDEO="$RECORDINGS_DIR/stepup-recording.webm"
combine_segment "05" "$STEPUP_VIDEO" "$OUTPUT_DIR/tts/05-demo-stepup.wav"

OBS_VIDEO="$OUTPUT_DIR/video/08-observatory-animated.mp4"
[ -f "$RECORDINGS_DIR/observatory-recording.webm" ] && OBS_VIDEO="$RECORDINGS_DIR/observatory-recording.webm"
combine_segment "06" "$OBS_VIDEO" "$OUTPUT_DIR/tts/06-demo-observatory.wav"

DBG_VIDEO="$OUTPUT_DIR/video/09-debugger-animated.mp4"
[ -f "$RECORDINGS_DIR/debugger-recording.webm" ] && DBG_VIDEO="$RECORDINGS_DIR/debugger-recording.webm"
combine_segment "07" "$DBG_VIDEO" "$OUTPUT_DIR/tts/07-demo-debugger.wav"

combine_segment "08" "$OUTPUT_DIR/video/04-owasp.mp4"           "$OUTPUT_DIR/tts/08-demo-scope.wav"
combine_segment "09" "$OUTPUT_DIR/video/06-tech-stack.mp4"      "$OUTPUT_DIR/tts/09-tech-stack.wav"
combine_segment "10" "$OUTPUT_DIR/video/07-closing.mp4"         "$OUTPUT_DIR/tts/10-closing.wav"

# ---------------------------------------------------------------------------
# Step 3: Concatenate all segments
# ---------------------------------------------------------------------------

echo ""
echo "--- Concatenating final video ---"

# Build concat list
CONCAT_LIST="$OUTPUT_DIR/segments/concat.txt"
> "$CONCAT_LIST"
for seg in "$OUTPUT_DIR/segments"/seg-*.mp4; do
  echo "file '$seg'" >> "$CONCAT_LIST"
done

# Concatenate
ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" \
  -c:v libx264 -preset medium -crf 22 \
  -c:a aac -b:a 192k \
  "$OUTPUT_DIR/agent-observatory-no-subs.mp4" 2>/dev/null

echo "[OK] Concatenated: $(ls -lh "$OUTPUT_DIR/agent-observatory-no-subs.mp4" | awk '{print $5}')"

# ---------------------------------------------------------------------------
# Step 4: Burn subtitles
# ---------------------------------------------------------------------------

echo ""
echo "--- Adding subtitles ---"

# Try hard subtitles (requires libass). Falls back to soft subtitles (mov_text).
if ffmpeg -filters 2>/dev/null | grep -q subtitles; then
  cd "$OUTPUT_DIR"
  ffmpeg -y \
    -i "agent-observatory-no-subs.mp4" \
    -vf "subtitles=subtitles.srt:force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=4,Outline=2,Shadow=1,MarginV=40'" \
    -c:v libx264 -preset medium -crf 22 \
    -c:a copy \
    "$FINAL" 2>/dev/null
  echo "[OK] Hard subtitles burned in"
else
  # Soft subtitles (embedded SRT — displayed by most players)
  ffmpeg -y \
    -i "$OUTPUT_DIR/agent-observatory-no-subs.mp4" \
    -i "$SUBTITLES" \
    -c:v copy -c:a copy \
    -c:s mov_text \
    -metadata:s:s:0 language=eng \
    "$FINAL" 2>/dev/null
  echo "[OK] Soft subtitles embedded (enable in player)"
fi

echo ""
echo "============================================="
echo " FINAL VIDEO: $FINAL"
echo " Size: $(ls -lh "$FINAL" | awk '{print $5}')"
echo " Duration: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$FINAL" 2>/dev/null | cut -d. -f1)s"
echo "============================================="
echo ""
echo "The demo video is ready for submission!"
