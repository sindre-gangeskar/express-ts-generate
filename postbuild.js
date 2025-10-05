const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, 'dist');
const shebang = '#!/usr/bin/env node\n';
const content = fs.readFileSync(path.join(dist, 'index.js'), 'utf-8');

if (!content.startsWith(shebang))
  fs.writeFileSync(path.join(dist, 'index.js'), shebang + content, 'utf-8');