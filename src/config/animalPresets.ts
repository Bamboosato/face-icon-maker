import type { AnimalPreset, AnimalPresetId } from "../types/animal";

export const ANIMAL_PRESETS: readonly AnimalPreset[] = [
  {
    id: "cat",
    label: "Cat",
    overlayUrl: "/animal/cat.svg",
    warp: { eyeScale: 1.05, noseScale: 0.84, muzzleScale: 1.02 },
  },
  {
    id: "dog",
    label: "Dog",
    overlayUrl: "/animal/dog.svg",
    warp: { eyeScale: 1, noseScale: 1.08, muzzleScale: 1.08 },
  },
  {
    id: "fox",
    label: "Fox",
    overlayUrl: "/animal/fox.svg",
    warp: { eyeScale: 1.04, noseScale: 0.92, muzzleScale: 0.96 },
  },
  {
    id: "bear",
    label: "Bear",
    overlayUrl: "/animal/bear.svg",
    warp: { eyeScale: 0.98, noseScale: 1.12, muzzleScale: 1.1 },
  },
  {
    id: "elephant",
    label: "Elephant",
    overlayUrl: "/animal/elephant.svg",
    warp: { eyeScale: 1, noseScale: 1.08, muzzleScale: 1.14 },
  },
  {
    id: "lion",
    label: "Lion",
    overlayUrl: "/animal/lion.svg",
    warp: { eyeScale: 1.02, noseScale: 1.1, muzzleScale: 1.08 },
  },
  {
    id: "rabbit",
    label: "Rabbit",
    overlayUrl: "/animal/rabbit.svg",
    warp: { eyeScale: 1.06, noseScale: 0.88, muzzleScale: 0.98 },
  },
  {
    id: "panda",
    label: "Panda",
    overlayUrl: "/animal/panda.svg",
    warp: { eyeScale: 1, noseScale: 1.08, muzzleScale: 1.12 },
  },
  {
    id: "raccoon",
    label: "Raccoon",
    overlayUrl: "/animal/raccoon.svg",
    warp: { eyeScale: 1.02, noseScale: 1.05, muzzleScale: 1.08 },
  },
  {
    id: "tiger",
    label: "Tiger",
    overlayUrl: "/animal/tiger.svg",
    warp: { eyeScale: 1.02, noseScale: 1.06, muzzleScale: 1.06 },
  },
  {
    id: "wolf",
    label: "Wolf",
    overlayUrl: "/animal/wolf.svg",
    warp: { eyeScale: 1.02, noseScale: 1.02, muzzleScale: 1.04 },
  },
  {
    id: "hamster",
    label: "Hamster",
    overlayUrl: "/animal/hamster.svg",
    warp: { eyeScale: 1.05, noseScale: 0.95, muzzleScale: 1.18 },
  },
];

export function getAnimalPreset(id: AnimalPresetId): AnimalPreset | undefined {
  return ANIMAL_PRESETS.find((preset) => preset.id === id);
}
