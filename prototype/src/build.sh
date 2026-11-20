#!/bin/bash
cd "$(dirname "$0")"
{
echo '<title>Forge Beat Studio</title>'
echo '<meta name="claude:viewport-fit-sides" content="cover">'
echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap">'
echo '<style>'; cat 10-style.css; echo '</style>'
cat 11-body.html
echo '<script>'
cat 01-dsp.js 02-engine.js 03-presets.js 04-ui-core.js 05-rack.js 06-roll.js 06b-samplib.js 06c-sampler-ui.js 07-mixer.js 08-main.js
echo '</script>'
} > forge.html
wc -c forge.html
