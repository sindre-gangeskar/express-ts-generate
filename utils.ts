import { execSync } from "child_process";
import { confirm, select, input } from "@inquirer/prompts";
import { Command } from "commander";
import { Runtime, ViewEngine } from "types/types";

import fs from 'fs';
import path from 'path';

import ora from "ora";

export function generate(program: Command, appname: string, view: ViewEngine, gitInit: boolean, runtime: Runtime) {
  program.name('express-ts-generator').description('Generate TypeScript Express applications').version("1.0.0")
  program.argument('[app-name]', 'name of the application', appname ?? 'src')
    .option('-v, --view [view]', 'select view engine', view ?? 'none')
    .option('--git [git]', 'setup a .gitignore file', gitInit ?? false)
    .action((app, options) => {
      let flags: string = "";
      const entries = Object.entries(options);

      const spinner = ora('Generating express project...').start()
      entries.forEach((entry) => {
        flags = flags.concat(`${typeof entry[ 1 ] !== "boolean" ? `--${entry[ 0 ]}` : typeof entry[ 1 ] === "boolean" && entry[ 1 ] ? `--${entry[ 0 ]}` : ""} ${typeof entry[ 1 ] !== "boolean" ? entry[ 1 ] : ""}`).trim().concat(' ');
      })

      const cd = `${app !== '.' ? `cd ./${app}` : ''}`;

      const extRuntime = runtime === "npm" ? 'npx' : 'bunx';
      execSync(`${extRuntime} express-generator ${app} ${flags}`)
      spinner.succeed('Successfully created project');

      spinner.start('Installing dependencies...');
      execSync(`${cd} && ${runtime} install`)
      spinner.succeed('Installed dependencies');

      spinner.start('Installing types...');
      execSync(`${cd} && ${runtime} install @types/express`);

      spinner.start('Converting to TypeScript...');
      convertToTS(app);
      spinner.succeed('Successfully converted project to TypeScript! Enjoy!');
    })

  program.parse()
}
export async function initialize() {
  try {
    const viewEngines: ViewEngine[] = [ 'ejs', 'pug', 'none' ];
    const appname = await input({ message: 'What is the name of the application?', default: 'src', required: true });
    const view = await select({ message: 'Which view engine will you use?', choices: viewEngines })
    const gitInit = await confirm({ message: 'Initialize .gitignore?', default: false });
    const runtime = await select({ message: 'Which runtime environment will you use?', choices: [ { name: 'Node.js', value: 'npm' }, { name: 'Bun', value: 'bun' } ] }) as Runtime;
    return { appname: appname, view: view, gitInit: gitInit, runtime: runtime }
  } catch (error) {
    throw error;
  }
}
function convertToTS(rootDir: string) {
  const routesPath = path.join(rootDir, 'routes');
  const tsConfig = {
    compilerOptions: {
      baseUrl: '.',
      module: 'nodenext',
      moduleResolution: 'nodenext',
      esModuleInterop: true
    }
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
  const packageData = JSON.parse(packageJSON);
  packageData.type = "module";

  const editedJSON = JSON.stringify(packageData, null, 2);
  fs.writeFileSync(path.join(rootDir, 'package.json'), editedJSON);

  convertToImportStatements(rootDir);
}
function convertToImportStatements(rootDir: string) {
  const files: { pathname: string }[] = [ { pathname: path.join(rootDir, 'app.ts') }, { pathname: path.join(rootDir, 'routes', 'index.ts') }, { pathname: path.join(rootDir, 'routes', 'users.ts') }, { pathname: path.join(rootDir, 'bin', 'www') } ];
  files.forEach(file => {
    console.log(file);
    const parsed = fs.readFileSync(file.pathname, 'utf-8');

    const requireRegex = /var (\w+) = require\(\'(\w+[\-?\w+]+|[.\/\w+]+?\w+)\'\)\:?([\(\'\w+\'\)]+)?/gi
    const moduleExportsRegex = /module\.exports = (\w+)/gi;

    let refactored = parsed.replace(requireRegex, (_, p1, p2) => `import ${p1} from '${p2}'`);
    refactored = refactored.replace(moduleExportsRegex, (_, p1) => `export default ${p1}`);
    console.log(refactored);
    fs.writeFileSync(file.pathname, refactored);
  })
}
