# Elijah Mwangi | Engineering Portfolio

I’m a technical leader and software engineer based in Nairobi, Kenya. This is where I document the products I’ve worked on, the teams I’ve led, and what I’ve learned about building and running software.

[Visit the portfolio](https://elijahmwangi.net/) · [Explore my projects](https://elijahmwangi.net/building/) · [Read the Engineering Notebook](https://elijahmwangi.net/writing/)

## Inside the portfolio

The project collection spans education, finance, commerce, and industrial software. It includes screenshots of the workflows behind each project, from managing an academy to monitoring connected devices. The career timeline puts those projects in the context of my roles and responsibilities.

The Engineering Notebook covers C# and .NET, deployment with CircleCI, DevOps and Jira, and Git workflows for teams. Articles pair code examples with diagrams. You can search the notebook by topic or follow new articles through the [RSS feed](https://elijahmwangi.net/feed.xml).

## Run locally

The site uses React and the Next.js Pages Router. Use Node.js 24.x and npm. Run these commands from the repository root.

```sh
npm ci
npm run dev
```

Open the [local portfolio](http://localhost:4173/).

## Update the content

| To update | Edit |
| --- | --- |
| Biography, experience, skills, CV, and contact details | [Profile](src/content/profile.json) |
| Project descriptions, links, and featured selections | [Project catalogue](src/content/projects.json) |
| Project screenshots | [Project images](public/images/projects/) |
| Notebook articles and article metadata | [Markdown posts](src/content/posts/) |

To write in the browser, keep the dev server running and start `npm run cms` in a second terminal. Open the [local writing desk](http://localhost:4173/admin/), choose **Blog posts**, and create or edit an article. Saving writes Markdown and uploaded images to your working copy.

When the article is ready, turn off **Keep as draft** and commit the changes. The next build includes the article once its publication date arrives. For hosted editing and GitHub authentication, see the [CMS setup guide](CMS-SETUP.md).

## Build and preview

```sh
npm run check
npm run preview
```

`npm run check` builds the production site into `out/` and runs the test suite. The build also generates the search index, RSS feed, sitemap, and article diagrams. The dev server and static preview both use port `4173` by default. Stop the dev server before starting the preview.

To deploy, run `npm run build` and publish `out/` to a static host. The default site URL is `https://elijahmwangi.net`.

## Contact

[hello@elijahmwangi.net](mailto:hello@elijahmwangi.net)
