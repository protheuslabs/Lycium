# Approved Library Layout V2

Frozen on 2026-11-20 before the photographed-material and lighting pass.
This preserves the approved pod wall/seat/desktop geometry, furniture layout,
plants, cart books, camera, textures, route, tests, and dependency lockfile.
The original base-v1 snapshot is also preserved separately.

Archive SHA-256:
`d5056cbbb202bf074fc55ed87f08fcff56ae21cf23368273d0b881224565980e`

`preview.png` shows this version. To recover files without overwriting new work,
extract the archive into a new directory and compare selected library files:

```sh
mkdir -p /tmp/lycium-library-layout-v2
tar -xzf docs/design-snapshots/library-layout-v2/scene.tar.gz -C /tmp/lycium-library-layout-v2
```

Do not replace the application's package manifest or lockfile wholesale if
unrelated dependencies have changed since the snapshot.
