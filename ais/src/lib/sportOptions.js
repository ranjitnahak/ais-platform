export const SPORT_OTHER = 'Other';

export const SPORT_OPTIONS = [
  'Athletics (Track & Field)',
  'Badminton',
  'Baseball',
  'Basketball',
  'Boxing',
  'Cricket',
  'CrossFit',
  'Cycling',
  'Field Hockey',
  'Football (Soccer)',
  'Futsal',
  'Golf',
  'Gymnastics',
  'Handball',
  'Ice Hockey',
  'Judo',
  'Kabaddi',
  'Lacrosse',
  'MMA',
  'Netball',
  'Powerlifting',
  'Rugby League',
  'Rugby Union',
  'Skiing',
  'Squash',
  'Swimming',
  'Table Tennis',
  'Taekwondo',
  'Tennis',
  'Triathlon',
  'Volleyball',
  'Weightlifting',
  'Wrestling',
  SPORT_OTHER,
];

export function resolveSportValue(sportSelect, customSport) {
  if (sportSelect === SPORT_OTHER) return customSport.trim() || null;
  return sportSelect.trim() || null;
}
