#!/bin/sh
# Activa los git hooks del repo.
#
#   sh scripts/setup-hooks.sh
#
# Se ejecuta una vez por clon. A partir de ahí, cada `git push` compila
# antes de subir y se cancela si el build falla.
set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

git config core.hooksPath .githooks
chmod +x .githooks/pre-push 2>/dev/null || true

echo "✓ Hooks activados: .githooks"
echo "  A partir de ahora 'git push' compila antes de subir."
echo ""
echo "  Saltar una vez:  git push --no-verify"
