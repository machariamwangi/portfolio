# Blog editing

The browser editor lives at `/admin/`. It uses **Decap CMS 3.17.3**, pinned in `public/admin/index.html`, and stores articles as Markdown with YAML frontmatter in `src/content/posts/`. No sample articles have been published.

## Write locally

Use Node.js 24.x. From the project root, install the locked dependencies and start the portfolio.

```powershell
npm ci
npm run dev
```

In a second terminal in the same directory, start the local content service:

```powershell
npm run cms
```

Open [the local writing desk](http://localhost:4173/admin/). Keep both terminals running. Select the local login button, open **Blog posts**, and choose **New Blog post**. The local service writes the actual Markdown files and uploaded images to disk; it does not push to GitHub or deploy the website.

If the editor shows **Login with GitHub** locally, the local content service was not detected. Start `npm run cms` from this project's root and reload the editor before proceeding. The default content-service port is `8081`. Do not run it against the old resume checkout by mistake.

New posts have **Keep as draft** enabled. Save the article while writing; switch that field off only when ready to show it on the public blog. Decap's save/publish button persists a content file; the `draft` field controls whether the site generator includes the article. The generator must exclude every `draft: true` entry from article pages, listings, and feeds. A saved draft can be present in Git without appearing on the website.

Markdown image uploads are stored in `public/images/uploads/` and referenced as `/images/uploads/...`. Next.js includes `public/` in its static export. Reload the development page after saving content; for a manual production build, run `npm run build`.

## Enable editing at elijahmwangi.net

The hosted editor signs in through GitHub using the portfolio’s Vercel function at `/api/cms-auth`. The public pages still use Next.js static export. Opening the writing desk on a Vercel deployment alias takes you to the production editor so that the sign-in popup and the editor share an origin.

1. Register a GitHub OAuth app called **Elijah Mwangi Writing Desk**. Set its homepage to `https://elijahmwangi.net` and its **Authorization callback URL** to `https://elijahmwangi.net/api/cms-auth`. [Register an OAuth app](https://github.com/settings/applications/new)
2. In the Vercel **portfolio** project, open **Settings → Environment Variables**. For **Production**, add `CMS_GITHUB_CLIENT_ID` with the app’s Client ID and `CMS_GITHUB_CLIENT_SECRET` with a newly generated client secret. Enter the secret directly in Vercel as a sensitive value. [Portfolio environment settings](https://vercel.com/elijah-mwangi/portfolio/settings/environment-variables)
3. Deploy the change to production after saving both variables. If the code is already deployed, redeploy the current production commit so the function receives the values.
4. Open the writing desk, select **Login with GitHub**, and authorize the app using an account with write access to `machariamwangi/portfolio`. The OAuth app requests GitHub’s `public_repo` scope. [Production writing desk](https://elijahmwangi.net/admin/) · [Decap GitHub backend](https://decapcms.org/docs/github-backend/)

Save an article as a draft to create its editorial branch and pull request. When it is ready to publish, turn off **Keep as draft**, save, and merge the pull request after the required checks pass. Vercel deploys it from `main`.

## Integration notes

The project package should include the exact development dependency and script below. `decap-server` 3.11.6 requires Node.js 20 or newer. It defaults to local filesystem writes and local-machine access. See the [official local-backend guide](https://decapcms.org/docs/decap-proxy/).

```json
{
  "scripts": {
    "cms": "decap-server"
  },
  "devDependencies": {
    "decap-server": "3.11.6"
  },
  "overrides": {
    "@decap/cli": {
      "@hapi/joi": "npm:joi@17.13.9",
      "zod": "4.6.7"
    }
  }
}
```

The scoped overrides replace Decap CLI's retired `@hapi/joi` dependency with the maintained, compatible Joi 17 package and use patched Zod. Joi 17.13.9 fixes the [published Joi advisory](https://github.com/advisories/GHSA-4528-x5fx-h6hg). Keep these overrides until the upstream CLI updates its dependency declarations. The local proxy's draft save/read/list operations and path protection were tested with this combination; the complete dependency audit reported zero known vulnerabilities on 17 November 2026.

Keep `src/content/posts/` and `public/images/uploads/` in the source tree. The schema is `title`, `date` (YYYY-MM-DD), `description`, `tags` (array of strings), `draft` (boolean), and the Markdown body. Article filenames use the title's slug. The editor preview is a writing aid; the generated site provides the final layout.

The pinned editor script loads from jsDelivr, so the browser needs an internet connection even for local editing. Only content saving uses the local service.
