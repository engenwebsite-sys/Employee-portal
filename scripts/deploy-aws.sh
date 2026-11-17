#!/usr/bin/env bash
set -euo pipefail

portal=/var/www/Employee-portal
backend="$portal/backend"
service=nemilink-backend.service
web_root="$portal/frontend/dist"
domain=nemilink-portal.duckdns.org

cd "$portal"
git remote get-url origin | grep -qi 'engenwebsite-sys/Employee-portal'
test -z "$(git status --porcelain --untracked-files=no)"
test "$(git branch --show-current)" = main
test -f "$web_root/index.html"

exec_start=$(systemctl show "$service" -p ExecStart --value)
alembic=
for venv in "$backend/.venv" "$backend/venv" "$portal/.venv" "$portal/venv"; do
    if [[ "$exec_start" == *"$venv/bin/"* && -x "$venv/bin/alembic" ]]; then
        alembic="$venv/bin/alembic"
        break
    fi
done

if [[ -z "$alembic" ||
      "$(systemctl show "$service" -p User --value)" != ubuntu ||
      "$(systemctl show "$service" -p WorkingDirectory --value)" != "$backend" ||
      "$(systemctl show "$service" -p EnvironmentFiles --value)" != "$backend/.env (ignore_errors=no)" ||
      "$(systemctl show "$service" -p Environment --value)" == *DATABASE_URL=* ]]; then
    echo "Check the backend virtualenv and systemd database configuration." >&2
    exit 1
fi

git fetch origin main
git merge --ff-only origin/main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"

build=$(mktemp -d)
trap 'rm -rf -- "$build"' EXIT
cd "$portal/frontend"
npm ci
VITE_API_URL=/api/v1 npm run build -- --outDir "$build" --emptyOutDir

run_alembic() {
    sudo systemd-run --wait --pipe --collect --uid=ubuntu \
        --working-directory="$backend" --property="EnvironmentFile=$backend/.env" \
        "$alembic" "$@"
}

run_alembic upgrade head
run_alembic current
sudo systemctl restart "$service"
curl -fsS --retry 8 --retry-delay 1 --retry-connrefused \
    --resolve "$domain:443:127.0.0.1" "https://$domain/api/v1/health/db"

backup=$(mktemp "$HOME/nemilink-index-before-release.XXXXXX")
cp "$web_root/index.html" "$backup"
printf '\nOld index backup: %s\n' "$backup"
find "$build" -mindepth 1 -maxdepth 1 ! -name index.html \
    -exec sudo cp -a -t "$web_root" -- {} +
sudo install -m 644 "$build/index.html" "$web_root/.index-next.html"
sudo mv -f "$web_root/.index-next.html" "$web_root/index.html"

curl -fsS --resolve "$domain:443:127.0.0.1" "https://$domain/projects" \
    | cmp - "$build/index.html"
echo "Live Employee Portal frontend verified. Release $(git rev-parse --short HEAD)."
