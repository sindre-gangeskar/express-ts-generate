import { Command } from "commander";
import { ViewEngine } from "types/types";
import { initialize, generate } from "./utils";
const program = new Command();

initialize().then(answers => {
  generate(program, answers.appname, answers.view as ViewEngine["value"], answers.gitInit, answers.runtime);
}).catch(err => {
  if (err instanceof Error && "name" in err && err.name === "ExitPromptError")
    return null;
  else throw err;
});

