import { execSync } from "child_process";
import { confirm, select, input } from "@inquirer/prompts";
import { Command } from "commander";
import { Runtime, ViewEngine, Module } from "types/types";

import fs from 'fs';
import path from 'path';
import ora from "ora";

export function generate(program: Command, app: string, view: ViewEngine[ "value" ], gitInit: boolean, runtime: Runtime, forceAudit: boolean, module: Module) {
  program.name('express-ts-generator').description('Generate TypeScript Express applications').version("1.0.0")
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

      const targetPath = makeSrc ? path.join(process.cwd(), app, 'src') : path.join(process.cwd(), app);
      const extRuntime = runtime === "node" ? 'npx' : 'bunx';

      execSync(`${extRuntime} express-generator@latest ${makeSrc ? app + '/src' : app} ${flags} ${force ? ' --force' : ''}`)
      spinner.succeed('Generated base express project');

      spinner.start('Converting to TypeScript...');
      convertToTypeScript(targetPath, module, runtime, makeSrc);

      if (makeSrc) {
        const filesToMove = [ 'package.json', 'tsconfig.json', '.gitignore' ];
        filesToMove.forEach(file => {
          fs.renameSync(path.join(app, 'src', file), path.join(app, file));
        })
      }

      checkStatements(targetPath, module);
      spinner.succeed('Converted to TypeScript');

      spinner.start('Installing dependencies and types...');
      execSync(`cd ${targetPath} && ${runtime === "node" ?
        `npm install && npm install tsx typescript copyfiles @types/node @types/express @types/morgan @types/cookie-parser @types/debug --save-dev && ${forceAudit ? 'npm audit fix --force' : 'npm audit fix'}`
        : `bun install @types/node @types/express @types/morgan @types/cookie-parser @types/debug --save-dev && bun update --latest ${forceAudit ? '--force' : ''}`}`)

      spinner.succeed('Project is ready. Enjoy!');

    })
  program.parse()
}
export async function initialize() {
  try {
    const viewEngines: ViewEngine[] = [ { name: 'Embedded JavaScript', value: 'ejs' }, { name: 'Pug', value: 'pug' }, { name: 'None', value: 'none' } ];
    const appname = await input({ message: 'What is the name of the application?', default: 'express-ts', required: true });
    const module = await select({ message: 'Select module type', choices: [ { name: 'CommonJS', value: 'commonjs' }, { name: 'ESM', value: 'esm' } ] })
    const view = await select({ message: 'Which view engine will you use?', choices: viewEngines })
    const gitInit = await confirm({ message: 'Initialize .gitignore?', default: true });
    const runtime = await select({ message: 'Which runtime environment will you use?', choices: [ { name: 'Node', value: 'node' }, { name: 'Bun', value: 'bun' } ] }) as Runtime;
    const forceAudit = await confirm({ message: 'Force audit fix for dependencies?' })
    return { appname, view, gitInit, runtime, forceAudit, module }
  } catch (error) {
    throw error;
  }
}
function convertToTypeScript(rootDir: string, module: Module, runtime: Runtime, hasSrc: boolean) {
  const routesPath = path.join(rootDir, 'routes');
  const tsConfig = {
    compilerOptions: {
      baseUrl: '.',
      module: module == "commonjs" ? 'commonjs' : 'esnext',
      moduleResolution: 'node',
      incremental: true,
      target: "es5",
      lib: [ "ES6" ],
      allowJs: true,
      rootDir: hasSrc ? "src" : ".",
      outDir: "dist",
      strict: true,
      noImplicitAny: false,
      resolveJsonModule: true,
      ...(module === "esm" ? { allowSyntheticDefaultImports: true } : null),
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

  const packageJSON = fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8');
  let packageData = JSON.parse(packageJSON);

  module === "esm" ? packageData.type = "module" : null;
  packageData.scripts.start = `${runtime === "node" ? `tsx ${hasSrc ? './src/bin/www/' : './bin/www'}` : `bun ${hasSrc ? './src/bin/www' : './bin/www'}`}`;
  packageData.scripts.dev = `${runtime === "node" ? `tsx watch ${hasSrc ? './src/bin/www' : './bin/www'}` : `bun ${hasSrc ? './src/bin/www' : './bin/www'} --watch`}`;

  if (runtime === "node")
    packageData.scripts.build = `tsc && copyfiles -a ${hasSrc ? '-u 1 ./src' : '.'}/views/**/* ${hasSrc ? './src' : '.'}/public/**/* ${hasSrc ? './src' : '.'}/bin/**/* ./dist`;

  const editedJSON = JSON.stringify(packageData, null, 2);
  fs.writeFileSync(path.join(rootDir, 'package.json'), editedJSON);
}
function checkStatements(rootDir: string, module: Module) {
  const files: { pathname: string }[] = [ { pathname: path.join(rootDir, 'app.ts') }, { pathname: path.join(rootDir, 'routes', 'index.ts') }, { pathname: path.join(rootDir, 'routes', 'users.ts') }, { pathname: path.join(rootDir, 'bin', 'www') } ];
  files.forEach(file => {
    const parsed = fs.readFileSync(file.pathname, 'utf-8');
    const appUseRegex = /(app\.use|router\.get)\((\'\/\'\, )? ?function\((err)?\,? ?(req)\, (res)\, (next)\) \{/gi;

    let refactored = parsed.replace(appUseRegex, (_, p1, p2, p3, p4, p5, p6) => `${p1}(${p2 ?? ''}function(${p3 ? p3 + ": HttpError, " : ''}${p4}: Request, ${p5}: Response, ${p6}: NextFunction ) {`)
    const slicedData = refactored.split('\n');

    if (file.pathname !== `${rootDir}\\bin\\www`)
      slicedData.splice(0, 0, `import ${module === "commonjs" ? 'type' : ''} { Request, Response, NextFunction } from 'express'`)

    if (file.pathname === `${rootDir}\\app.ts`) {
      slicedData.splice(1, 0, `import ${module === "commonjs" ? 'type' : ''} { HttpError } from 'http-errors'`)
      slicedData.splice(7, 0, module === "esm" ? "import { fileURLToPath } from 'url'\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = path.dirname(__filename);" : "");
    }

    if (file.pathname === `${rootDir}\\bin\\www` && module === "esm") {
      const appName = rootDir.includes('src') ? rootDir.split('\\')[ 1 ] : rootDir.split('\\')[ 0 ];
      slicedData.splice(7, 1, `import debugModule from 'debug'\nconst debug = debugModule('${appName}:server')`);
    }

    const formatted = slicedData.join('\n');
    let result = module === "esm" ? convertToImportStatements(formatted) : formatted;
    fs.writeFileSync(file.pathname, result);
  })
}
function convertToImportStatements(parsed: string) {
  const requireRegex = /var (\w+) = require(\(\'[\.+\/+\w\:\-]+\'\))\;/gi
  const moduleExportsRegex = /module\.exports = (\w+)/gi;
  return parsed.replace(requireRegex, (_, p1, p2) => `import ${p1} from ${p2.slice(1, -1)}`)
    .replace(moduleExportsRegex, (_, p1) => `export default ${p1}`)
}