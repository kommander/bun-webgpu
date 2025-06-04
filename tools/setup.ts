import { createGPUInstance, globals } from "../src/index";

globals();

export const create = () => {
  return createGPUInstance()
}