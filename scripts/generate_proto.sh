#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# generate_proto.sh
# Generates gRPC stubs for Python and Go from proto/stt.proto.
# Run from repository root: bash scripts/generate_proto.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROTO_DIR="$REPO_ROOT/proto"
PROTO_FILE="$PROTO_DIR/stt.proto"

# ── Python stubs ─────────────────────────────────────────────────────────────
PYTHON_OUT="$REPO_ROOT/ai-service/stt/app/proto"
mkdir -p "$PYTHON_OUT"

echo "Generating Python stubs → $PYTHON_OUT"
python -m grpc_tools.protoc \
  -I"$PROTO_DIR" \
  --python_out="$PYTHON_OUT" \
  --grpc_python_out="$PYTHON_OUT" \
  "$PROTO_FILE"

# Fix relative imports in generated files (grpc_tools quirk)
PY_STUB="$PYTHON_OUT/stt_pb2_grpc.py"
sed -i.bak 's/^import stt_pb2/from app.proto import stt_pb2/' "$PY_STUB"
rm -f "${PY_STUB}.bak"

echo "Python stubs generated."

# ── Go stubs ──────────────────────────────────────────────────────────────────
GO_OUT="$REPO_ROOT/backend/pkg/pb/stt"
mkdir -p "$GO_OUT"

echo "Generating Go stubs → $GO_OUT"
protoc \
  -I"$PROTO_DIR" \
  --go_out="$GO_OUT" \
  --go_opt=paths=source_relative \
  --go-grpc_out="$GO_OUT" \
  --go-grpc_opt=paths=source_relative \
  "$PROTO_FILE"

echo "Go stubs generated."
echo ""
echo "✅ Done. Commit the generated files:"
echo "   $PYTHON_OUT/stt_pb2.py"
echo "   $PYTHON_OUT/stt_pb2_grpc.py"
echo "   $GO_OUT/stt.pb.go"
echo "   $GO_OUT/stt_grpc.pb.go"
