export interface PetActionResponse {
  bubble: string;
  speech: string;
}

export const PET_RESPONSES = {
  feed: {
    bubble: 'Măm măm ngon quá, cảm ơn đại ca đã cho em ăn! (+50 EXP) 🍱',
    speech: 'Măm măm ngon quá, cảm ơn đại ca đã cho em ăn ạ!',
  },
  drink: {
    bubble: 'Nước mát quá, cảm ơn đại ca đã nhắc em uống nước! 💧 (+20 EXP)',
    speech: 'Nước mát quá, cảm ơn đại ca đã nhắc em uống nước ạ!',
  },
  stroke: {
    bubble: 'Hihi thích quá, cảm ơn đại ca đã vuốt ve em! (+30 EXP) 💖',
    speech: 'Hihi thích quá, cảm ơn đại ca đã vuốt ve em ạ!',
  },
  levelUp: {
    bubble: 'Hoan hô! Bé cưng đã lên cấp rồi đại ca ơi! 🎉',
    speech: 'Hoan hô! Bé cưng đã lên cấp rồi đại ca ơi!',
  },
};
