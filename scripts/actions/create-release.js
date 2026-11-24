/** @param {import('./types').AsyncFunctionArguments} AsyncFunctionArguments */
export const script = async ({ context, github }) => {
  const version = process.env.PACKAGE_VERSION;
  if (!version) throw new Error("PACKAGE_VERSION is required");
  const tag = `v${version}`;
  const { data: listReleases } = await github.rest.repos.listReleases({
    owner: context.repo.owner,
    repo: context.repo.repo,
  });

  const release = listReleases.find(release => release.draft && release.tag_name === tag);
  if (release) {
    console.log("Skipping release creation as there is already a draft");
    console.log("Reusing:", release.id);
    return release.id;
  }

  const { data } = await github.rest.repos.createRelease({
    owner: context.repo.owner,
    repo: context.repo.repo,
    tag_name: tag,
    name: `UniversalOverlay ${version}`,
    body: "release notes here",
    draft: true,
    prerelease: version.split("+", 1)[0].includes("-"),
  });
  console.log("Created release with id:", data.id);
  return data.id;
};
