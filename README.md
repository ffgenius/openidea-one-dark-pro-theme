# One Dark Pro for OpenIDEA

An unofficial OpenIDEA port of Binaryify's One Dark Pro themes: One Dark Pro,
Flat, Darker, Mix, and Night Flat. Based on upstream version 3.20.6 at commit
`75c80ab18d90655e05ad837bb8d89f5e68d5ce53`.

## Install

In OpenIDEA, choose **Settings > Plugins > Install Plugin from Package File**,
select a `.oiplugin` from a GitHub Release or a local build, then apply a theme
in the plugin's details. You can also use **Install Plugin from Disk** and select
this repository's folder.

## Build

Requires Node.js 22+. The JavaScript packer runs on Windows without the
`openidea-plugin` CLI:

```powershell
npm ci
node .\pack.mjs
```

The package and its SHA-256 checksum are written to `dist/` as
`<id>-<version>.oiplugin` and `SHA256SUMS`. To validate the package with the
official CLI, get it from an OpenIDEA release or install it with Cargo:

```powershell
cargo install --locked --git https://github.com/l0ng-ai/openidea ide-host --bin openidea-plugin
openidea-plugin check .\dist\one-dark-pro-theme-0.0.1.oiplugin
```

For a signed community release, use a
publisher-prefixed plugin ID such as `yourname.one-dark-pro`, set
`categories = ["themes"]` in `plugin.toml`, and keep the private key outside the
repository:

```powershell
openidea-plugin keygen ..\yourname.key
node .\pack.mjs --key ..\yourname.key --publisher yourname
```

Upload the signed `.oiplugin` to a versioned GitHub Release. The
[community plugin registry](https://github.com/l0ng-ai/openidea-plugins)
lists its HTTPS download URL and SHA-256.

## GitHub Release

Push a commit to the repository's default branch with the subject
`chore: release <version>`, where `<version>` matches `plugin.toml` (for example,
`chore: release 0.0.1`). GitHub Actions builds and validates the package, then
publishes it with `SHA256SUMS` under tag `v<version>`. Other commits do not
trigger a release.

For a signed release, set the repository secret `OPENIDEA_SIGNING_KEY` to the
contents of the key file created by `openidea-plugin keygen`, and set the
repository variable `OPENIDEA_PUBLISHER` to its publisher ID. Both must be set;
without them, the workflow creates an unsigned package for manual installation.
The community registry requires a signed package and a matching plugin ID
prefix, such as `yourname.one-dark-pro` for publisher `yourname`.

## Attribution

Original theme: [Binaryify/OneDark-Pro](https://github.com/Binaryify/OneDark-Pro).
Licensed under MIT; the original notice is included in [LICENSE.txt](LICENSE.txt).
