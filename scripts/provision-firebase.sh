#!/usr/bin/env bash
#
# One-shot provisioning for the Call-Driven CRM demo.
# Run it where YOU are authenticated — your credentials never leave your machine.
#
# Prerequisites (install + log in once):
#   gcloud   → https://cloud.google.com/sdk     then:  gcloud auth login
#   firebase → npm i -g firebase-tools          then:  firebase login
#   gh       → https://cli.github.com           then:  gh auth login
#   node     → v20+
#
# Usage:
#   bash scripts/provision-firebase.sh [PROJECT_ID]
# (If PROJECT_ID is omitted you'll be prompted. It must be globally unique.)
#
# What it does: creates the Firebase project, enables Auth (Email/Password) +
# Firestore + Hosting APIs, registers a web app, creates a deploy service
# account + key, and sets the GitHub secrets/variables the Deploy workflow
# needs. It does NOT enable billing and does NOT deploy Functions.

set -uo pipefail

### ---------- config (edit or pass as args/env) ----------
PROJECT_ID="${1:-${PROJECT_ID:-}}"
REGION="${REGION:-me-west1}"          # Firestore location, e.g. me-west1 (Tel Aviv), europe-west1, us-central1, nam5
REPO="${REPO:-VBASQL/simple-crm}"     # GitHub owner/repo to receive the secrets
### -------------------------------------------------------

if [ -z "$PROJECT_ID" ]; then
  read -rp "Enter a globally-unique Firebase project id: " PROJECT_ID
fi
[ -n "$PROJECT_ID" ] || { echo "PROJECT_ID is required"; exit 1; }

SA_NAME="crm-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="$(mktemp -d)/sa-key.json"

echo "==> Checking prerequisites"
for c in gcloud firebase gh node; do
  command -v "$c" >/dev/null 2>&1 || { echo "   Missing CLI: $c"; exit 1; }
done
gcloud auth print-access-token >/dev/null 2>&1 || { echo "   Run: gcloud auth login"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "   Run: gh auth login"; exit 1; }

echo "==> Creating project: $PROJECT_ID"
gcloud projects create "$PROJECT_ID" --name="Simple CRM" 2>/dev/null \
  || echo "   (project exists or not creatable by you; continuing)"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "==> Enabling APIs (this can take a minute)"
gcloud services enable \
  firebase.googleapis.com \
  firebasehosting.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com \
  serviceusage.googleapis.com \
  --project "$PROJECT_ID"

echo "==> Adding Firebase to the project"
firebase projects:addfirebase "$PROJECT_ID" 2>/dev/null || echo "   (already a Firebase project; continuing)"

echo "==> Creating Firestore (Native) database in $REGION"
gcloud firestore databases create --location="$REGION" --type=firestore-native --project "$PROJECT_ID" 2>/dev/null \
  || echo "   (database exists or region rejected — edit REGION if needed; continuing)"

echo "==> Enabling Email/Password sign-in"
ACCESS_TOKEN="$(gcloud auth print-access-token)"
if curl -sf -X PATCH \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" -H "Content-Type: application/json" \
  -d '{"signIn":{"email":{"enabled":true,"passwordRequired":true}}}' >/dev/null; then
  echo "   enabled"
else
  echo "   (could not enable via API — turn on Email/Password in the Firebase console → Authentication)"
fi

get_web_app_id() {
  firebase --json apps:list web --project "$PROJECT_ID" 2>/dev/null | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      try { const j=JSON.parse(s); const a=(j.result||[]).find(x=>x.platform==="WEB"); process.stdout.write(a?a.appId:""); }
      catch { process.stdout.write(""); }
    });'
}

echo "==> Registering a Web app"
APP_ID="$(get_web_app_id)"
if [ -z "$APP_ID" ]; then
  firebase apps:create web "crm-web" --project "$PROJECT_ID" >/dev/null 2>&1 || true
  APP_ID="$(get_web_app_id)"
fi
[ -n "$APP_ID" ] || { echo "   Could not determine the web app id"; exit 1; }
echo "   APP_ID=$APP_ID"

echo "==> Fetching web config"
CFG="$(firebase --json apps:sdkconfig web "$APP_ID" --project "$PROJECT_ID")"
CFG_LINES="$(printf '%s' "$CFG" | node -e '
  let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
    const c=JSON.parse(s).result.sdkConfig;
    console.log(c.apiKey); console.log(c.authDomain);
  });')"
API_KEY="$(printf '%s\n' "$CFG_LINES" | sed -n 1p)"
AUTH_DOMAIN="$(printf '%s\n' "$CFG_LINES" | sed -n 2p)"
[ -n "$API_KEY" ] && [ -n "$AUTH_DOMAIN" ] || { echo "   Could not read web config"; exit 1; }
echo "   apiKey=${API_KEY:0:8}…  authDomain=$AUTH_DOMAIN"

echo "==> Creating deploy service account + key"
gcloud iam service-accounts create "$SA_NAME" --display-name="CRM deployer" --project "$PROJECT_ID" 2>/dev/null || true
for role in roles/firebase.admin roles/firebasehosting.admin roles/datastore.owner roles/iam.serviceAccountUser roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" --role="$role" --quiet >/dev/null
done
gcloud iam service-accounts keys create "$KEY_FILE" --iam-account="$SA_EMAIL" --project "$PROJECT_ID"

echo "==> Setting GitHub secrets + variables on $REPO"
gh secret   set FIREBASE_PROJECT_ID      -R "$REPO" --body "$PROJECT_ID"
gh secret   set FIREBASE_SERVICE_ACCOUNT -R "$REPO" < "$KEY_FILE"
gh secret   set VITE_FIREBASE_API_KEY    -R "$REPO" --body "$API_KEY"
gh secret   set VITE_FIREBASE_AUTH_DOMAIN -R "$REPO" --body "$AUTH_DOMAIN"
gh secret   set VITE_FIREBASE_APP_ID     -R "$REPO" --body "$APP_ID"
gh variable set SEED_DEMO                -R "$REPO" --body "true"

rm -f "$KEY_FILE"

cat <<EOF

✅ Provisioned project: $PROJECT_ID
   GitHub secrets + SEED_DEMO=true set on $REPO

Next:
  1. Merge your branch into main (the Deploy workflow runs on main).
  2. Watch it in the repo's Actions tab.
  3. Open:  https://${PROJECT_ID}.web.app
     Sign in:  agent@example.com  /  password123

(The webhook Cloud Function stays on the emulator for now — deploying it needs
the Blaze plan. Set the repo variable DEPLOY_FUNCTIONS=true later to include it.)
EOF
