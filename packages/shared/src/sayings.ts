/** Cheeky nudges shown when a die flies off the table instead of landing on the felt. */
export const OFF_THE_TABLE_SAYINGS = [
  'Whoa there — the dice stay on the table!',
  'That die made a break for it. Keep it on the felt and roll again.',
  'Nice arm. Now try landing them in the tray this time.',
  'Gravity called — your dice left the building. Roll again.',
  'A die escaped into the wild. Round it up and try again.',
  'Easy, gladiator. Those dice belong on the table.',
  'Off the table! We do not count floor rolls here.',
  'So close. Aim for the table and give it another go.',
] as const;

/** Picks a random off-the-table nudge. */
export function randomOffTheTableSaying(): string {
  return OFF_THE_TABLE_SAYINGS[Math.floor(Math.random() * OFF_THE_TABLE_SAYINGS.length)]!;
}
