# HPU Visiting Student Course Planner

A Next.js course-planning interface for Hawai‘i Pacific University international visiting students. The app loads the approved Spring 2027 undergraduate and graduate course lists from shared Google Sheets, supports filtering and schedule conflict detection, and saves selected courses in the browser.

## Requirements

- Node.js 22 or newer
- npm

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run lint
npx tsc --noEmit
```

## Netlify deployment

The repository uses standard Next.js commands and includes `netlify.toml` with the build command, publish directory, and Node.js version. Netlify automatically provisions its Next.js runtime during deployment.

The course data is proxied through `app/api/courses/route.ts` from the two shared Google Sheets. Responses are refreshed hourly so spreadsheet updates flow through without a code change.
