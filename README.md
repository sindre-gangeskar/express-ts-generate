# Express TS Generate  
This is a simple package which utilizes the official express-generator package as a base, and then converts the generated project into a TypeScript equivalent.
The project generated will have the same structure as what you get by using express-generator.
 
## Configured to be used with Node or Bun
If you choose to use Node as the environment - a dist folder will be generated with the ```npm run build``` command which you can find in the package.json file.  
When using Bun, building isn't necessary as Bun can run TypeScript files natively.

## How to use
To generate a project:  
```npx express-ts-generate```  

run project with:
- dev: ```npm run dev``` or ```bun run dev```
- production: ```npm start``` or ```bun start```  

## Node build  
When running the build script for transpiling, all files not excluded by the --ignore flag in the build script in your package.json file will be carried to the **dist** folder, even the static ones as it aims to create a complete copy of the project in vanilla js form.  
  
If there is an excessive amount of files you don't want to include in the dist folder when building - you can create a custom script to exclude files with the **tsc-esm-fix** package which is already included when using the node runtime.

### Note
It's recommended to audit dependencies after the process has finished as this package is using express-generator as a base, which follows the same dependencies it uses upon generation prior to being converted to a TypeScript equivalent project.