export const utils = {
  isNonEmpty: (value: string | null | undefined) => Boolean(value && value.trim().length > 0),
};
