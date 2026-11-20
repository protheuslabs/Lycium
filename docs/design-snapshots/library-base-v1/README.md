# Library Base V1

Saved before adding the expanded artifact collection and comfortable study areas
on 2026-11-20. This is an independent frozen copy, not a reference to the changing
working tree. `preview.png` shows the saved version.

`scene.tar.gz` contains the complete LibraryPreview component directory, route,
isolated browser tests, both image textures, framing documentation, package
manifest, and lockfile. Paths inside the archive are relative to the repo root.
Three.js and its types are version 0.187.0 in the saved lockfile.

Archive SHA-256:
`10a33623ffee80a088f420ad9ecf3190c2787d9edc71108b3e19fd2b66b11479`

To inspect or recover it without overwriting current work, extract into a new
directory first:

```sh
mkdir -p /tmp/lycium-library-base-v1
tar -xzf docs/design-snapshots/library-base-v1/scene.tar.gz -C /tmp/lycium-library-base-v1
```

Compare or copy only the library files that should be restored. Do not replace
the entire package manifest or lockfile if unrelated dependencies have changed.
The saved base retains the 96-meter room diameter, 100-foot shelves, and broad
30-meter-radius camera orbit. It does not include an entire application backup.
