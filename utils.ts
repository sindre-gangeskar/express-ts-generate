import { execSync } from "child_process";
import { confirm, select, input } from "@inquirer/prompts";
import { Command } from "commander";
import { Runtime, ViewEngine } from "types/types";

import fs from 'fs';
import path from 'path';
import ora from "ora";

export function generate(program: Command, app: string, view: ViewEngine[ "value" ], gitInit: boolean, runtime: Runtime) {
  program.name('express-ts-generate').description('Generate TypeScript Express applications').version("1.3.1")
  program.argument('[app-name]', 'name of the application', app)
    .option('-v, --view [view]', 'select view engine', view)
    .option('--git [git]', 'setup a .gitignore file', gitInit)
    .action(async (app, options) => {
      let flags: string = "";
      const entries = Object.entries(options);

      const exists = fs.existsSync(path.join(__dirname, app));
      let proceed = true;
      let force = false;

      if (exists) {
        const dir = fs.readdirSync(app, { encoding: 'utf-8' });
        if (dir.length > 0) {
          proceed = await confirm({ message: 'Directory is not empty.. proceed and force?' })
          force = proceed;
        }
      }

      if (!proceed) {
        console.info('Exiting...');
        process.exit();
      }

      const makeSrc = await confirm({ message: 'Make src folder? ** recommended **', default: true });

      const spinner = ora('Generating express project...').start()
      entries.forEach((entry) => {
        flags = flags.concat(`${typeof entry[ 1 ] !== "boolean" ? `--${entry[ 0 ]}` : typeof entry[ 1 ] === "boolean" && entry[ 1 ] ? `--${entry[ 0 ]}` : ""} ${typeof entry[ 1 ] !== "boolean" ? entry[ 1 ] : ""}`).trim().concat(' ');
      })

      const targetPath = makeSrc ? path.join(process.cwd(), app, 'src').normalize() : path.join(process.cwd(), app).normalize();
      const extRuntime = runtime === "node" ? 'npx' : 'bun x';

      execSync(`${extRuntime} express-generator@latest ${makeSrc ? app + '/src' : app} ${flags} ${force ? ' --force' : ''}`)
      spinner.succeed('Generated base express project');

      spinner.start('Converting to TypeScript...');
      convertToTypeScript(targetPath, runtime, makeSrc);

      if (makeSrc) {
        const filesToMove = [ 'package.json', 'tsconfig.json', '.gitignore' ];
        filesToMove.forEach(file => {
          fs.renameSync(path.join(app, 'src', file), path.join(app, file));
        })
      }

      checkStatements(targetPath);
      spinner.succeed('Converted to TypeScript');

      spinner.start('Installing dependencies and types...');
      execSync(`cd ${targetPath} && ${runtime === "node" ?
        `npm install && npm install nodemon tsx typescript tsc-esm-fix @swc/cli @swc/core @types/node @types/express @types/morgan @types/cookie-parser @types/debug --save-dev`
        : `bun install && bun add -d @types/node @types/express @types/morgan @types/cookie-parser @types/debug`
        }`)

      spinner.succeed("Finished installing dependencies");
      spinner.succeed(`Project is ready!\nAudit dependecies recommended\n ${runtime == "node" ? '\ndev: npm run dev\nbuild: npm run build\nstart: npm start' : '\ndev: bun run dev\nstart: bun start'}`);

    })
  program.parse()
}
export async function initialize() {
  try {
    const viewEngines: ViewEngine[] = [ { name: 'Embedded JavaScript', value: 'ejs' }, { name: 'Pug', value: 'pug' }, { name: 'None', value: 'none' } ];
    const appname = await input({ message: 'What is the name of the application?', default: 'express-ts', required: true });
    const view = await select({ message: 'Which view engine will you use?', choices: viewEngines })
    const gitInit = await confirm({ message: 'Initialize .gitignore?', default: true });
    const runtime = await select({ message: 'Which runtime environment will you use?', choices: [ { name: 'Node', value: 'node' }, { name: 'Bun', value: 'bun' } ] }) as Runtime;
    return { appname, view, gitInit, runtime }
  } catch (error) {
    throw error;
  }
}
function convertToTypeScript(rootDir: string, runtime: Runtime, hasSrc: boolean) {
  const routesPath = path.join(rootDir, 'routes');

  const nodeTsConfig = {
    module: 'nodenext',
    moduleResolution: 'nodenext',
    incremental: true,
    target: "esnext",
    lib: [ "ESNext" ],
    allowJs: true,
    rootDir: hasSrc ? "src" : ".",
    outDir: "dist",
    strict: true,
    noImplicitAny: false,
  }
  const bunTsConfig = {
    module: 'esnext',
    moduleResolution: "node",
    target: "esnext",
    lib: [ "ESNext" ],
    strict: true,
    noImplicitAny: false,
  }
  const tsConfig = {
    compilerOptions: {
      ...(runtime == "node" ? nodeTsConfig : bunTsConfig),
      allowSyntheticDefaultImports: true,
      allowImportingTsExtensions: true,
      noEmit: true,
      resolveJsonModule: true,
    },
    include: [ hasSrc ? 'src' : '.' ],
    exclude: [ "node_modules", "dist" ]
  }
  const tsConfigJSON = JSON.stringify(tsConfig, null, 2);

  fs.renameSync(path.join(rootDir, 'app.js'), path.join(rootDir, 'app.ts'));
  fs.readdirSync(path.join(rootDir, 'routes')).forEach((file) => {
    if (file.endsWith('.js')) {
      const name = file.split('.js')[ 0 ];
      fs.renameSync(`${routesPath}/${name}.js`, `${routesPath}/${name}.ts`);
    }
  })
  fs.writeFileSync(path.join(rootDir, 'tsconfig.json'), tsConfigJSON);
  
  if (runtime == "node") {
    const tsmFixScript = `import { fix } from 'tsc-esm-fix';
await fix({ filenameVar: false, dirnameVar: false, target: "dist/**/*" })`;
    fs.writeFileSync(path.join(rootDir, hasSrc ? '..' : '', 'tsc-esm-fix.js'), tsmFixScript, 'utf-8');
  }
  
  const packageJSON = fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8');
  let packageData = JSON.parse(packageJSON);

  packageData.type = "module";
  packageData.scripts.start = `${runtime === "node" ? `node dist/bin/www` : `bun ${hasSrc ? 'src' : '.'}/bin/www`}`;
  packageData.scripts.dev = `${runtime === "node" ? `tsx watch ${hasSrc ? 'src' : '.'}/bin/www` : `bun --watch ${hasSrc ? 'src' : '.'}/bin/www`}`;

  if (runtime === "node")
    packageData.scripts.build = `swc ${hasSrc ? 'src ' : '. '}-d dist ${!hasSrc ? "--ignore node_modules,*.json,tsc-esm-fix.js" : "--strip-leading-paths"} --copy-files && node tsc-esm-fix.js`;

  const editedJSON = JSON.stringify(packageData, null, 2);
  fs.writeFileSync(path.join(rootDir, 'package.json'), editedJSON);
}
function checkStatements(rootDir: string) {
  const files: { pathname: string }[] = [ { pathname: path.join(rootDir, 'app.ts') }, { pathname: path.join(rootDir, 'routes', 'index.ts') }, { pathname: path.join(rootDir, 'routes', 'users.ts') }, { pathname: path.join(rootDir, 'bin', 'www') } ];
  files.forEach(file => {
    const parsed = fs.readFileSync(file.pathname, 'utf-8');
    const appUseRegex = /(app\.use|router\.get)\((\'\/\'\, )? ?function\((err)?\,? ?(req)\, (res)\, (next)\) \{/gi;
    const serverPath = path.join(rootDir, 'bin', 'www')

    let refactored = parsed.replace(appUseRegex, (_, p1, p2, p3, p4, p5, p6) => `${p1}(${p2 ?? ''}function(${p3 ? p3 + ": HttpError, " : ''}${p4}: Request, ${p5}: Response, ${p6}: NextFunction ) {`)
    const slicedData = refactored.split('\n');

    if (file.pathname !== serverPath)
      slicedData.splice(0, 0, `import { Request, Response, NextFunction } from 'express'`)

    if (file.pathname === path.join(rootDir, 'app.ts')) {
      slicedData.splice(1, 0, `import { HttpError } from 'http-errors'`)
      slicedData.splice(7, 0, "import { fileURLToPath } from 'url'\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = path.dirname(__filename);");
    }

    if (file.pathname === serverPath) {
      const name = path.basename(rootDir);
      slicedData.splice(7, 1, `import debugModule from 'debug'\nconst debug = debugModule('${name}:server')`);
    }

    const formatted = slicedData.join('\n');
    let result = convertToImportStatements(formatted)
    fs.writeFileSync(file.pathname, result);
  })
}
function convertToImportStatements(parsed: string) {
  const requireRegex = /var (\w+) = require(\(\'[\.+\/+\w\:\-]+\'\))\;/gi
  const moduleExportsRegex = /module\.exports = (\w+)/gi;
  parsed = parsed.replace(requireRegex, (_, p1: string, p2: string) => {
    let sliced = p2.slice(2, -2);
    const extRegex = /^\.{1,2}\/[\w+\/]+$/;

    if (extRegex.test(sliced))
      sliced += ".ts";

    return `import ${p1} from ${"'" + sliced + "'"}`
  })

  parsed = parsed.replace(moduleExportsRegex, (_, p1: string) => {
    return `export default ${p1}`;
  })

  return parsed;
}
