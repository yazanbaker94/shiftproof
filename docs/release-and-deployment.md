# Release and deployment

ShiftProof keeps the reviewer APK and the VPS release independent. Neither workflow stores credentials in the repository.

## CI

Every pull request and push to `main` verifies:

- shared contract compilation;
- API production compilation and tests;
- recruiter site and manager ledger production build;
- mobile TypeScript, unit tests, and Expo SDK compatibility;
- both production Docker images and the Compose configuration.

## Reviewer APK

Run **Android reviewer APK** from GitHub Actions for an installable 64-bit Android artifact. The workflow rebuilds the native project from `app.json`, runs the mobile checks, uploads the APK plus its SHA-256 checksum for 30 days, and attaches both files to a GitHub Release when a `v*` tag is pushed.

The APK is a reviewer build, not a Play Store release. It uses the current Gradle release configuration and is intended for direct demonstration. A store release should use a protected production signing key managed outside this repository.

Local equivalent:

```bash
npm ci --prefix apps/mobile
EXPO_PUBLIC_API_URL=https://shiftproof.swoop.video/api \
  npm --prefix apps/mobile run android:reviewer:arm64
```

Output: `apps/mobile/dist/android/shiftproof-release-arm64-v8a.apk`.

## VPS deployment

The VPS needs Docker Engine, Docker Compose v2, Git, curl, gzip, and `flock`. Check out a clean commit, copy `infra/.env.example` to `infra/.env`, replace every placeholder, and keep the file mode at `600`.

```bash
chmod 600 infra/.env
chmod +x infra/scripts/*.sh
./infra/scripts/deploy.sh
```

The deploy script:

1. refuses a dirty checkout and concurrent release;
2. validates Compose configuration;
3. creates a compressed PostgreSQL backup when the database is already running;
4. builds immutable images tagged with the Git commit;
5. waits for gateway and API health checks;
6. automatically restores the previous containers if the new release is unhealthy;
7. records the previous image pair for an explicit rollback.

If the origin binds to a non-default port, pass it explicitly:

```bash
ORIGIN_URL=http://127.0.0.1:19000 ./infra/scripts/deploy.sh
```

Rollback one application release with:

```bash
./infra/scripts/rollback.sh
```

Rollback changes the API and web images only. It intentionally does not reverse database migrations. Restore a pre-deploy database backup only after reviewing the migration and accepting the loss of data written since that snapshot.

For later Compose commands, load both the secret environment and the active immutable image file:

```bash
docker compose --env-file infra/.env --env-file infra/.images.env \
  -f infra/compose.yaml ps
```
