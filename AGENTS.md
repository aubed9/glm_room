# Repository Guidelines

## Project Structure & Module Organization
- `src/app` holds App Router routes served by `server.ts` and its HTTPS sibling; keep route segments lowercase and colocate REST handlers under `api/`.
- Shared UI lives in `src/components` (feature widgets) and `src/components/ui` (shadcn primitives); custom hooks sit in `src/hooks`, utility clients in `src/lib`.
- Static assets remain in `public/`; throwaway audio artifacts stay under `uploads/recordings` and should be cleaned before commits.
- Database sources are defined in `prisma/schema.prisma`; generated clients and seedable SQLite data are in `prisma/db/`, with `db/custom.db` as the local working file.

## Build, Test, and Development Commands
- `npm install` restores dependencies; rerun after touching `package.json` or the lockfile.
- `npm run dev` starts Nodemon + TSX on http://localhost:3000; `npm run dev:https` mirrors it with the HTTPS wrapper.
- `npm run build` runs `prisma generate` then compiles Next.js; `npm start` serves the optimized bundle through `server.ts`.
- `npm run lint` executes `next lint`; `npm run test` runs the Vitest suite; Prisma workflows sit behind `npm run db:*`.

## Coding Style & Naming Conventions
- Favor strict TypeScript and import shared code through the `@/` alias.
- Components use PascalCase filenames, hooks use camelCase, and App Router folders remain lowercase.
- Stick with functional React components and Tailwind utility groupings ordered layout -> spacing -> color; keep two-space indentation, trailing commas, and ESLint compliance.

## Testing Guidelines
- Vitest powers the suite (`tests/api`, `tests/socket`); add `*.test.ts(x)` siblings when introducing new API routes or helpers.
- `tests/api/rooms.test.ts` covers the create -> upload -> end-session flow; update it whenever audio handling or lifecycle rules change.
- `tests/socket/socket.test.ts` verifies room join, recording start/stop, and disconnect signalling; extend it for new socket events.
- Use `tests/utils/mockDb.ts` to seed isolated fixtures instead of mutating the real SQLite file.

## Commit & Pull Request Guidelines
- Write imperative commit titles (for example, `add room archiving`), group related changes, and call out schema or env updates in the body (`Closes #123`).
- PRs should supply a short summary, screenshots for UI tweaks, migration notes, and the commands you ran locally (`npm run lint`, `npm run test`, migrations).

## Environment & Security Notes
- Keep a local `.env` with `DATABASE_URL="file:./db/custom.db"`; rotate secrets outside version control.
- Avoid committing regenerated SQLite dumps or bulky uploads; prune `db/` and `uploads/` artifacts before pushing, and prefer temporary folders when exporting merged audio.

