# Optional upstream fixtures

OP Embedded Studio does not include OpenPencil's large Git LFS test fixtures.

The omitted files were used only by upstream Figma import, visual oracle, performance, and font-rendering tests:

- `gold-preview.fig`
- `material3.fig`
- `nuxtui.fig`
- `fonts/NotoSansSC-Regular.ttf`
- `fonts/NotoNaskhArabic-Regular.ttf`

They are not loaded by the application at runtime. CJK fallback remains implemented through system fonts (for example Microsoft YaHei on Windows) and the configured online font providers, with downloaded fonts cached by the application.
