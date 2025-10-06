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
When running the build command, a dist folder will be generated alongside the .js files converted from .ts. It will also include the basic included folders made by express-generator such as views and public.  Be sure to include any other additonal folder manually by editing build script in the package.json file. 

### Note
Dependencies and types are automatically installed during the generation process.