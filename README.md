# Express TS Generate  
This is a simple package which utilizes the official express-generator package as a base, and then converts the generated project into a TypeScript equivalent.
The project generated will have the same structure as what you get by using express-generator.
 
## Configured to be used with Node or Bun
If you choose to use Node as the environment, it'll generate a dist output folder with a build command in the package.json file. If you choose bun you can choose to run it as is. 

## How to use
To generate a project:  
```npx express-ts-generate```  

run project with:    
```npm run dev``` or ```bun run dev```

### Note
Dependencies and types are automatically installed during the generation process.