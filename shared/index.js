export const NAME_SEARCH_MAX_LENGTH = 200;
export const MAX_NATIONALITY_FILTERS = 195;
export const MAX_HOBBY_FILTERS = 10;
export const FILTER_VALUE_MAX_LENGTH = 100;

const nameSearchPattern = new RegExp(`^[\\p{L}\\p{M} .'’ʼ-]{1,${NAME_SEARCH_MAX_LENGTH}}$`, 'u');

export const isValidNameSearch = (value) =>
  value === '' ||
  (nameSearchPattern.test(value) &&
    /\p{L}/u.test(value.replace(/['’ʼ]/gu, '')) &&
    !/ {2}|['’ʼ-]{2}/u.test(value));
