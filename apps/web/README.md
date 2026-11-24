# Website

Run the site with mock download data from the repository root.

```sh
pnpm --filter web start:mocked
```

To use the local API, configure [its environment](../api/README.md), then start both workspaces.

```sh
pnpm start --filter=web --filter=api
```
