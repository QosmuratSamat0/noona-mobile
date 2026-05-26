export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function shorten(value: string) {
  return value.length > 24 ? `${value.slice(0, 24)}...` : value;
}
