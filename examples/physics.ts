import { TransitionInstructions } from "../src";

export type MatterState = "solid" | "liquid" | "gas" | "plasma";
export type MatterTrigger =
  | "melt"
  | "evaporate"
  | "sublimate"
  | "ionize"
  | "freeze"
  | "depose"
  | "condense"
  | "recombine";

export class Matter {
  state: MatterState;
  temperature: number;
  pressure: number;

  constructor(state: MatterState, temperature?: number, pressure?: number) {
    this.state = state;
    this.temperature = temperature ?? 0;
    this.pressure = pressure ?? 101.325;
  }

  setEnvironment(props?: { temperature: number; pressure: number }) {
    const { temperature = 0, pressure = 101.325 } = props ?? {};
    this.temperature = temperature;
    this.pressure = pressure;
  }
}

export const matterMachineDict: TransitionInstructions<
  MatterState,
  MatterTrigger,
  Matter
> = {
  melt: [
    { origins: "solid", destination: "liquid", effects: "setEnvironment" },
  ],
  evaporate: [{ origins: "liquid", destination: "gas" }],
  sublimate: [{ origins: "solid", destination: "gas" }],
  ionize: [{ origins: "gas", destination: "plasma" }],
  freeze: [{ origins: "liquid", destination: "solid" }],
  depose: [{ origins: "gas", destination: "solid" }],
  condense: [{ origins: "gas", destination: "liquid" }],
  recombine: [{ origins: "plasma", destination: "gas" }],
};
