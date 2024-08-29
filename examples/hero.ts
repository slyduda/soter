import { TransitionInstructions } from "../src";

export type HeroState = "idle" | "sleeping";
export type HeroTrigger = "patrol" | "sleep";

export class Hero {
  state: HeroState;
  energy: number;

  constructor(state: HeroState) {
    this.state = state;
    this.energy = 1;
  }

  work() {
    this.energy--;
  }

  hasEnergy() {
    return this.energy > 0;
  }
}

export const heroMachineDict: TransitionInstructions<
  HeroState,
  HeroTrigger,
  Hero
> = {
  patrol: [
    {
      origins: "idle",
      destination: "idle",
      conditions: "hasEnergy",
      effects: "work",
    },
    {
      origins: "idle",
      destination: "sleeping", // The implication here is that if the hero is too tired they will fall asleep instead of consuming energy
    },
  ],
  sleep: [{ origins: "idle", destination: "sleeping" }],
};
