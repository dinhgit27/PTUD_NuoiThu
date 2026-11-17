import { capitalizeStart, getActiveAddressing } from './petAddressing';

export interface PetActionResponse {
  bubble: string;
  speech: string;
}

export function getPetResponses(customCallName?: string, customSelfName?: string) {
  const active = getActiveAddressing();
  const callName = customCallName || active.callName;
  const selfName = customSelfName || active.selfName;
  const capSelf = capitalizeStart(selfName);

  return {
    feed: {
      bubble: `Măm măm ngon quá, cảm ơn ${callName} đã cho ${selfName} ăn! (+50 EXP) 🍱`,
      speech: `Măm măm ngon quá, cảm ơn ${callName} đã cho ${selfName} ăn ạ!`,
    },
    drink: {
      bubble: `Nước mát quá, cảm ơn ${callName} đã nhắc ${selfName} uống nước! 💧 (+20 EXP)`,
      speech: `Nước mát quá, cảm ơn ${callName} đã nhắc ${selfName} uống nước ạ!`,
    },
    stroke: {
      bubble: `Hihi thích quá, cảm ơn ${callName} đã vuốt ve ${selfName}! (+30 EXP) 💖`,
      speech: `Hihi thích quá, cảm ơn ${callName} đã vuốt ve ${selfName} ạ!`,
    },
    levelUp: {
      bubble: `Hoan hô! ${capSelf} đã lên cấp rồi ${callName} ơi! 🎉`,
      speech: `Hoan hô! ${capSelf} đã lên cấp rồi ${callName} ơi!`,
    },
  };
}

export const PET_RESPONSES = {
  get feed() {
    return getPetResponses().feed;
  },
  get drink() {
    return getPetResponses().drink;
  },
  get stroke() {
    return getPetResponses().stroke;
  },
  get levelUp() {
    return getPetResponses().levelUp;
  },
};
