export interface ViewEngine {
  name: "Embedded JavaScript" | "Pug" | "None",
  value: "ejs" | "pug" | "none"
}
export type Runtime = "node" | "bun"
export type Module = "commonjs" | "esm"