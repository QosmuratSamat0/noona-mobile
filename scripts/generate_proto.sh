#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# generate_proto.sh
# Generates gRPC stubs for Python and Go from proto/*.proto.
# Run from repository root: bash scripts/generate_proto.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROTO_DIR="$REPO_ROOT/proto"

for PROTO_FILE in "$PROTO_DIR"/*.proto; do
    FILENAME=$(basename "$PROTO_FILE" .proto)
    echo "Processing $FILENAME.proto..."

    # ── Python stubs ─────────────────────────────────────────────────────────────
    # We put python stubs into their respective service directories
    # STT -> ai-service/stt/app/proto
    # TTS -> ai-service/tts/app/proto
    PYTHON_OUT="$REPO_ROOT/ai-service/$FILENAME/app/proto"
    mkdir -p "$PYTHON_OUT"

    echo "  Generating Python stubs → $PYTHON_OUT"
    python -m grpc_tools.protoc \
      -I"$PROTO_DIR" \
      --python_out="$PYTHON_OUT" \
      --grpc_python_out="$PYTHON_OUT" \
      "$PROTO_FILE"

    # Fix relative imports in generated files (grpc_tools quirk)
    PY_STUB="$PYTHON_OUT/${FILENAME}_pb2_grpc.py"
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/^import ${FILENAME}_pb2/from app.proto import ${FILENAME}_pb2/" "$PY_STUB"
    else
      sed -i "s/^import ${FILENAME}_pb2/from app.proto import ${FILENAME}_pb2/" "$PY_STUB"
    fi

    # ── Go stubs ──────────────────────────────────────────────────────────────────
    GO_OUT="$REPO_ROOT/backend/pkg/pb/$FILENAME"
    mkdir -p "$GO_OUT"

    echo "  Generating Go stubs → $GO_OUT"
    protoc \
      -I"$PROTO_DIR" \
      --go_out="$GO_OUT" \
      --go_opt=paths=source_relative \
      --go-grpc_out="$GO_OUT" \
      --go-grpc_opt=paths=source_relative \
      "$PROTO_FILE"
done

echo ""
echo "✅ Done. All stubs generated."

