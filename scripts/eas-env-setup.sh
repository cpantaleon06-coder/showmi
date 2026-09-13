#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Sube las EXPO_PUBLIC_* del .env local al dashboard de EAS (2026-09-13)
# ---------------------------------------------------------------------------
# POR QUE EXISTE: las EXPO_PUBLIC_* se hornean en el binario EN TIEMPO DE BUILD, y EAS Build
# no sube el .env local porque esta gitignored. Sin definirlas del lado de EAS, el APK sale
# con todas vacias -- RevenueCat no se configura (el paywall no muestra planes, la compra es
# imposible) y Supabase queda muerto. Ver la nota larga en .env.example.
#
# Se hace por script y no a mano para que las dos cosas que importan no dependan de acordarse:
# que los valores salgan del .env que ya funciona (sin copiar/pegar a ojo) y que ningun valor
# se imprima en pantalla ni quede en el historial del shell.
#
# NO TOCA `production` a proposito: ahi van las llaves REALES de tienda (appl_/goog_), no las
# test_ de desarrollo. Eso se hace a mano cuando existan.
#
# USO:
#   export EXPO_TOKEN=...        # expo.dev -> Account Settings -> Access Tokens
#   bash scripts/eas-env-setup.sh
#
#   bash scripts/eas-env-setup.sh --dry-run   # muestra que haria, sin tocar nada
set -euo pipefail

cd "$(dirname "$0")/.."

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

if [ ! -f .env ]; then
  echo "ERROR: no hay .env en $(pwd)" >&2
  exit 1
fi

if [ "$DRY_RUN" -eq 0 ] && [ -z "${EXPO_TOKEN:-}" ]; then
  echo "ERROR: falta EXPO_TOKEN." >&2
  echo "  Sacalo en expo.dev -> Account Settings -> Access Tokens, y:" >&2
  echo "    export EXPO_TOKEN=..." >&2
  exit 1
fi

# Solo las que el cliente necesita de verdad. GOOGLE_WEB_CLIENT_ID se OMITE mientras este
# vacia: EAS rechaza el valor vacio con un error de validacion de esquema.
VARS=(
  EXPO_PUBLIC_SUPABASE_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY
  EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID
  EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
)

ENVIRONMENTS=(development preview)

creadas=0
omitidas=0

for name in "${VARS[@]}"; do
  # Se lee del .env con cut -f2- para no romper valores que contienen '=' (los JWT los llevan).
  value="$(grep -E "^${name}=" .env | head -1 | cut -d= -f2- | tr -d '\r' || true)"

  if [ -z "$value" ]; then
    echo "  omitida  ${name}  (vacia en .env)"
    omitidas=$((omitidas + 1))
    continue
  fi

  for env in "${ENVIRONMENTS[@]}"; do
    if [ "$DRY_RUN" -eq 1 ]; then
      # Nunca el valor: solo su longitud, suficiente para confirmar que se leyo algo.
      echo "  [dry-run] ${env}/${name}  (${#value} caracteres)"
      continue
    fi

    # --force sobrescribe si ya existe, para que el script sea repetible sin fallar a mitad.
    # --visibility plaintext es lo correcto para EXPO_PUBLIC_*: ya viajan dentro del bundle,
    # marcarlas como secret solo daria una falsa sensacion de proteccion.
    npx eas-cli env:create \
      --environment "$env" \
      --name "$name" \
      --value "$value" \
      --visibility plaintext \
      --scope project \
      --non-interactive \
      --force >/dev/null 2>&1 && echo "  ok  ${env}/${name}" || echo "  FALLO  ${env}/${name}"
    creadas=$((creadas + 1))
  done
done

echo
echo "creadas: ${creadas}  omitidas: ${omitidas}"

if [ "$DRY_RUN" -eq 0 ]; then
  echo
  echo "=== comprobacion (nombres, no valores) ==="
  for env in "${ENVIRONMENTS[@]}"; do
    echo "-- ${env} --"
    # OJO: env:list NO acepta --non-interactive (a diferencia de env:create). Pasarselo hacia
    # fallar el comando entero, y el `|| echo` lo disfrazaba de "(ninguna)" -- o sea que la
    # comprobacion reportaba cero variables justo despues de crearlas bien. Se detecto porque
    # los ocho `ok` no cuadraban con el listado vacio.
    # Se corta el valor con cut: basta el nombre para confirmar que existe.
    npx eas-cli env:list --environment "$env" 2>&1 | grep -oE "^EXPO_PUBLIC_[A-Z_]+" | sed 's/^/  /' || echo "  (ninguna)"
  done
fi
