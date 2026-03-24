import { createGPUInstance, globals } from "../src/index.js";

globals();

export const create = () => {
  return createGPUInstance()
}