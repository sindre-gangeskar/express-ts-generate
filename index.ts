import { Command } from "commander";
import { ViewEngine } from "types/types";
import { initialize, generate } from "utils";
const program = new Command();

initialize().then(answers => {
  generate(program, answers.appname, answers.view as ViewEngine, answers.gitInit, answers.runtime);
}).catch(err => {
  throw err;
});